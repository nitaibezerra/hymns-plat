"""
Marco 1.2 — estado de publicação de HymnBook.

Hinários novos entram não-publicados (`is_published=False`) e ficam invisíveis
em listas/busca para usuários comuns. Manager `published()` retorna apenas
publicados; `visible_to(user)` adiciona os que `user` pode editar (dono,
editor, superuser). Views públicas e busca filtram por essa visibilidade.

Endpoints `publicar/`/`despublicar/` exigem `can_publish_hymnbook`; ao publicar,
gravam `published_at` e `published_by`.
"""

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse

from apps.hymns.models import HymnBook


def _make_editor(user):
    user.groups.add(Group.objects.get(name="editor"))
    return user


@pytest.mark.django_db
class TestHymnBookPublicationFields:
    def test_default_is_not_published(self):
        # Bypass do factory (que default é publicado) para checar o default real
        # do model.
        hb = HymnBook.objects.create(name="Default", owner_name="X")
        assert hb.is_published is False
        assert hb.published_at is None
        assert hb.published_by is None


@pytest.mark.django_db
class TestPublishedManager:
    def test_published_excludes_unpublished(self, hymn_book_factory):
        hymn_book_factory(name="A não publicada", is_published=False)
        published = hymn_book_factory(name="B publicada")
        result = list(HymnBook.objects.published())
        assert published in result
        assert len(result) == 1


@pytest.mark.django_db
class TestVisibleToManager:
    def test_anonymous_sees_only_published(self, hymn_book_factory):
        from django.contrib.auth.models import AnonymousUser

        hymn_book_factory(name="Privado", is_published=False)
        pub = hymn_book_factory(name="Público")
        result = list(HymnBook.objects.visible_to(AnonymousUser()))
        assert result == [pub]

    def test_owner_sees_own_unpublished(self, user_factory, hymn_book_factory):
        owner = user_factory(email="o@example.com")
        own_unpublished = hymn_book_factory(name="Meu", owner_user=owner, is_published=False)
        someone_elses_unpublished = hymn_book_factory(name="Alheio", is_published=False)
        public = hymn_book_factory(name="Público")

        result = set(HymnBook.objects.visible_to(owner))
        assert own_unpublished in result
        assert public in result
        assert someone_elses_unpublished not in result

    def test_editor_sees_all(self, user_factory, hymn_book_factory):
        editor = _make_editor(user_factory(email="ed@example.com"))
        a = hymn_book_factory(name="A", is_published=False)
        b = hymn_book_factory(name="B")
        result = set(HymnBook.objects.visible_to(editor))
        assert a in result
        assert b in result

    def test_superuser_sees_all(self, user_factory, hymn_book_factory):
        admin = user_factory(email="su@example.com")
        admin.is_superuser = True
        admin.save()
        a = hymn_book_factory(name="A", is_published=False)
        b = hymn_book_factory(name="B")
        result = set(HymnBook.objects.visible_to(admin))
        assert a in result
        assert b in result


@pytest.mark.django_db
class TestPublicListAndHomeFilters:
    def test_hymnbook_list_hides_unpublished_from_anon(self, client, hymn_book_factory):
        hymn_book_factory(name="Privado", is_published=False)
        hymn_book_factory(name="Público")
        resp = client.get(reverse("hymns:hymnbook_list"))
        assert resp.status_code == 200
        names = [hb.name for hb in resp.context["hymnbooks"]]
        assert "Público" in names
        assert "Privado" not in names

    def test_hymnbook_list_shows_owners_unpublished(self, authenticated_client, hymn_book_factory):
        hymn_book_factory(
            name="Privado-meu", owner_user=authenticated_client.user, is_published=False
        )
        hymn_book_factory(name="Privado-outro", is_published=False)
        resp = authenticated_client.get(reverse("hymns:hymnbook_list"))
        names = [hb.name for hb in resp.context["hymnbooks"]]
        assert "Privado-meu" in names
        assert "Privado-outro" not in names

    def test_home_recent_excludes_unpublished_for_anon(self, client, hymn_book_factory):
        hymn_book_factory(name="Privado", is_published=False)
        hymn_book_factory(name="Público")
        resp = client.get(reverse("hymns:home"))
        names = [hb.name for hb in resp.context["recent_hymnbooks"]]
        assert "Público" in names
        assert "Privado" not in names


@pytest.mark.django_db
class TestSearchFilters:
    def test_search_excludes_hymns_from_unpublished_book_for_anon(
        self, client, hymn_book_factory, hymn_factory
    ):
        unpublished = hymn_book_factory(name="Oculto", is_published=False)
        published = hymn_book_factory(name="Visível")
        hymn_factory(hymn_book=unpublished, number=1, title="Lua Oculta", text="lua oculta")
        hymn_factory(hymn_book=published, number=1, title="Lua Visível", text="lua visivel")

        resp = client.get(reverse("hymns:search"), {"q": "lua"})
        titles = [r["obj"].title for r in resp.context["results"] if r["type"] == "hymn"]
        assert "Lua Visível" in titles
        assert "Lua Oculta" not in titles

    def test_search_shows_owners_hymns_from_unpublished(
        self, authenticated_client, hymn_book_factory, hymn_factory
    ):
        own = hymn_book_factory(
            name="Meu", owner_user=authenticated_client.user, is_published=False
        )
        hymn_factory(hymn_book=own, number=1, title="Lua Privada", text="oculta")
        resp = authenticated_client.get(reverse("hymns:search"), {"q": "Privada"})
        titles = [r["obj"].title for r in resp.context["results"] if r["type"] == "hymn"]
        assert "Lua Privada" in titles


@pytest.mark.django_db
class TestPublishView:
    def test_requires_login(self, client, hymn_book):
        url = reverse("hymns:hymnbook_publish", kwargs={"slug": hymn_book.slug})
        resp = client.post(url)
        assert resp.status_code == 302
        assert "/accounts/login" in resp.url

    def test_owner_can_publish(self, authenticated_client, hymn_book_factory, hymn_factory):
        from apps.hymns.models import Hymn, HymnRevision

        hb = hymn_book_factory(
            name="Pub",
            owner_user=authenticated_client.user,
            is_published=False,
            description="Hinário do teste",
        )
        h = hymn_factory(hymn_book=hb, number=1)
        Hymn.objects.filter(pk=h.pk).update(review_status=Hymn.ReviewStatus.REVIEWED)
        HymnRevision.objects.create(hymn=h, revised_by=authenticated_client.user)
        url = reverse("hymns:hymnbook_publish", kwargs={"slug": hb.slug})
        resp = authenticated_client.post(url)
        assert resp.status_code == 302
        hb.refresh_from_db()
        assert hb.is_published is True
        assert hb.published_at is not None
        assert hb.published_by == authenticated_client.user

    def test_editor_can_publish_others_book(self, authenticated_client, hymn_book_factory, hymn_factory, user_factory):
        from apps.hymns.models import Hymn, HymnRevision

        _make_editor(authenticated_client.user)
        owner = user_factory(email="own@example.com")
        hb = hymn_book_factory(
            name="Alheio", owner_user=owner, is_published=False, description="x"
        )
        h = hymn_factory(hymn_book=hb, number=1)
        Hymn.objects.filter(pk=h.pk).update(review_status=Hymn.ReviewStatus.REVIEWED)
        HymnRevision.objects.create(hymn=h, revised_by=owner)
        url = reverse("hymns:hymnbook_publish", kwargs={"slug": hb.slug})
        resp = authenticated_client.post(url)
        assert resp.status_code == 302
        hb.refresh_from_db()
        assert hb.is_published is True

    def test_random_user_forbidden(self, authenticated_client, hymn_book_factory):
        hb = hymn_book_factory(name="Outro", is_published=False)
        url = reverse("hymns:hymnbook_publish", kwargs={"slug": hb.slug})
        authenticated_client.post(url)
        # redireciona com mensagem de erro, não publica
        hb.refresh_from_db()
        assert hb.is_published is False


@pytest.mark.django_db
class TestUnpublishView:
    def test_owner_can_unpublish(self, authenticated_client, hymn_book_factory):
        hb = hymn_book_factory(
            name="Unpub", owner_user=authenticated_client.user, is_published=True
        )
        url = reverse("hymns:hymnbook_unpublish", kwargs={"slug": hb.slug})
        resp = authenticated_client.post(url)
        assert resp.status_code == 302
        hb.refresh_from_db()
        assert hb.is_published is False

    def test_editor_can_unpublish_others_book(self, authenticated_client, hymn_book_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="OutroPub", is_published=True)
        url = reverse("hymns:hymnbook_unpublish", kwargs={"slug": hb.slug})
        authenticated_client.post(url)
        hb.refresh_from_db()
        assert hb.is_published is False
