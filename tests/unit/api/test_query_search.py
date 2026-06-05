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
