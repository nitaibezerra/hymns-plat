"""
Marco 1.4 — progresso de revisão de HymnBook.

`review_progress` retorna o dicionário {total, reviewed, in_review, pct} com
contagens dos hinos. `is_fully_reviewed` é True quando todos os hinos estão
no estado REVIEWED. O endpoint de publicação fica bloqueado até esta
condição ser atendida.
"""

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse

from apps.hymns.models import Hymn, HymnBook


def _make_editor(user):
    user.groups.add(Group.objects.get(name="editor"))
    return user


def _set_status(hymn, status):
    Hymn.objects.filter(pk=hymn.pk).update(review_status=status)


@pytest.mark.django_db
class TestReviewProgressProperty:
    def test_zero_when_no_hymns(self, hymn_book_factory):
        hb = hymn_book_factory(name="Vazio")
        progress = hb.review_progress
        assert progress["total"] == 0
        assert progress["reviewed"] == 0
        assert progress["in_review"] == 0
        assert progress["pct"] == 0

    def test_counts_each_status(self, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="P")
        h1 = hymn_factory(hymn_book=hb, number=1)
        h2 = hymn_factory(hymn_book=hb, number=2, title="t2")
        h3 = hymn_factory(hymn_book=hb, number=3, title="t3")
        hymn_factory(hymn_book=hb, number=4, title="t4")
        _set_status(h1, Hymn.ReviewStatus.REVIEWED)
        _set_status(h2, Hymn.ReviewStatus.REVIEWED)
        _set_status(h3, Hymn.ReviewStatus.IN_REVIEW)
        # h4 fica NOT_REVIEWED
        progress = hb.review_progress
        assert progress["total"] == 4
        assert progress["reviewed"] == 2
        assert progress["in_review"] == 1
        assert progress["pct"] == 50

    def test_pct_is_100_when_all_reviewed(self, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Done")
        for i in range(1, 4):
            h = hymn_factory(hymn_book=hb, number=i, title=f"t{i}")
            _set_status(h, Hymn.ReviewStatus.REVIEWED)
        assert hb.review_progress["pct"] == 100


@pytest.mark.django_db
class TestIsFullyReviewed:
    def test_false_when_no_hymns(self, hymn_book_factory):
        assert hymn_book_factory(name="Vazio").is_fully_reviewed is False

    def test_false_when_partial(self, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="P")
        a = hymn_factory(hymn_book=hb, number=1)
        hymn_factory(hymn_book=hb, number=2, title="t2")
        _set_status(a, Hymn.ReviewStatus.REVIEWED)
        assert hb.is_fully_reviewed is False

    def test_true_when_all_reviewed(self, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="P")
        for i in range(1, 3):
            h = hymn_factory(hymn_book=hb, number=i, title=f"t{i}")
            _set_status(h, Hymn.ReviewStatus.REVIEWED)
        assert hb.is_fully_reviewed is True


@pytest.mark.django_db
class TestWithReviewProgressAnnotation:
    def test_annotates_counts(self, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="P")
        a = hymn_factory(hymn_book=hb, number=1)
        hymn_factory(hymn_book=hb, number=2, title="t2")
        _set_status(a, Hymn.ReviewStatus.REVIEWED)

        annotated = HymnBook.objects.with_review_progress().get(pk=hb.pk)
        assert annotated.total_hymns == 2
        assert annotated.reviewed_hymns == 1
        assert annotated.review_pct == 50

    def test_zero_for_empty_book(self, hymn_book_factory):
        hb = hymn_book_factory(name="Vazio")
        annotated = HymnBook.objects.with_review_progress().get(pk=hb.pk)
        assert annotated.total_hymns == 0
        assert annotated.review_pct == 0


@pytest.mark.django_db
class TestPublishBlockedUntilFullyReviewed:
    def test_publish_blocked_when_not_fully_reviewed(self, authenticated_client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Pendente", owner_user=authenticated_client.user, is_published=False)
        a = hymn_factory(hymn_book=hb, number=1)
        hymn_factory(hymn_book=hb, number=2, title="t2")
        _set_status(a, Hymn.ReviewStatus.REVIEWED)

        url = reverse("hymns:hymnbook_publish", kwargs={"slug": hb.slug})
        authenticated_client.post(url)
        hb.refresh_from_db()
        assert hb.is_published is False

    def test_publish_blocked_when_no_hymns(self, authenticated_client, hymn_book_factory):
        hb = hymn_book_factory(name="Vazio", owner_user=authenticated_client.user, is_published=False)
        url = reverse("hymns:hymnbook_publish", kwargs={"slug": hb.slug})
        authenticated_client.post(url)
        hb.refresh_from_db()
        assert hb.is_published is False

    def test_publish_allowed_when_fully_reviewed(self, editor_client, hymn_book_factory, hymn_factory):
        # Política "editor-only": somente Editores/Admins publicam.
        # `publish_readiness` exige `owner_user` definido — apontamos para o próprio editor.
        from apps.hymns.models import HymnRevision

        hb = hymn_book_factory(
            name="Pronto",
            owner_user=editor_client.user,
            is_published=False,
            description="d",
        )
        for i in range(1, 3):
            h = hymn_factory(hymn_book=hb, number=i, title=f"t{i}")
            _set_status(h, Hymn.ReviewStatus.REVIEWED)
            HymnRevision.objects.create(hymn=h, revised_by=editor_client.user)
        url = reverse("hymns:hymnbook_publish", kwargs={"slug": hb.slug})
        editor_client.post(url)
        hb.refresh_from_db()
        assert hb.is_published is True
