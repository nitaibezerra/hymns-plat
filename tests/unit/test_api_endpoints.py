"""
Marco 2.0.3 — endpoints JSON consumidos pela UI da Fase 2.

Cobre rotas:
- GET /api/stats/global/
- GET /api/editor/resume/
- GET /api/users/<username>/heatmap/
- GET /api/hymns/<pk>/history/
- GET /api/hymns/<pk>/diff/
"""

import json
from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.hymns.models import Hymn, HymnRevision


@pytest.mark.django_db
class TestGlobalStatsEndpoint:
    def test_returns_published_counts(self, client, hymn_book_factory, hymn_factory):
        hb_pub = hymn_book_factory(name="Pub")
        hb_priv = hymn_book_factory(name="Priv", is_published=False)
        hymn_factory(hymn_book=hb_pub, number=1)
        hymn_factory(hymn_book=hb_priv, number=1, title="oculto")

        resp = client.get(reverse("hymns:api_global_stats"))
        assert resp.status_code == 200
        data = resp.json()
        assert data["hymnbooks"] == 1
        assert data["hymns"] == 1
        assert "active_reviewers" in data
        assert "audios" in data

    def test_active_reviewers_counts_recent_revisions(
        self, client, user_factory, hymn_book_factory, hymn_factory
    ):
        u1 = user_factory(email="u1@example.com")
        u2 = user_factory(email="u2@example.com")
        hb = hymn_book_factory(name="X")
        h = hymn_factory(hymn_book=hb, number=1)
        HymnRevision.objects.create(hymn=h, revised_by=u1)
        old = HymnRevision.objects.create(hymn=h, revised_by=u2)
        # auto_now_add ignora o argumento; force o timestamp pelo UPDATE.
        HymnRevision.objects.filter(pk=old.pk).update(
            revised_at=timezone.now() - timedelta(days=60)
        )
        resp = client.get(reverse("hymns:api_global_stats"))
        # u1 conta (recente), u2 não (>30 dias)
        assert resp.json()["active_reviewers"] == 1


@pytest.mark.django_db
class TestEditorResumeEndpoint:
    def test_requires_login(self, client):
        resp = client.get(reverse("hymns:api_editor_resume"))
        assert resp.status_code == 302  # @login_required redirects

    def test_returns_null_when_no_pending_review(self, authenticated_client):
        resp = authenticated_client.get(reverse("hymns:api_editor_resume"))
        assert resp.status_code == 200
        assert resp.json() == {"hymn": None}

    def test_returns_last_unreviewed_hymn_for_user(
        self, authenticated_client, hymn_book_factory, hymn_factory
    ):
        hb = hymn_book_factory(name="W", owner_user=authenticated_client.user)
        h = hymn_factory(hymn_book=hb, number=1, title="Sol da Manhã")
        # Simula uma revisão deixada incompleta (não REVIEWED)
        HymnRevision.objects.create(
            hymn=h,
            revised_by=authenticated_client.user,
            previous_status="not_reviewed",
            new_status="in_review",
        )
        resp = authenticated_client.get(reverse("hymns:api_editor_resume"))
        data = resp.json()
        assert data["hymn"]["pk"] == str(h.pk)
        assert data["hymn"]["title"] == "Sol da Manhã"
        assert data["hymn"]["hymnbook_slug"] == hb.slug


@pytest.mark.django_db
class TestUserHeatmapEndpoint:
    def test_returns_per_day_counts_last_year(
        self, client, user_factory, hymn_book_factory, hymn_factory
    ):
        u = user_factory(email="me@example.com")
        hb = hymn_book_factory(name="H")
        h = hymn_factory(hymn_book=hb, number=1)
        for _ in range(3):
            HymnRevision.objects.create(hymn=h, revised_by=u, revised_at=timezone.now())

        resp = client.get(reverse("users:api_user_heatmap", kwargs={"username": u.username}))
        assert resp.status_code == 200
        data = resp.json()
        assert "days" in data
        # último dia da lista deve ter 3
        last = data["days"][-1]
        assert last["count"] == 3

    def test_404_for_unknown_user(self, client):
        resp = client.get(reverse("users:api_user_heatmap", kwargs={"username": "ghost"}))
        assert resp.status_code == 404


@pytest.mark.django_db
class TestHymnHistoryEndpoint:
    def test_returns_revisions_in_descending_order(
        self, authenticated_client, hymn_book_factory, hymn_factory
    ):
        hb = hymn_book_factory(name="H", owner_user=authenticated_client.user)
        h = hymn_factory(hymn_book=hb, number=1, source=Hymn.Source.OCR)
        # source=OCR já cria 1 revisão inicial
        h.text = "novo"
        h.last_reviewed_by = authenticated_client.user
        h.save()

        resp = authenticated_client.get(
            reverse("hymns:api_hymn_history", kwargs={"pk": h.pk})
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["revisions"]) >= 2
        # Mais recente vem primeiro
        assert data["revisions"][0]["revised_at"] >= data["revisions"][1]["revised_at"]

    def test_includes_creation_event_for_ocr_hymn(
        self, authenticated_client, hymn_book_factory, hymn_factory
    ):
        hb = hymn_book_factory(name="H", owner_user=authenticated_client.user)
        h = hymn_factory(hymn_book=hb, number=1, source=Hymn.Source.OCR)
        resp = authenticated_client.get(
            reverse("hymns:api_hymn_history", kwargs={"pk": h.pk})
        )
        summaries = [r["change_summary"] for r in resp.json()["revisions"]]
        assert any("OCR" in s for s in summaries)


@pytest.mark.django_db
class TestHymnHistoryDrawer:
    """Marco 2.1.8 — drawer renderizado pelo backend."""

    def test_drawer_lists_revisions(self, authenticated_client, hymn_book_factory, hymn_factory):
        from django.contrib.auth.models import Group

        editor_group = Group.objects.get(name="editor")
        authenticated_client.user.groups.add(editor_group)
        hb = hymn_book_factory(name="X")
        h = hymn_factory(hymn_book=hb, number=1, source=Hymn.Source.OCR)
        # source=OCR já cria 1 revisão inicial
        url = reverse("hymns:hymn_history", kwargs={"pk": h.pk})
        resp = authenticated_client.get(url)
        assert resp.status_code == 200
        assert b"Hist" in resp.content

    def test_drawer_creation_event_for_ocr_hymn(
        self, authenticated_client, hymn_book_factory, hymn_factory
    ):
        from django.contrib.auth.models import Group

        editor_group = Group.objects.get(name="editor")
        authenticated_client.user.groups.add(editor_group)
        hb = hymn_book_factory(name="X")
        h = hymn_factory(hymn_book=hb, number=1, source=Hymn.Source.OCR)
        resp = authenticated_client.get(reverse("hymns:hymn_history", kwargs={"pk": h.pk}))
        assert b"OCR" in resp.content


@pytest.mark.django_db
class TestHymnDiffEndpoint:
    def test_returns_ocr_text_and_current_text(
        self, authenticated_client, hymn_book_factory, hymn_factory
    ):
        hb = hymn_book_factory(name="H", owner_user=authenticated_client.user)
        h = hymn_factory(
            hymn_book=hb,
            number=1,
            text="atual",
            ocr_text="OCR cru",
            ocr_avg_confidence=88.0,
        )
        resp = authenticated_client.get(
            reverse("hymns:api_hymn_diff", kwargs={"pk": h.pk})
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["ocr_text"] == "OCR cru"
        assert data["current_text"] == "atual"
        assert data["avg_confidence"] == 88.0
