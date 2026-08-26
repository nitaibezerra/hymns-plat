"""
Marco 6 (primeiro item) — `HymnBookType.syncVersion`.

`HymnBook.sync_version` nasceu no modelo (migration 0017) com os signals que
o incrementam a cada mudança em hino/áudio, mas nunca foi exposto no GraphQL.
Sem ele o cliente offline não tem o que comparar: recebe o hinário em cache e
não sabe dizer se está velho.
"""

from __future__ import annotations

import pytest

from ._helpers import gql

pytestmark = pytest.mark.django_db


SYNC_VERSION_QUERY = """
query($slug: String!) {
  hymnbook(slug: $slug) {
    syncVersion
  }
}
"""


def test_sync_version_starts_at_zero(client, hymn_book_factory):
    book = hymn_book_factory(name="Novo", slug="novo")

    data = gql(client, SYNC_VERSION_QUERY, variables={"slug": book.slug})
    assert "errors" not in data, data
    assert data["data"]["hymnbook"]["syncVersion"] == 0


def test_sync_version_reflects_bump_after_hymn_change(client, hymn_book_factory, hymn_factory):
    """O campo lê a coluna viva: o signal bumpa e a query devolve o novo valor."""
    book = hymn_book_factory(name="O Cruzeiro", slug="o-cruzeiro")
    hymn_factory(book, number=1, title="Lua Branca")

    book.refresh_from_db()
    assert book.sync_version > 0, "signal do Marco 6 deveria ter incrementado"

    data = gql(client, SYNC_VERSION_QUERY, variables={"slug": book.slug})
    assert "errors" not in data, data
    assert data["data"]["hymnbook"]["syncVersion"] == book.sync_version
