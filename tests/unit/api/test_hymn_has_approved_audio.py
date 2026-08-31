"""
Fase 4 da paridade visual — `_plan/plano-paridade-visual-spa.md`.

`HymnType.hasApprovedAudio` alimenta o índice do hinário, que decide por linha
entre o botão ▶ e o `⊘` cinza. É o equivalente do `hymns_with_audio` que
`views.HymnBookDetailView` monta em uma consulta só.

Público de propósito, espelhando o default `approved_only=True` de
`HymnType.audios`, que já é o comportamento do player. Não revela nada que o
player público não revele — em particular, NÃO revela a existência de gravação
pendente, que é o que os testes de gate cobrem.
"""

from __future__ import annotations

import pytest

from ._helpers import gql

pytestmark = pytest.mark.django_db

QUERY = '{ hymnbook(slug: "cruzeiro") { hymns { number hasApprovedAudio } } }'


def _por_numero(client) -> dict[int, bool]:
    data = gql(client, QUERY)
    assert "errors" not in data, data
    return {h["number"]: h["hasApprovedAudio"] for h in data["data"]["hymnbook"]["hymns"]}


def test_false_quando_o_hino_nao_tem_audio(client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory(name="O Cruzeiro", slug="cruzeiro", is_published=True)
    hymn_factory(hymn_book=hb, number=1, title="Sem Áudio")
    assert _por_numero(client) == {1: False}


def test_true_quando_ha_audio_aprovado(client, hymn_book_factory, hymn_factory, sample_image):
    from apps.hymns.models import HymnAudio

    hb = hymn_book_factory(name="O Cruzeiro", slug="cruzeiro", is_published=True)
    hymn = hymn_factory(hymn_book=hb, number=1, title="Com Áudio")
    HymnAudio.objects.create(hymn=hymn, is_approved=True)

    assert _por_numero(client) == {1: True}


def test_audio_pendente_nao_conta_para_anonimo(client, hymn_book_factory, hymn_factory):
    """O índice público não deve acender ▶ numa gravação que ninguém aprovou.

    E, do outro lado, não deve VAZAR que existe gravação pendente — que é
    exatamente o que aconteceria se o campo contasse qualquer áudio.
    """
    from apps.hymns.models import HymnAudio

    hb = hymn_book_factory(name="O Cruzeiro", slug="cruzeiro", is_published=True)
    hymn = hymn_factory(hymn_book=hb, number=1, title="Pendente")
    HymnAudio.objects.create(hymn=hymn, is_approved=False)

    assert _por_numero(client) == {1: False}


def test_distingue_hino_por_hino_no_mesmo_hinario(client, hymn_book_factory, hymn_factory):
    """É o caso real do índice: poucas linhas com ▶ no meio de muitas com ⊘."""
    from apps.hymns.models import HymnAudio

    hb = hymn_book_factory(name="O Cruzeiro", slug="cruzeiro", is_published=True)
    com_audio = hymn_factory(hymn_book=hb, number=1, title="Com")
    hymn_factory(hymn_book=hb, number=2, title="Sem")
    hymn_factory(hymn_book=hb, number=3, title="Também sem")
    HymnAudio.objects.create(hymn=com_audio, is_approved=True)

    assert _por_numero(client) == {1: True, 2: False, 3: False}
