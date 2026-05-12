"""
Marco 1 — Ciclos 1.4 a 1.6.

Cobre os resolvers `hymnbooks` (lista) e `hymnbook(slug)` (detalhe), com gates
de visibilidade reutilizando `HymnBook.objects.visible_to(user)`.
"""

from __future__ import annotations

import pytest

from ._helpers import gql

pytestmark = pytest.mark.django_db


# Ciclo 1.4 — anon vê só publicados
def test_hymnbooks_query_returns_only_published_for_anon(client, hymn_book_factory):
    hymn_book_factory(name="Publicado", slug="publicado", is_published=True)
    hymn_book_factory(name="Draft", slug="draft", is_published=False)

    data = gql(client, "{ hymnbooks { slug } }")
    assert "errors" not in data, data
    slugs = {hb["slug"] for hb in data["data"]["hymnbooks"]}
    assert slugs == {"publicado"}, f"anon deveria ver só publicados, vi {slugs}"


# Ciclo 1.5 — editor vê drafts
def test_hymnbooks_query_returns_drafts_for_editor(client, editor_client, hymn_book_factory):
    hymn_book_factory(name="Publicado", slug="publicado", is_published=True)
    hymn_book_factory(name="Draft", slug="draft", is_published=False)

    data = gql(editor_client, "{ hymnbooks { slug } }")
    assert "errors" not in data, data
    slugs = {hb["slug"] for hb in data["data"]["hymnbooks"]}
    assert slugs == {"publicado", "draft"}, f"editor deveria ver ambos, vi {slugs}"


# Ciclo 1.6 — hymnbook(slug) retorna null para anon em draft
def test_hymnbook_by_slug_returns_null_for_unpublished_to_anon(client, hymn_book_factory):
    hymn_book_factory(name="Draft", slug="draft", is_published=False)

    data = gql(
        client,
        '{ hymnbook(slug: "draft") { slug name } }',
    )
    assert "errors" not in data, data
    assert data["data"]["hymnbook"] is None, "anon não deveria enxergar draft"


def test_hymnbook_by_slug_returns_published_for_anon(client, hymn_book_factory):
    hymn_book_factory(name="Publicado", slug="publicado", is_published=True)

    data = gql(
        client,
        '{ hymnbook(slug: "publicado") { slug name } }',
    )
    assert "errors" not in data, data
    assert data["data"]["hymnbook"]["slug"] == "publicado"
    assert data["data"]["hymnbook"]["name"] == "Publicado"
