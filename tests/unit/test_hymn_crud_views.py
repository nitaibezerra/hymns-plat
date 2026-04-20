"""
Testes de views CRUD para Hymn (create, edit, delete via web).
"""

import pytest
from django.urls import reverse

from apps.hymns.models import Hymn


@pytest.mark.django_db
class TestHymnCreateView:
    def test_requires_login(self, client, hymn_book):
        url = reverse("hymns:hymn_create", kwargs={"slug": hymn_book.slug})
        resp = client.get(url)
        assert resp.status_code == 302

    def test_forbidden_for_non_owner(self, authenticated_client, hymn_book):
        url = reverse("hymns:hymn_create", kwargs={"slug": hymn_book.slug})
        resp = authenticated_client.get(url)
        assert resp.status_code == 302
        assert resp.url == reverse("hymns:hymnbook_detail", kwargs={"slug": hymn_book.slug})

    def test_get_renders_form_for_owner(self, authenticated_client, hymn_book_factory):
        hb = hymn_book_factory(name="Meu", owner_user=authenticated_client.user)
        url = reverse("hymns:hymn_create", kwargs={"slug": hb.slug})
        resp = authenticated_client.get(url)
        assert resp.status_code == 200

    def test_post_creates_hymn(self, authenticated_client, hymn_book_factory):
        hb = hymn_book_factory(name="Para Hino", owner_user=authenticated_client.user)
        url = reverse("hymns:hymn_create", kwargs={"slug": hb.slug})
        resp = authenticated_client.post(
            url,
            {"number": 1, "title": "Hino Novo", "text": "Letra do hino"},
        )
        assert resp.status_code == 302
        hymn = Hymn.objects.get(hymn_book=hb, number=1)
        assert hymn.title == "Hino Novo"
        assert resp.url == reverse("hymns:hymn_detail", kwargs={"pk": hymn.pk})

    def test_post_rejects_duplicate_number(self, authenticated_client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="With Existing", owner_user=authenticated_client.user)
        hymn_factory(hymn_book=hb, number=5)
        url = reverse("hymns:hymn_create", kwargs={"slug": hb.slug})
        resp = authenticated_client.post(
            url,
            {"number": 5, "title": "Dup", "text": "x"},
        )
        assert resp.status_code == 200
        assert Hymn.objects.filter(hymn_book=hb, number=5).count() == 1


@pytest.mark.django_db
class TestHymnEditView:
    def test_requires_login(self, client, hymn):
        url = reverse("hymns:hymn_edit", kwargs={"pk": hymn.pk})
        resp = client.get(url)
        assert resp.status_code == 302

    def test_forbidden_for_non_owner(self, authenticated_client, hymn):
        url = reverse("hymns:hymn_edit", kwargs={"pk": hymn.pk})
        resp = authenticated_client.get(url)
        assert resp.status_code == 302
        assert resp.url == reverse("hymns:hymn_detail", kwargs={"pk": hymn.pk})

    def test_allowed_for_owner(self, authenticated_client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Mine", owner_user=authenticated_client.user)
        h = hymn_factory(hymn_book=hb)
        url = reverse("hymns:hymn_edit", kwargs={"pk": h.pk})
        resp = authenticated_client.get(url)
        assert resp.status_code == 200

    def test_allowed_for_superuser(self, admin_client, hymn):
        url = reverse("hymns:hymn_edit", kwargs={"pk": hymn.pk})
        resp = admin_client.get(url)
        assert resp.status_code == 200

    def test_post_updates_hymn(self, authenticated_client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Mine2", owner_user=authenticated_client.user)
        h = hymn_factory(hymn_book=hb, number=3, title="Old", text="old")
        url = reverse("hymns:hymn_edit", kwargs={"pk": h.pk})
        resp = authenticated_client.post(
            url,
            {"number": 3, "title": "New Title", "text": "new text"},
        )
        assert resp.status_code == 302
        h.refresh_from_db()
        assert h.title == "New Title"
        assert h.text == "new text"


@pytest.mark.django_db
class TestHymnDeleteView:
    def test_requires_login(self, client, hymn):
        url = reverse("hymns:hymn_delete", kwargs={"pk": hymn.pk})
        resp = client.get(url)
        assert resp.status_code == 302

    def test_forbidden_for_non_owner(self, authenticated_client, hymn):
        url = reverse("hymns:hymn_delete", kwargs={"pk": hymn.pk})
        resp = authenticated_client.post(url)
        assert resp.status_code == 302
        assert Hymn.objects.filter(pk=hymn.pk).exists()

    def test_get_shows_confirmation(self, authenticated_client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="X", owner_user=authenticated_client.user)
        h = hymn_factory(hymn_book=hb)
        url = reverse("hymns:hymn_delete", kwargs={"pk": h.pk})
        resp = authenticated_client.get(url)
        assert resp.status_code == 200

    def test_post_deletes_hymn_and_redirects(self, authenticated_client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Y", owner_user=authenticated_client.user)
        h = hymn_factory(hymn_book=hb, number=1)
        url = reverse("hymns:hymn_delete", kwargs={"pk": h.pk})
        resp = authenticated_client.post(url)
        assert resp.status_code == 302
        assert resp.url == reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug})
        assert not Hymn.objects.filter(pk=h.pk).exists()
