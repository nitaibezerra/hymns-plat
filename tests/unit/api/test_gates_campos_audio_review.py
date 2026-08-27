"""
O VEREDITO de revisão de áudio é interno — `HymnAudioType` só o mostra a editor.

`isMatch`, `qualityRating`, `qualityObservations`, `mismatchReason`, `reviewedBy`
e `reviewedAt` são a avaliação editorial da gravação de alguém: "É outro hino",
"Áudio inaudível", "Voz baixa", nota de 1 a 5, e o nome de quem deu o parecer.

A régua é o Django. Os seis aparecem numa tela só:
`templates/hymns/editor/_audio_review.html`, incluído por
`editor_revise_hymn` (`@login_required` + `can_edit_hymnbook`) e escrito por
`editor_hymn_audio_review` (mesmo par de gates). O player PÚBLICO
(`templates/hymns/_audio_player.html`) mostra título, duração,
`uploaded_by.username`, créditos, data de gravação e waveform — e nada do
parecer. Nem o perfil do uploader mostra: não há tela nenhuma no monolito que
devolva o veredito pra quem enviou o áudio.

A API entregava os seis a qualquer anônimo, pelo caminho
`hymn(pk:){ audios { mismatchReason qualityObservations } }`.

Forma do gate: fora do papel editorial, TODO áudio parece não-revisado —
`null`/`[]`/`""`, que é o estado real de todo áudio ainda na fila. Assim o SDL
fica intacto (`qualityObservations: [String!]!` e `mismatchReason: String!`
seguem não-nuláveis) e o player público não perde o áudio inteiro por causa de um
campo não-nulável numa query mista.

`isApproved` NÃO entra no gate: é o que o próprio player público usa como
condição de render (`{% if audio and audio.is_approved %}`) e o que o
`HymnAudioList` do shell usa pro badge "Aguardando aprovação".
"""

from __future__ import annotations

import datetime

import pytest
from django.utils import timezone

from apps.hymns.models import HymnAudio

from ._helpers import gql

pytestmark = pytest.mark.django_db

AUDIO_QUERY = """
query($pk: ID!) {
  hymn(pk: $pk) {
    audios {
      title
      isApproved
      credits
      recordedAt
      allowDownload
      uploadedBy { username }
      isMatch
      qualityRating
      qualityObservations
      mismatchReason
      reviewedAt
      reviewedBy { username }
    }
  }
}
"""


@pytest.fixture
def reviewed_audio(user_factory, hymn_book_factory, hymn_factory):
    """Áudio APROVADO (logo público) que já carrega parecer editorial completo."""
    uploader = user_factory(email="uploader@example.com")
    reviewer = user_factory(email="reviewer@example.com")
    book = hymn_book_factory(name="O Cruzeiro", slug="cruzeiro", is_published=True)
    hymn = hymn_factory(hymn_book=book, number=1, title="Lua Branca")
    HymnAudio.objects.create(
        hymn=hymn,
        audio_file="hymns/audio/2026/05/a.mp3",
        title="Gravação de 1998",
        credits="Cantado por Maria",
        recorded_at=datetime.date(1998, 3, 21),
        is_approved=True,
        uploaded_by=uploader,
        is_match=True,
        quality_rating=2,
        quality_observations=["Voz baixa", "Ruído de fundo"],
        reviewed_by=reviewer,
        reviewed_at=timezone.now(),
    )
    return hymn


@pytest.fixture
def mismatched_audio(user_factory, hymn_book_factory, hymn_factory):
    """Áudio recusado por mismatch — o `save()` do modelo desaprova sozinho."""
    uploader = user_factory(email="uploader2@example.com")
    book = hymn_book_factory(name="Nova Era", slug="nova-era", is_published=True)
    hymn = hymn_factory(hymn_book=book, number=2, title="Estrela")
    HymnAudio.objects.create(
        hymn=hymn,
        audio_file="hymns/audio/2026/05/b.mp3",
        title="Enviada por engano",
        uploaded_by=uploader,
        is_match=False,
        mismatch_reason=HymnAudio.MismatchReason.OTHER_HYMN,
    )
    return hymn, uploader


def _audio(client, hymn, user=None, approved_only=True):
    query = AUDIO_QUERY if approved_only else AUDIO_QUERY.replace("audios {", "audios(approvedOnly: false) {")
    data = gql(client, query, variables={"pk": str(hymn.pk)}, user=user)
    assert "errors" not in data, data
    rows = data["data"]["hymn"]["audios"]
    assert len(rows) == 1, rows
    return rows[0]


def _assert_looks_unreviewed(row: dict) -> None:
    assert row["isMatch"] is None, row
    assert row["qualityRating"] is None, row
    assert row["qualityObservations"] == [], row
    assert row["mismatchReason"] == "", row
    assert row["reviewedAt"] is None, row
    assert row["reviewedBy"] is None, row


def test_anon_sees_no_review_verdict(client, reviewed_audio):
    """Anônimo: áudio parece não-revisado, e o parecer não vaza em nenhum campo."""
    row = _audio(client, reviewed_audio)
    _assert_looks_unreviewed(row)
    assert "Voz baixa" not in str(row), "observação de qualidade vazou"
    assert "reviewer" not in str(row), "o nome do revisor vazou"


def test_anon_keeps_the_public_audio_metadata(client, reviewed_audio):
    """O player público não regrediu: título, créditos, data, uploader, aprovação."""
    row = _audio(client, reviewed_audio)
    assert row["title"] == "Gravação de 1998"
    assert row["credits"] == "Cantado por Maria"
    assert row["recordedAt"] == "1998-03-21"
    assert row["allowDownload"] is True
    assert row["isApproved"] is True
    assert row["uploadedBy"] == {"username": "uploader"}


def test_authenticated_non_editor_sees_no_review_verdict(client, reviewed_audio, user_factory):
    """Estar logado não basta: o bloco de revisão exige `can_edit_hymnbook`."""
    comum = user_factory(email="comum@example.com")
    _assert_looks_unreviewed(_audio(client, reviewed_audio, user=comum))


def test_uploader_sees_no_verdict_on_own_rejected_audio(client, mismatched_audio):
    """O monolito não tem tela que devolva o parecer a quem enviou — nem a API.

    O uploader vê o PRÓPRIO áudio pendente (`audios(approvedOnly: false)` já
    fazia isso), mas `mismatchReason` é a nota interna do revisor.
    """
    hymn, uploader = mismatched_audio
    row = _audio(client, hymn, user=uploader, approved_only=False)
    assert row["isApproved"] is False, row
    _assert_looks_unreviewed(row)
    assert "other_hymn" not in str(row), "o motivo do mismatch vazou pro uploader"


def test_editor_sees_the_full_verdict(editor_client, reviewed_audio):
    """Quem abre o bloco de revisão no Django lê os seis campos aqui também."""
    row = _audio(editor_client, reviewed_audio)
    assert row["isMatch"] is True
    assert row["qualityRating"] == 2
    assert row["qualityObservations"] == ["Voz baixa", "Ruído de fundo"]
    assert row["reviewedBy"] == {"username": "reviewer"}
    assert row["reviewedAt"] is not None


def test_editor_sees_the_mismatch_reason(editor_client, mismatched_audio):
    hymn, _uploader = mismatched_audio
    row = _audio(editor_client, hymn, approved_only=False)
    assert row["isMatch"] is False
    assert row["mismatchReason"] == HymnAudio.MismatchReason.OTHER_HYMN


def test_superuser_sees_the_full_verdict(client, reviewed_audio, user_factory):
    """Superuser passa em `_is_editor_or_admin` sem grupo nenhum."""
    admin = user_factory(email="root@example.com")
    admin.is_superuser = True
    admin.save()
    row = _audio(client, reviewed_audio, user=admin)
    assert row["isMatch"] is True
    assert row["qualityObservations"] == ["Voz baixa", "Ruído de fundo"]
