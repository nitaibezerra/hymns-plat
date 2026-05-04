"""
Testes de views CRUD para HymnBook (create, edit, delete via web).

Política (a partir de Marco "editor-only"): apenas membros do grupo `editor`
ou superusers podem cadastrar/editar/deletar/publicar. Ser dono (`owner_user`)
não confere mais direitos extras — só consulta.
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

    def test_get_blocked_for_common_user(self, authenticated_client):
        # Usuário autenticado mas sem o papel de editor → redirecionado.
        url = reverse("hymns:hymnbook_create")
        resp = authenticated_client.get(url)
        assert resp.status_code == 302
        assert resp.url == reverse("hymns:hymnbook_list")

    def test_post_blocked_for_common_user(self, authenticated_client):
        url = reverse("hymns:hymnbook_create")
        resp = authenticated_client.post(
            url,
            {"name": "Tentativa", "owner_name": "X", "intro_name": "", "description": ""},
        )
        assert resp.status_code == 302
        assert HymnBook.objects.filter(name="Tentativa").count() == 0

    def test_get_renders_form_for_editor(self, editor_client):
        url = reverse("hymns:hymnbook_create")
        resp = editor_client.get(url)
        assert resp.status_code == 200
        assert b"form" in resp.content.lower()

    def test_get_renders_form_for_superuser(self, admin_client):
        url = reverse("hymns:hymnbook_create")
        resp = admin_client.get(url)
        assert resp.status_code == 200

    def test_post_creates_hymnbook_with_owner_for_editor(self, editor_client):
        url = reverse("hymns:hymnbook_create")
        resp = editor_client.post(
            url,
            {"name": "Novo Hinário", "owner_name": "Dono Novo", "intro_name": "", "description": ""},
        )
        assert resp.status_code == 302
        hb = HymnBook.objects.get(name="Novo Hinário")
        assert hb.owner_user == editor_client.user
        assert resp.url == reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug})

    def test_post_invalid_shows_errors_for_editor(self, editor_client):
        url = reverse("hymns:hymnbook_create")
        resp = editor_client.post(url, {"name": "", "owner_name": ""})
        assert resp.status_code == 200
        assert HymnBook.objects.filter(owner_name="").count() == 0


@pytest.mark.django_db
class TestHymnBookEditView:
    def test_requires_login(self, client, hymn_book):
        url = reverse("hymns:hymnbook_edit", kwargs={"slug": hymn_book.slug})
        resp = client.get(url)
        assert resp.status_code == 302
        assert "/accounts/login/" in resp.url

    def test_forbidden_for_common_user(self, authenticated_client, hymn_book):
        url = reverse("hymns:hymnbook_edit", kwargs={"slug": hymn_book.slug})
        resp = authenticated_client.get(url)
        assert resp.status_code == 302
        assert resp.url == reverse("hymns:hymnbook_detail", kwargs={"slug": hymn_book.slug})

    def test_forbidden_for_owner_who_is_not_editor(self, authenticated_client, hymn_book_factory):
        # Política nova: dono comum também é bloqueado.
        hb = hymn_book_factory(name="Meu", owner_user=authenticated_client.user)
        url = reverse("hymns:hymnbook_edit", kwargs={"slug": hb.slug})
        resp = authenticated_client.get(url)
        assert resp.status_code == 302
        assert resp.url == reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug})

    def test_allowed_for_editor(self, editor_client, hymn_book):
        url = reverse("hymns:hymnbook_edit", kwargs={"slug": hymn_book.slug})
        resp = editor_client.get(url)
        assert resp.status_code == 200

    def test_allowed_for_superuser(self, admin_client, hymn_book):
        url = reverse("hymns:hymnbook_edit", kwargs={"slug": hymn_book.slug})
        resp = admin_client.get(url)
        assert resp.status_code == 200

    def test_post_updates_fields(self, editor_client, hymn_book_factory):
        hb = hymn_book_factory(name="Antes")
        url = reverse("hymns:hymnbook_edit", kwargs={"slug": hb.slug})
        resp = editor_client.post(
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

    def test_forbidden_for_common_user(self, authenticated_client, hymn_book):
        url = reverse("hymns:hymnbook_delete", kwargs={"slug": hymn_book.slug})
        resp = authenticated_client.post(url)
        assert resp.status_code == 302
        assert HymnBook.objects.filter(pk=hymn_book.pk).exists()

    def test_forbidden_for_owner_who_is_not_editor(self, authenticated_client, hymn_book_factory):
        hb = hymn_book_factory(name="Meu", owner_user=authenticated_client.user)
        url = reverse("hymns:hymnbook_delete", kwargs={"slug": hb.slug})
        resp = authenticated_client.post(url)
        assert resp.status_code == 302
        assert HymnBook.objects.filter(pk=hb.pk).exists()

    def test_get_shows_confirmation_for_editor(self, editor_client, hymn_book_factory):
        hb = hymn_book_factory(name="Del Confirm")
        url = reverse("hymns:hymnbook_delete", kwargs={"slug": hb.slug})
        resp = editor_client.get(url)
        assert resp.status_code == 200

    def test_post_removes_hymnbook(self, editor_client, hymn_book_factory):
        hb = hymn_book_factory(name="Will Delete")
        url = reverse("hymns:hymnbook_delete", kwargs={"slug": hb.slug})
        resp = editor_client.post(url)
        assert resp.status_code == 302
        assert resp.url == reverse("hymns:hymnbook_list")
        assert not HymnBook.objects.filter(pk=hb.pk).exists()

    def test_post_cascades_to_hymns(self, editor_client, hymn_book_factory, hymn_factory):
        from apps.hymns.models import Hymn

        hb = hymn_book_factory(name="With Hymns")
        hymn_factory(hymn_book=hb, number=1)
        hymn_factory(hymn_book=hb, number=2)
        url = reverse("hymns:hymnbook_delete", kwargs={"slug": hb.slug})
        editor_client.post(url)
        assert Hymn.objects.filter(hymn_book_id=hb.pk).count() == 0


@pytest.mark.django_db
class TestHymnBookListButtonVisibility:
    """O botão '+ Novo hinário' na listagem só aparece para Editores/Admins."""

    def test_button_hidden_for_anonymous(self, client, hymn_book):
        resp = client.get(reverse("hymns:hymnbook_list"))
        assert resp.status_code == 200
        assert b"Novo hin" not in resp.content

    def test_button_hidden_for_common_user(self, authenticated_client, hymn_book):
        resp = authenticated_client.get(reverse("hymns:hymnbook_list"))
        assert resp.status_code == 200
        assert b"Novo hin" not in resp.content

    def test_button_visible_for_editor(self, editor_client, hymn_book):
        resp = editor_client.get(reverse("hymns:hymnbook_list"))
        assert resp.status_code == 200
        assert b"Novo hin" in resp.content

    def test_button_visible_for_superuser(self, admin_client, hymn_book):
        resp = admin_client.get(reverse("hymns:hymnbook_list"))
        assert resp.status_code == 200
        assert b"Novo hin" in resp.content


@pytest.mark.django_db
class TestHymnBookDetailButtonVisibility:
    """Botões '+ Hino' e 'Editar' na página do hinário só aparecem para Editores/Admins."""

    def _make_owner_book(self, hymn_book_factory, user):
        return hymn_book_factory(name="Det", owner_user=user)

    def test_buttons_hidden_for_common_user_even_if_owner(self, authenticated_client, hymn_book_factory):
        hb = self._make_owner_book(hymn_book_factory, authenticated_client.user)
        resp = authenticated_client.get(reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}))
        assert resp.status_code == 200
        assert b"+ Hino" not in resp.content

    def test_buttons_visible_for_editor(self, editor_client, hymn_book):
        resp = editor_client.get(reverse("hymns:hymnbook_detail", kwargs={"slug": hymn_book.slug}))
        assert resp.status_code == 200
        assert b"+ Hino" in resp.content
