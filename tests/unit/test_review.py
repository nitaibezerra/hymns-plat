"""
Marco 1.3 — estado de revisão por Hino + auditoria via HymnRevision.

Cada Hymn carrega um `review_status` (NOT_REVIEWED / IN_REVIEW / REVIEWED) e
um `source` (MANUAL / OCR / YAML). Toda mudança em campos relevantes ou no
status gera uma `HymnRevision` via signal — é a trilha de auditoria do
trabalho editorial.
"""

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse

from apps.hymns.models import Hymn, HymnRevision


def _make_editor(user):
    user.groups.add(Group.objects.get(name="editor"))
    return user


@pytest.mark.django_db
class TestHymnReviewFields:
    def test_default_review_status_is_not_reviewed(self, hymn):
        assert hymn.review_status == Hymn.ReviewStatus.NOT_REVIEWED

    def test_default_source_is_manual(self, hymn):
        assert hymn.source == Hymn.Source.MANUAL

    def test_default_last_reviewed_fields_are_null(self, hymn):
        assert hymn.last_reviewed_at is None
        assert hymn.last_reviewed_by is None


@pytest.mark.django_db
class TestHymnRevisionSignal:
    def test_no_revision_created_on_initial_insert(self, hymn_book):
        Hymn.objects.create(hymn_book=hymn_book, number=1, title="x", text="y")
        assert HymnRevision.objects.count() == 0

    def test_revision_created_when_text_changes(self, hymn):
        hymn.text = "novo texto"
        hymn.save()
        assert HymnRevision.objects.filter(hymn=hymn).count() == 1
        rev = HymnRevision.objects.get(hymn=hymn)
        assert "text" in rev.field_diff
        assert rev.field_diff["text"]["new"] == "novo texto"

    def test_revision_created_when_status_changes(self, hymn, user_factory):
        user = user_factory(email="rev@example.com")
        hymn.review_status = Hymn.ReviewStatus.REVIEWED
        hymn.last_reviewed_by = user
        hymn.save()
        rev = HymnRevision.objects.get(hymn=hymn)
        assert rev.previous_status == Hymn.ReviewStatus.NOT_REVIEWED
        assert rev.new_status == Hymn.ReviewStatus.REVIEWED

    def test_no_revision_when_only_unrelated_field_changes(self, hymn):
        # `updated_at` é tocado pelo Django mas não conta como mudança editorial.
        hymn.save()
        assert HymnRevision.objects.filter(hymn=hymn).count() == 0

    def test_loaddata_does_not_create_revisions(self, hymn_book):
        from django.core.serializers import serialize
        from django.core.serializers.python import Deserializer

        hymn = Hymn.objects.create(hymn_book=hymn_book, number=2, title="orig", text="t")
        # Limpa o counter
        HymnRevision.objects.all().delete()
        # Simula loaddata mudando texto e re-deserializando com raw=True
        serialized = serialize("python", [hymn])
        serialized[0]["fields"]["text"] = "outro"
        for obj in Deserializer(serialized):
            obj.save()
        assert HymnRevision.objects.count() == 0

    def test_revision_records_user(self, hymn, user_factory):
        user = user_factory(email="me@example.com")
        hymn.text = "x"
        hymn.last_reviewed_by = user
        hymn.save()
        rev = HymnRevision.objects.get(hymn=hymn)
        assert rev.revised_by == user


@pytest.mark.django_db
class TestReviseHymnView:
    def test_requires_login(self, client, hymn):
        url = reverse("hymns:hymn_revise", kwargs={"pk": hymn.pk})
        resp = client.post(url, {"title": "x", "text": "y"})
        assert resp.status_code == 302
        assert "/accounts/login" in resp.url

    def test_random_user_forbidden(self, authenticated_client, hymn):
        url = reverse("hymns:hymn_revise", kwargs={"pk": hymn.pk})
        resp = authenticated_client.post(
            url, {"title": "x", "text": "y", "review_status": Hymn.ReviewStatus.REVIEWED}
        )
        # redireciona sem mexer no hino
        hymn.refresh_from_db()
        assert hymn.review_status == Hymn.ReviewStatus.NOT_REVIEWED

    def test_owner_can_revise(self, authenticated_client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Meu", owner_user=authenticated_client.user)
        h = hymn_factory(hymn_book=hb, number=1, title="orig", text="orig")
        url = reverse("hymns:hymn_revise", kwargs={"pk": h.pk})
        resp = authenticated_client.post(
            url,
            {
                "number": 1,
                "title": "novo",
                "text": "novo texto",
                "review_status": Hymn.ReviewStatus.REVIEWED,
            },
        )
        assert resp.status_code == 302
        h.refresh_from_db()
        assert h.title == "novo"
        assert h.review_status == Hymn.ReviewStatus.REVIEWED
        assert h.last_reviewed_by == authenticated_client.user
        assert h.last_reviewed_at is not None

    def test_editor_can_revise_any(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="Alheio")
        h = hymn_factory(hymn_book=hb, number=1, title="o", text="o")
        url = reverse("hymns:hymn_revise", kwargs={"pk": h.pk})
        authenticated_client.post(
            url,
            {
                "number": 1,
                "title": "n",
                "text": "n",
                "review_status": Hymn.ReviewStatus.REVIEWED,
            },
        )
        h.refresh_from_db()
        assert h.review_status == Hymn.ReviewStatus.REVIEWED


@pytest.mark.django_db
class TestImportYamlMarkReviewedFlag:
    def test_yaml_import_default_not_reviewed(self, sample_yaml_valid):
        from django.core.management import call_command

        call_command("import_yaml", sample_yaml_valid)
        for h in Hymn.objects.all():
            assert h.review_status == Hymn.ReviewStatus.NOT_REVIEWED
            assert h.source == Hymn.Source.YAML

    def test_yaml_import_with_mark_reviewed_flag(self, sample_yaml_valid):
        from django.core.management import call_command

        call_command("import_yaml", sample_yaml_valid, "--mark-reviewed")
        for h in Hymn.objects.all():
            assert h.review_status == Hymn.ReviewStatus.REVIEWED
            assert h.source == Hymn.Source.YAML
