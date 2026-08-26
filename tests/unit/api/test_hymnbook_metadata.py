"""
Marco 5.A½ · Tarefa B5 — metadados de HymnBookType.

`description`, `ownerName`, `introName`, `coverImage`, `createdAt`,
`publishedAt` e `publishedBy` são todos usados pelos templates que os
sub-marcos 5.B/5.D têm que portar (hero do hinário, card, painel de
publicação) e nenhum estava no schema.
"""

from __future__ import annotations

import pytest
from django.utils import timezone

from ._helpers import gql

pytestmark = pytest.mark.django_db


HYMNBOOK_QUERY = """
query($slug: String!) {
  hymnbook(slug: $slug) {
    description
    ownerName
    introName
    coverImage
    createdAt
    publishedAt
    publishedBy { username }
  }
}
"""


def test_hymnbook_metadata_is_exposed(admin_client, hymn_book_factory):
    published_at = timezone.now()
    book = hymn_book_factory(
        name="O Cruzeiro",
        slug="o-cruzeiro",
        owner_name="Mestre Irineu",
        intro_name="Cruzeiro",
        description="Hinário do Mestre",
        published_at=published_at,
        published_by=admin_client.user,
    )

    data = gql(admin_client, HYMNBOOK_QUERY, variables={"slug": book.slug})
    assert "errors" not in data, data
    row = data["data"]["hymnbook"]
    assert row["description"] == "Hinário do Mestre"
    assert row["ownerName"] == "Mestre Irineu"
    assert row["introName"] == "Cruzeiro"
    assert row["publishedBy"] == {"username": admin_client.user.username}
    assert row["publishedAt"].startswith(published_at.date().isoformat())
    assert row["createdAt"] is not None


def test_hymnbook_nullable_metadata_when_unset(client, hymn_book_factory):
    """Rascunho recém-criado: sem capa, sem publicação — nulos, não erro."""
    book = hymn_book_factory(name="Novo", slug="novo", intro_name="", description="")

    data = gql(client, HYMNBOOK_QUERY, variables={"slug": book.slug})
    assert "errors" not in data, data
    row = data["data"]["hymnbook"]
    assert row["coverImage"] is None
    assert row["publishedAt"] is None
    assert row["publishedBy"] is None
    assert row["introName"] == ""
    assert row["description"] == ""


def test_hymnbook_cover_image_returns_url(client, hymn_book_factory, sample_image):
    book = hymn_book_factory(name="Com capa", slug="com-capa", cover_image=sample_image)

    data = gql(client, HYMNBOOK_QUERY, variables={"slug": book.slug})
    assert "errors" not in data, data
    cover = data["data"]["hymnbook"]["coverImage"]
    assert cover is not None
    assert cover == book.cover_image.url
    assert "hymn_covers/" in cover
