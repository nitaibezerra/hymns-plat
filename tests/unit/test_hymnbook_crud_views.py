"""
Testes de views CRUD para HymnBook (create, edit, delete via web).
"""

import pytest
from django.urls import reverse

from apps.hymns.models import HymnBook


@pytest.mark.django_db
class TestHymnBookCreateView:
    def test_get_requires_login(self, client):
        url = reverse("hymns:hymnbook_create")
        resp = client.get(url)
        assert resp.status_code == 302
        assert "/accounts/login/" in resp.url

    def test_get_renders_form(self, authenticated_client):
        url = reverse("hymns:hymnbook_create")
        resp = authenticated_client.get(url)
        assert resp.status_code == 200
        assert b"form" in resp.content.lower()

    def test_post_creates_hymnbook_with_owner(self, authenticated_client):
        url = reverse("hymns:hymnbook_create")
        resp = authenticated_client.post(
            url,
            {"name": "Novo Hinário", "owner_name": "Dono Novo", "intro_name": "", "description": ""},
        )
        assert resp.status_code == 302
        hb = HymnBook.objects.get(name="Novo Hinário")
        assert hb.owner_user == authenticated_client.user
        assert resp.url == reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug})

    def test_post_invalid_shows_errors(self, authenticated_client):
        url = reverse("hymns:hymnbook_create")
        resp = authenticated_client.post(url, {"name": "", "owner_name": ""})
        assert resp.status_code == 200
        assert HymnBook.objects.filter(owner_name="").count() == 0


@pytest.mark.django_db
class TestHymnBookEditView:
    def test_requires_login(self, client, hymn_book):
        url = reverse("hymns:hymnbook_edit", kwargs={"slug": hymn_book.slug})
        resp = client.get(url)
        assert resp.status_code == 302
        assert "/accounts/login/" in resp.url

    def test_forbidden_for_non_owner(self, authenticated_client, hymn_book):
        # hymn_book.owner_user is None, user is not superuser → forbidden
        url = reverse("hymns:hymnbook_edit", kwargs={"slug": hymn_book.slug})
        resp = authenticated_client.get(url)
        assert resp.status_code == 302
        assert resp.url == reverse("hymns:hymnbook_detail", kwargs={"slug": hymn_book.slug})

    def test_allowed_for_owner(self, authenticated_client, hymn_book_factory):
        hb = hymn_book_factory(name="Meu Hinário", owner_user=authenticated_client.user)
        url = reverse("hymns:hymnbook_edit", kwargs={"slug": hb.slug})
        resp = authenticated_client.get(url)
        assert resp.status_code == 200

    def test_allowed_for_superuser_even_without_owner(self, admin_client, hymn_book):
        url = reverse("hymns:hymnbook_edit", kwargs={"slug": hymn_book.slug})
        resp = admin_client.get(url)
        assert resp.status_code == 200

    def test_post_updates_fields(self, authenticated_client, hymn_book_factory):
        hb = hymn_book_factory(name="Antes", owner_user=authenticated_client.user)
        url = reverse("hymns:hymnbook_edit", kwargs={"slug": hb.slug})
        resp = authenticated_client.post(
            url,
            {"name": "Depois", "owner_name": hb.owner_name, "intro_name": "", "description": "desc"},
        )
        assert resp.status_code == 302
        hb.refresh_from_db()
        assert hb.name == "Depois"
        assert hb.description == "desc"


@pytest.mark.django_db
class TestHymnBookDeleteView:
    def test_requires_login(self, client, hymn_book):
        url = reverse("hymns:hymnbook_delete", kwargs={"slug": hymn_book.slug})
        resp = client.get(url)
        assert resp.status_code == 302

    def test_forbidden_for_non_owner(self, authenticated_client, hymn_book):
        url = reverse("hymns:hymnbook_delete", kwargs={"slug": hymn_book.slug})
        resp = authenticated_client.post(url)
        assert resp.status_code == 302
        assert HymnBook.objects.filter(pk=hymn_book.pk).exists()

    def test_get_shows_confirmation(self, authenticated_client, hymn_book_factory):
        hb = hymn_book_factory(name="Del Confirm", owner_user=authenticated_client.user)
        url = reverse("hymns:hymnbook_delete", kwargs={"slug": hb.slug})
        resp = authenticated_client.get(url)
        assert resp.status_code == 200

    def test_post_removes_hymnbook(self, authenticated_client, hymn_book_factory):
        hb = hymn_book_factory(name="Will Delete", owner_user=authenticated_client.user)
        url = reverse("hymns:hymnbook_delete", kwargs={"slug": hb.slug})
        resp = authenticated_client.post(url)
        assert resp.status_code == 302
        assert resp.url == reverse("hymns:hymnbook_list")
        assert not HymnBook.objects.filter(pk=hb.pk).exists()

    def test_post_cascades_to_hymns(self, authenticated_client, hymn_book_factory, hymn_factory):
        from apps.hymns.models import Hymn

        hb = hymn_book_factory(name="With Hymns", owner_user=authenticated_client.user)
        hymn_factory(hymn_book=hb, number=1)
        hymn_factory(hymn_book=hb, number=2)
        url = reverse("hymns:hymnbook_delete", kwargs={"slug": hb.slug})
        authenticated_client.post(url)
        assert Hymn.objects.filter(hymn_book_id=hb.pk).count() == 0
