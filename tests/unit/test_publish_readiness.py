"""
Marco 2.0.5 — `publish_readiness(hymnbook)` retorna lista de critérios para
o modal "Publicar?". A view de publicação consome essa função, bloqueando se
algum check falhar.
"""

import pytest
from django.urls import reverse

from apps.hymns.models import Hymn, HymnRevision
from apps.hymns.services.review import publish_readiness


def _set_status(hymn, status):
    Hymn.objects.filter(pk=hymn.pk).update(review_status=status)


@pytest.mark.django_db
class TestPublishReadinessFunction:
    def test_all_ok_when_meets_all_criteria(self, hymn_book_factory, hymn_factory, user_factory):
        owner = user_factory(email="o@example.com")
        hb = hymn_book_factory(
            name="Pronto",
            owner_user=owner,
            description="completo",
            is_published=False,
        )
        h = hymn_factory(hymn_book=hb, number=1)
        _set_status(h, Hymn.ReviewStatus.REVIEWED)
        # registra um revisor
        HymnRevision.objects.create(hymn=h, revised_by=owner)

        report = publish_readiness(hb)
        assert report["can_publish"] is True
        assert all(c["ok"] for c in report["checks"])

    def test_fails_when_hymns_not_fully_reviewed(self, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Falta revisar")
        hymn_factory(hymn_book=hb, number=1)
        report = publish_readiness(hb)
        assert report["can_publish"] is False
        labels = {(c["label"], c["ok"]) for c in report["checks"]}
        # check de revisão completo deve estar ok=False
        assert any("revisado" in label.lower() and not ok for label, ok in labels)

    def test_fails_when_no_owner_user(self, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Sem dono", owner_user=None)
        h = hymn_factory(hymn_book=hb, number=1)
        _set_status(h, Hymn.ReviewStatus.REVIEWED)
        report = publish_readiness(hb)
        # check "Dono identificado" deve falhar
        assert any("dono" in c["label"].lower() and not c["ok"] for c in report["checks"])
        assert report["can_publish"] is False

    def test_fails_when_no_description(self, hymn_book_factory, hymn_factory, user_factory):
        owner = user_factory(email="o@example.com")
        hb = hymn_book_factory(name="Sem descricao", owner_user=owner, description="")
        h = hymn_factory(hymn_book=hb, number=1)
        _set_status(h, Hymn.ReviewStatus.REVIEWED)
        report = publish_readiness(hb)
        assert any("descrição" in c["label"].lower() and not c["ok"] for c in report["checks"])

    def test_reports_reviewer_count(self, hymn_book_factory, hymn_factory, user_factory):
        owner = user_factory(email="o@example.com")
        u2 = user_factory(email="b@example.com")
        hb = hymn_book_factory(name="X", owner_user=owner, description="d")
        h = hymn_factory(hymn_book=hb, number=1)
        _set_status(h, Hymn.ReviewStatus.REVIEWED)
        HymnRevision.objects.create(hymn=h, revised_by=owner)
        HymnRevision.objects.create(hymn=h, revised_by=u2)
        report = publish_readiness(hb)
        assert report["reviewer_count"] == 2


@pytest.mark.django_db
class TestPublishCheckEndpoint:
    def test_returns_json_with_checks(self, editor_client, hymn_book_factory):
        # Endpoint exige permissão de publicar — usa fixture de editor.
        hb = hymn_book_factory(name="Z", is_published=False)
        url = reverse("hymns:hymnbook_publish_check", kwargs={"slug": hb.slug})
        resp = editor_client.get(url)
        assert resp.status_code == 200
        data = resp.json()
        assert "checks" in data
        assert "can_publish" in data
