"""
Marco 5.A½ · Tarefa B5 — metadados de revisão do hino.

`lastReviewedAt`, `lastReviewedBy` e `receivedAt` são lidos pelas telas de
revisão (cabeçalho "revisado por X em Y" e o campo "Recebido em") e não
existiam no schema.
"""

from __future__ import annotations

import datetime

import pytest
from django.utils import timezone

from apps.hymns.models import Hymn

from ._helpers import gql

pytestmark = pytest.mark.django_db


HYMN_QUERY = """
query($pk: ID!) {
  hymn(pk: $pk) {
    receivedAt
    lastReviewedAt
    lastReviewedBy { username }
  }
}
"""


def test_review_metadata_null_when_never_reviewed(client, hymn):
    data = gql(client, HYMN_QUERY, variables={"pk": str(hymn.pk)})
    assert "errors" not in data, data
    row = data["data"]["hymn"]
    assert row == {"receivedAt": None, "lastReviewedAt": None, "lastReviewedBy": None}


def test_received_at_is_exposed_as_date(client, hymn_book, hymn_factory):
    hymn = hymn_factory(hymn_book=hymn_book, number=9, received_at=datetime.date(1930, 7, 15))
    data = gql(client, HYMN_QUERY, variables={"pk": str(hymn.pk)})
    assert "errors" not in data, data
    assert data["data"]["hymn"]["receivedAt"] == "1930-07-15"


def test_last_reviewed_at_and_by_are_exposed(editor_client, hymn):
    moment = timezone.now()
    hymn.review_status = Hymn.ReviewStatus.REVIEWED
    hymn.last_reviewed_at = moment
    hymn.last_reviewed_by = editor_client.user
    hymn.save()

    data = gql(editor_client, HYMN_QUERY, variables={"pk": str(hymn.pk)})
    assert "errors" not in data, data
    row = data["data"]["hymn"]
    assert row["lastReviewedBy"] == {"username": editor_client.user.username}
    assert row["lastReviewedAt"] is not None
    assert row["lastReviewedAt"].startswith(moment.date().isoformat())
