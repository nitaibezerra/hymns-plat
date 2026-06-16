"""
Marco 5.A — Ciclos 5A.7 a 5A.9.

Mutations CRUD de Hymn: criar (com gating), deletar, revisão ágil (style +
repetitions). O `update_hymn` do Marco 2 já cobre edição genérica;
`quickReviewHymn` é uma view especializada que mantém `review_status`
imutável (paridade com `editor_quick_review`).
"""

from __future__ import annotations

import pytest

from apps.hymns.models import Hymn, HymnRevision

from ._helpers import gql

pytestmark = pytest.mark.django_db


# ---------- Ciclo 5A.7 — createHymn ----------

CREATE_MUTATION = """
mutation($slug: String!, $input: HymnInput!) {
  createHymn(hymnbookSlug: $slug, input: $input) {
    __typename
    ... on HymnType { id number title }
    ... on PermissionDeniedError { message }
    ... on NotFoundError { message }
    ... on ValidationError { message field }
  }
}
"""


def test_create_hymn_editor_succeeds(editor_client, hymn_book_factory):
    hb = hymn_book_factory(name="Pai", slug="pai")
    data = gql(
        editor_client,
        CREATE_MUTATION,
        variables={
            "slug": hb.slug,
            "input": {"number": 1, "title": "Primeiro", "text": "Letra"},
        },
    )
    assert "errors" not in data, data
    result = data["data"]["createHymn"]
    assert result["__typename"] == "HymnType"
    assert result["number"] == 1
    assert result["title"] == "Primeiro"
    assert Hymn.objects.filter(hymn_book=hb, number=1).exists()


def test_create_hymn_validates_number_unique(editor_client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory(name="Pai2", slug="pai2")
    hymn_factory(hymn_book=hb, number=1, title="Existente")

    data = gql(
        editor_client,
        CREATE_MUTATION,
        variables={
            "slug": hb.slug,
            "input": {"number": 1, "title": "Duplicado", "text": "X"},
        },
    )
    assert "errors" not in data, data
    result = data["data"]["createHymn"]
    assert result["__typename"] == "ValidationError"
    assert result["field"] == "number"


def test_create_hymn_non_editor_blocked(authenticated_client, hymn_book_factory):
    hb = hymn_book_factory(name="Bloqueado", slug="bloqueado")
    data = gql(
        authenticated_client,
        CREATE_MUTATION,
        variables={
            "slug": hb.slug,
            "input": {"number": 1, "title": "Hacker", "text": "X"},
        },
    )
    assert "errors" not in data, data
    assert data["data"]["createHymn"]["__typename"] == "PermissionDeniedError"
    assert not Hymn.objects.filter(hymn_book=hb).exists()
