"""
Marco 1 — Ciclo 1.8.

`globalStats` GraphQL precisa ter paridade exata com o JSON endpoint
`/api/stats/` (apps.hymns.api_views.api_global_stats). É o mesmo cálculo;
mover pra GraphQL sem regressão é o objetivo.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.hymns.models import HymnAudio, HymnRevision

from ._helpers import gql

pytestmark = pytest.mark.django_db


def test_global_stats_returns_zero_when_empty(client):
    data = gql(client, "{ globalStats { hymnbooks hymns audios activeReviewers } }")
    assert "errors" not in data, data
    assert data["data"]["globalStats"] == {
        "hymnbooks": 0,
        "hymns": 0,
        "audios": 0,
        "activeReviewers": 0,
    }


def test_global_stats_counts_published_only(client, hymn_book_factory, hymn_factory):
    pub = hymn_book_factory(name="Pub", slug="pub", is_published=True)
    draft = hymn_book_factory(name="Draft", slug="draft", is_published=False)
    hymn_factory(hymn_book=pub, number=1, title="A")
    hymn_factory(hymn_book=pub, number=2, title="B")
    hymn_factory(hymn_book=draft, number=1, title="C")

    data = gql(client, "{ globalStats { hymnbooks hymns } }")
    assert data["data"]["globalStats"]["hymnbooks"] == 1
    assert data["data"]["globalStats"]["hymns"] == 2  # só do publicado


def test_global_stats_counts_approved_audios_only(client, hymn_book_factory, hymn_factory, user_factory):
    hb = hymn_book_factory(is_published=True)
    h = hymn_factory(hymn_book=hb)
    u = user_factory()
    HymnAudio.objects.create(hymn=h, uploaded_by=u, is_approved=True)
    HymnAudio.objects.create(hymn=h, uploaded_by=u, is_approved=False)

    data = gql(client, "{ globalStats { audios } }")
    assert data["data"]["globalStats"]["audios"] == 1


def test_global_stats_counts_active_reviewers_last_30d(client, hymn_book_factory, hymn_factory, user_factory):
    hb = hymn_book_factory(is_published=True)
    h = hymn_factory(hymn_book=hb)
    u1 = user_factory(email="r1@example.com")
    u2 = user_factory(email="r2@example.com")
    u_old = user_factory(email="rold@example.com")

    HymnRevision.objects.create(hymn=h, revised_by=u1, revised_at=timezone.now())
    HymnRevision.objects.create(hymn=h, revised_by=u2, revised_at=timezone.now())
    rev_old = HymnRevision.objects.create(hymn=h, revised_by=u_old)
    HymnRevision.objects.filter(pk=rev_old.pk).update(revised_at=timezone.now() - timedelta(days=31))

    data = gql(client, "{ globalStats { activeReviewers } }")
    assert data["data"]["globalStats"]["activeReviewers"] == 2
