"""
Marco 4.A · Ciclo 4A.7.

`Query.search(q, kind)` retorna `SearchResultsType { hymns, hymnbooks }`,
reusando o queryset de `apps/hymns/views.py::search_view` (Postgres
`UnaccentFunc` + `TrigramSimilarity` + full-text), com gating por
visibilidade.
"""

from __future__ import annotations

import pytest

from ._helpers import gql

pytestmark = pytest.mark.django_db


def test_search_returns_hymns_matching_title(client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory(name="O Cruzeiro", slug="cruzeiro", is_published=True)
    h = hymn_factory(hymn_book=hb, number=1, title="Lua Branca", text="Lua branca da luz serena")
    # Hino não relacionado pra garantir que filtramos.
    hymn_factory(hymn_book=hb, number=2, title="Outro", text="Texto irrelevante")

    data = gql(
        client,
        '{ search(q: "lua branca") { hymns { id title } hymnbooks { slug } } }',
    )
    assert "errors" not in data, data
    hymn_ids = {row["id"] for row in data["data"]["search"]["hymns"]}
    assert str(h.id) in hymn_ids, hymn_ids


def test_search_filters_by_visibility(client, hymn_book_factory, hymn_factory):
    hb_draft = hymn_book_factory(name="Draft Cruzeiro", slug="draft-cruzeiro", is_published=False)
    h_draft = hymn_factory(hymn_book=hb_draft, number=1, title="Lua Branca", text="Lua branca da luz serena")

    data = gql(
        client,
        '{ search(q: "lua branca") { hymns { id } hymnbooks { slug } } }',
    )
    assert "errors" not in data, data
    hymn_ids = {row["id"] for row in data["data"]["search"]["hymns"]}
    book_slugs = {row["slug"] for row in data["data"]["search"]["hymnbooks"]}
    assert str(h_draft.id) not in hymn_ids, hymn_ids
    assert "draft-cruzeiro" not in book_slugs, book_slugs


def test_search_kind_filter(client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory(name="O Cruzeiro", slug="cruzeiro", is_published=True)
    hymn_factory(hymn_book=hb, number=1, title="Lua Branca", text="Lua branca")

    # kind=HYMN só preenche hymns.
    data_hymn = gql(
        client,
        '{ search(q: "cruzeiro", kind: HYMN) { hymns { id } hymnbooks { slug } } }',
    )
    assert "errors" not in data_hymn, data_hymn
    assert data_hymn["data"]["search"]["hymnbooks"] == []

    # kind=HYMNBOOK só preenche hymnbooks.
    data_book = gql(
        client,
        '{ search(q: "cruzeiro", kind: HYMNBOOK) { hymns { id } hymnbooks { slug } } }',
    )
    assert "errors" not in data_book, data_book
    assert data_book["data"]["search"]["hymns"] == []
    book_slugs = {row["slug"] for row in data_book["data"]["search"]["hymnbooks"]}
    assert "cruzeiro" in book_slugs


# ---------------------------------------------------------------------------
# Fase 3 da paridade visual (2026-08-31) — `_plan/plano-paridade-visual-spa.md`
#
# `hymnHits`/`hymnbookHits` carregam `headline` e `rank`. Antes disso o
# resolver devolvia listas cruas e a busca da SPA mostrava só títulos,
# enquanto a do monolito mostrava o verso onde o termo aparece — a rota
# `busca` rendia 169 linhas de texto contra 521 do Django.
# ---------------------------------------------------------------------------


def test_hymn_hit_headline_marca_o_termo_no_verso(client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory(name="O Cruzeiro", slug="cruzeiro", is_published=True)
    hymn_factory(
        hymn_book=hb,
        number=1,
        title="Sem o termo no titulo",
        text="A lua branca da luz serena\nIlumina o meu caminho",
    )

    data = gql(client, '{ search(q: "lua") { hymnHits { headline rank } } }')
    assert "errors" not in data, data
    hits = data["data"]["search"]["hymnHits"]
    assert hits, "a busca não achou o hino pelo texto do verso"
    # `<mark>` é o contrato visual: a tela de busca renderiza isto como HTML.
    assert any("<mark>" in hit["headline"].lower() for hit in hits), hits


def test_hymnbook_hit_headline_e_descricao_truncada_sem_mark(client, hymn_book_factory):
    # 200 caracteres pra provar o corte em 140 (`BOOK_HEADLINE_CHARS`).
    descricao = "Recebido por Madrinha Rita. " + ("x" * 200)
    hymn_book_factory(
        name="Lua Branca", slug="lua-branca", is_published=True, description=descricao
    )

    data = gql(client, '{ search(q: "lua branca") { hymnbookHits { headline } } }')
    assert "errors" not in data, data
    hits = data["data"]["search"]["hymnbookHits"]
    assert hits, "a busca não achou o hinário pelo nome"
    headline = hits[0]["headline"]
    assert len(headline) == 140, len(headline)
    assert headline == descricao[:140]
    # Descrição não entra em `search_vector`: não há o que o Postgres destacar.
    assert "<mark>" not in headline


def test_in_hymnbook_filtra_so_o_bucket_de_hinos(client, hymn_book_factory, hymn_factory):
    alvo = hymn_book_factory(name="O Cruzeiro", slug="cruzeiro", is_published=True)
    outro = hymn_book_factory(name="Lua Branca", slug="lua-branca", is_published=True)
    do_alvo = hymn_factory(hymn_book=alvo, number=1, title="Lua Cheia", text="A lua cheia")
    de_fora = hymn_factory(hymn_book=outro, number=1, title="Lua Nova", text="A lua nova")

    data = gql(
        client,
        '{ search(q: "lua", inHymnbook: "cruzeiro") { hymnHits { hymn { id } } } }',
    )
    assert "errors" not in data, data
    ids = {hit["hymn"]["id"] for hit in data["data"]["search"]["hymnHits"]}
    assert str(do_alvo.id) in ids, ids
    assert str(de_fora.id) not in ids, ids


def test_in_hymnbook_invisivel_devolve_vazio_em_vez_de_ignorar_o_filtro(
    client, hymn_book_factory, hymn_factory
):
    """Divergência deliberada da view HTML, documentada no resolver.

    Na view do monolito um slug inexistente/invisível é IGNORADO e a busca
    devolve tudo. Aqui o filtro se aplica sobre um queryset já gateado por
    visibilidade, então o resultado é vazio. Filtro que silenciosamente não
    filtra é pior que filtro que não acha nada.
    """
    publicado = hymn_book_factory(name="O Cruzeiro", slug="cruzeiro", is_published=True)
    hymn_factory(hymn_book=publicado, number=1, title="Lua Cheia", text="A lua cheia")
    hymn_book_factory(name="Rascunho", slug="rascunho", is_published=False)

    data = gql(
        client,
        '{ search(q: "lua", inHymnbook: "rascunho") { hymnHits { hymn { id } } } }',
    )
    assert "errors" not in data, data
    assert data["data"]["search"]["hymnHits"] == []


def test_campos_deprecados_seguem_respondendo(client, hymn_book_factory, hymn_factory):
    """`hymns`/`hymnbooks` continuam vivos — a SPA em beta.hinaria.com.br os usa.

    Removê-los junto com a adição dos hits derrubaria a tela de busca em
    produção até a Fase 4 migrar o cliente. Deprecados, não removidos.
    """
    hb = hymn_book_factory(name="Lua Branca", slug="lua-branca", is_published=True)
    hymn = hymn_factory(hymn_book=hb, number=1, title="Lua Cheia", text="A lua cheia")

    data = gql(
        client,
        """{ search(q: "lua") {
                 hymns { id }
                 hymnbooks { slug }
                 hymnHits { hymn { id } }
                 hymnbookHits { hymnbook { slug } }
             } }""",
    )
    assert "errors" not in data, data
    resultado = data["data"]["search"]
    # A lista deprecada é derivada dos hits — mesmos objetos, mesma ordem.
    assert [row["id"] for row in resultado["hymns"]] == [
        hit["hymn"]["id"] for hit in resultado["hymnHits"]
    ]
    assert [row["slug"] for row in resultado["hymnbooks"]] == [
        hit["hymnbook"]["slug"] for hit in resultado["hymnbookHits"]
    ]
    assert str(hymn.id) in {row["id"] for row in resultado["hymns"]}
