"""
`HymnType.ocrText` / `inlineDiff` / `ocrLineConfidences` são workspace editorial.

A régua é o Django. Os três só existem numa tela: `editor_revise_hymn`
(`apps/hymns/editor_views.py`), `@login_required` + `can_edit_hymnbook`, que
monta o contexto com `inline_diff` e `ocr_line_confidences` e renderiza
`templates/hymns/editor/revise_hymn.html`. O template PÚBLICO do hino
(`templates/hymns/hymn_detail.html`) mostra `text` via `{% render_hymn_body %}`
e nada de OCR — nem o texto cru, nem o diff, nem a confiança por linha.

Na API os três saíam pra anônimo. `ocrText` é o texto cru antes da revisão
editorial: erros de reconhecimento, lixo de digitalização e, no fluxo de
contribuição, o conteúdo de um PDF de terceiro que ainda não foi conferido. O
diff e as confianças por linha são a leitura desse material.

Forma do gate: VAZIO em vez de erro. Diferente de `revisions`, aqui "vazio" não
é resposta enganosa — é literalmente o estado de todo hino `source=manual`, que
é o que o público já vê hoje na maioria dos hinos (`ocr_text=""` →
`inlineDiff=None` e `ocrLineConfidences=[]` pelo próprio
`_compute_ocr_line_confidences`). Assim o SDL fica intacto (`ocrText: String!`,
`ocrLineConfidences: [Int!]!`) e uma query mista não perde o hino inteiro por
causa de um campo não-nulável.
"""

from __future__ import annotations

import pytest

from ._helpers import gql

pytestmark = pytest.mark.django_db

OCR_QUERY = """
query($pk: ID!) {
  hymn(pk: $pk) {
    title
    body
    ocrText
    ocrLineConfidences
    inlineDiff { changes adds dels lines { kind } }
  }
}
"""

OCR_RAW = "Lua branka\nDa Iuz serena"
REVISED = "Lua branca\nDa luz serena"


@pytest.fixture
def hymn_from_ocr(hymn_book_factory, hymn_factory):
    """Hino publicado que veio de OCR: texto cru preservado e texto revisado."""
    book = hymn_book_factory(name="O Cruzeiro", slug="cruzeiro", is_published=True)
    return hymn_factory(hymn_book=book, number=1, title="Lua Branca", text=REVISED, ocr_text=OCR_RAW)


def _row(client, hymn, user=None):
    data = gql(client, OCR_QUERY, variables={"pk": str(hymn.pk)}, user=user)
    assert "errors" not in data, data
    return data["data"]["hymn"]


def test_anon_sees_no_ocr_material(client, hymn_from_ocr):
    """Anônimo: nada de OCR — e o texto público do hino segue intacto."""
    row = _row(client, hymn_from_ocr)
    assert row["ocrText"] == ""
    assert row["ocrLineConfidences"] == []
    assert row["inlineDiff"] is None
    assert "branka" not in str(row), "o texto cru do OCR vazou"
    # O caminho público não regrediu.
    assert row["title"] == "Lua Branca"
    assert row["body"] == REVISED


def test_authenticated_non_editor_sees_no_ocr_material(client, hymn_from_ocr, user_factory):
    """Estar logado não basta: a tela do Django exige `can_edit_hymnbook`."""
    comum = user_factory(email="comum@example.com")
    row = _row(client, hymn_from_ocr, user=comum)
    assert row["ocrText"] == ""
    assert row["ocrLineConfidences"] == []
    assert row["inlineDiff"] is None
    assert "branka" not in str(row), "o texto cru do OCR vazou"


def test_editor_sees_the_full_ocr_material(editor_client, hymn_from_ocr):
    """Quem abre `editor_revise_hymn` no Django lê os três aqui também."""
    row = _row(editor_client, hymn_from_ocr)
    assert row["ocrText"] == OCR_RAW
    assert len(row["ocrLineConfidences"]) == 2, row["ocrLineConfidences"]
    assert all(0 <= score <= 100 for score in row["ocrLineConfidences"]), row["ocrLineConfidences"]
    assert row["inlineDiff"] is not None
    assert row["inlineDiff"]["lines"], row["inlineDiff"]


def test_superuser_sees_the_full_ocr_material(client, hymn_from_ocr, user_factory):
    """Superuser passa em `_is_editor_or_admin` sem grupo nenhum."""
    admin = user_factory(email="root@example.com")
    admin.is_superuser = True
    admin.save()
    row = _row(client, hymn_from_ocr, user=admin)
    assert row["ocrText"] == OCR_RAW
    assert row["inlineDiff"] is not None


def test_manual_hymn_looks_the_same_to_editor_and_anon(editor_client, hymn_book_factory, hymn_factory):
    """Hino sem OCR: vazio pros dois — o gate não inventou diferença."""
    book = hymn_book_factory(name="Manual", slug="manual", is_published=True)
    hymn = hymn_factory(hymn_book=book, number=2, title="Sem OCR", text="Letra digitada")

    editor_row = _row(editor_client, hymn)
    assert editor_row["ocrText"] == ""
    assert editor_row["ocrLineConfidences"] == []
    assert editor_row["inlineDiff"] is None
