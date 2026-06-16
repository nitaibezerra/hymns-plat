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


# ---------- Ciclo 5A.8 — deleteHymn ----------

DELETE_HYMN_MUTATION = """
mutation($pk: ID!) {
  deleteHymn(pk: $pk) {
    __typename
    ... on DeleteResult { ok deletedId }
    ... on PermissionDeniedError { message }
    ... on NotFoundError { message }
  }
}
"""


def test_delete_hymn_editor_succeeds(editor_client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory(name="X", slug="x")
    h = hymn_factory(hymn_book=hb)
    pk = str(h.pk)
    data = gql(editor_client, DELETE_HYMN_MUTATION, variables={"pk": pk})
    assert "errors" not in data, data
    result = data["data"]["deleteHymn"]
    assert result["__typename"] == "DeleteResult"
    assert result["ok"] is True
    assert result["deletedId"] == pk
    assert not Hymn.objects.filter(pk=pk).exists()


def test_delete_hymn_non_editor_blocked(authenticated_client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory(name="Y", slug="y")
    h = hymn_factory(hymn_book=hb)
    data = gql(authenticated_client, DELETE_HYMN_MUTATION, variables={"pk": str(h.pk)})
    assert "errors" not in data, data
    assert data["data"]["deleteHymn"]["__typename"] == "PermissionDeniedError"
    assert Hymn.objects.filter(pk=h.pk).exists()


# ---------- Ciclo 5A.9 — quickReviewHymn ----------

QUICK_REVIEW_MUTATION = """
mutation($pk: ID!, $style: String!, $repetitions: String!) {
  quickReviewHymn(pk: $pk, style: $style, repetitions: $repetitions) {
    __typename
    ... on HymnType { id style repetitions reviewStatus }
    ... on PermissionDeniedError { message }
    ... on NotFoundError { message }
    ... on ValidationError { message field }
  }
}
"""


def test_quick_review_hymn_updates_style_repetitions(editor_client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory(name="QR", slug="qr")
    h = hymn_factory(hymn_book=hb, style="", repetitions="")
    data = gql(
        editor_client,
        QUICK_REVIEW_MUTATION,
        variables={"pk": str(h.pk), "style": "Marcha", "repetitions": "1-2,3-4"},
    )
    assert "errors" not in data, data
    result = data["data"]["quickReviewHymn"]
    assert result["__typename"] == "HymnType"
    assert result["style"] == "Marcha"
    assert result["repetitions"] == "1-2,3-4"
    h.refresh_from_db()
    assert h.style == "Marcha"
    assert h.repetitions == "1-2,3-4"


def test_quick_review_does_not_touch_review_status(editor_client, hymn_book_factory, hymn_factory):
    """Paridade com editor_quick_review: review_status fica imutável aqui."""
    hb = hymn_book_factory(name="QR2", slug="qr2")
    h = hymn_factory(hymn_book=hb)
    assert h.review_status == Hymn.ReviewStatus.NOT_REVIEWED

    data = gql(
        editor_client,
        QUICK_REVIEW_MUTATION,
        variables={"pk": str(h.pk), "style": "Valsa", "repetitions": "1-4"},
    )
    assert "errors" not in data, data
    assert data["data"]["quickReviewHymn"]["reviewStatus"] == "NOT_REVIEWED"
    h.refresh_from_db()
    assert h.review_status == Hymn.ReviewStatus.NOT_REVIEWED


def test_quick_review_creates_revision_signal(editor_client, hymn_book_factory, hymn_factory):
    """Signal _create_hymn_revision_on_edit grava HymnRevision automaticamente
    quando style/repetitions mudam — não precisa criar manualmente."""
    hb = hymn_book_factory(name="QR3", slug="qr3")
    h = hymn_factory(hymn_book=hb, style="", repetitions="")
    before = HymnRevision.objects.filter(hymn=h).count()

    gql(
        editor_client,
        QUICK_REVIEW_MUTATION,
        variables={"pk": str(h.pk), "style": "Mazurca", "repetitions": "3-4,1-4"},
    )
    after = HymnRevision.objects.filter(hymn=h).count()
    assert after == before + 1, "signal devia ter gravado uma HymnRevision"
    rev = HymnRevision.objects.filter(hymn=h).order_by("-revised_at").first()
    assert "style" in rev.field_diff or "repetitions" in rev.field_diff
