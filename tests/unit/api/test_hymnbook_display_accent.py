"""
Fase 3 da paridade visual — `_plan/plano-paridade-visual-spa.md`.

`HymnBookType.displayAccent` expõe `HymnBook.display_accent`: a cor de
destaque do card e do hero do hinário.

Sem este campo o shell SvelteKit não tinha como pintar o gradiente
`linear-gradient(140deg, accent, color-mix(accent 60%, black))` que
`templates/_partials/_hymnbook_card.html` e `hymnbook_detail.html` usam — e as
duas rotas que dependem dele são justamente as piores da medição de paridade
(`hinarios-list` 48,49% e `hymnbook-indice` 59,86%).

O ponto crítico é o determinismo: a mesma cor tem que sair no monolito e na
SPA, senão o card muda de cor quando o usuário troca de frontend.
"""

from __future__ import annotations

import pytest

from apps.hymns.models import HYMNBOOK_ACCENT_PALETTE

from ._helpers import gql

pytestmark = pytest.mark.django_db


def _accent(client, slug: str) -> str:
    data = gql(client, f'{{ hymnbook(slug: "{slug}") {{ displayAccent }} }}')
    assert "errors" not in data, data
    return data["data"]["hymnbook"]["displayAccent"]


def test_usa_accent_color_quando_o_dono_escolheu(client, hymn_book_factory):
    hymn_book_factory(name="O Cruzeiro", slug="cruzeiro", is_published=True, accent_color="#8C3A2E")
    assert _accent(client, "cruzeiro") == "#8C3A2E"


def test_cai_na_paleta_quando_accent_color_esta_vazio(client, hymn_book_factory):
    hymn_book_factory(name="O Cruzeiro", slug="cruzeiro", is_published=True, accent_color="")
    assert _accent(client, "cruzeiro") in HYMNBOOK_ACCENT_PALETTE


def test_e_o_mesmo_valor_que_o_modelo_calcula(client, hymn_book_factory):
    """Determinismo: a API não pode ter sua própria regra de cor.

    É o que garante que o card do hinário não troque de cor entre
    `hinaria.com.br` (que lê `hb.display_accent` no template) e a SPA (que lê
    este campo). Duas fontes de verdade aqui seriam invisíveis em teste
    unitário e óbvias na tela.
    """
    hb = hymn_book_factory(name="Lua Branca", slug="lua-branca", is_published=True, accent_color="")
    assert _accent(client, "lua-branca") == hb.display_accent


def test_e_estavel_entre_chamadas(client, hymn_book_factory):
    hymn_book_factory(name="A Mensagem", slug="a-mensagem", is_published=True, accent_color="")
    assert _accent(client, "a-mensagem") == _accent(client, "a-mensagem")


def test_aparece_na_listagem_de_hinarios(client, hymn_book_factory):
    """A lista é o consumidor principal: 58 cards, um gradiente por card."""
    hymn_book_factory(name="O Cruzeiro", slug="cruzeiro", is_published=True, accent_color="#1F5C4D")
    data = gql(client, "{ hymnbooks { slug displayAccent } }")
    assert "errors" not in data, data
    por_slug = {row["slug"]: row["displayAccent"] for row in data["data"]["hymnbooks"]}
    assert por_slug["cruzeiro"] == "#1F5C4D"
