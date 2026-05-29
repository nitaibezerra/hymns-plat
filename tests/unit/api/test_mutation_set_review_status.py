"""
Marco 2 — Ciclo 2.4.

Mutation `setReviewStatus(pk, status)` muda o status de revisão de um hino e
dispara o signal `pre_save`/`post_save` que cria uma `HymnRevision`. Regras de
permissão reusadas de `apps.hymns.permissions._is_editor_or_admin`.
"""

from __future__ import annotations

import pytest

from apps.hymns.models import Hymn, HymnRevision

from ._helpers import gql

pytestmark = pytest.mark.django_db


MUTATION = """
mutation($pk: ID!, $status: ReviewStatus!) {
  setReviewStatus(pk: $pk, status: $status) {
    __typename
    ... on HymnType { id reviewStatus }
    ... on PermissionDeniedError { message }
  }
}
"""


def test_set_review_status_editor_succeeds(editor_client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory(is_published=True)
    h = hymn_factory(hymn_book=hb)
    assert h.review_status == Hymn.ReviewStatus.NOT_REVIEWED

    data = gql(editor_client, MUTATION, variables={"pk": str(h.pk), "status": "REVIEWED"})
    assert "errors" not in data, data
    result = data["data"]["setReviewStatus"]
    assert result["__typename"] == "HymnType"
    assert result["reviewStatus"] == "REVIEWED"

    h.refresh_from_db()
    assert h.review_status == Hymn.ReviewStatus.REVIEWED


def test_set_review_status_creates_revision(editor_client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory(is_published=True)
    h = hymn_factory(hymn_book=hb)
    revisions_before = HymnRevision.objects.filter(hymn=h).count()

    gql(editor_client, MUTATION, variables={"pk": str(h.pk), "status": "REVIEWED"})

    revisions_after = HymnRevision.objects.filter(hymn=h).count()
    assert revisions_after == revisions_before + 1, "signal deveria ter criado uma HymnRevision"


def test_set_review_status_blocks_anon(client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory(is_published=True)
    h = hymn_factory(hymn_book=hb)

    data = gql(client, MUTATION, variables={"pk": str(h.pk), "status": "REVIEWED"})
    assert "errors" not in data, data
    result = data["data"]["setReviewStatus"]
    assert result["__typename"] == "PermissionDeniedError"

    h.refresh_from_db()
    assert h.review_status == Hymn.ReviewStatus.NOT_REVIEWED


def test_set_review_status_blocks_regular_user(authenticated_client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory(is_published=True)
    h = hymn_factory(hymn_book=hb)

    data = gql(authenticated_client, MUTATION, variables={"pk": str(h.pk), "status": "REVIEWED"})
    assert "errors" not in data, data
    assert data["data"]["setReviewStatus"]["__typename"] == "PermissionDeniedError"
