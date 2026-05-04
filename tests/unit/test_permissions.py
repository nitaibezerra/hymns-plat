"""
Marco 1.1 — papel `editor` + permissões.

- Grupo `editor` é criado por data migration e tem as permissões
  `hymns.can_review_any_hymnbook` e `hymns.can_publish_hymnbook`.
- `apps.hymns.permissions.can_edit_hymnbook(user, hymnbook)` substitui o helper
  privado `_can_edit_hymnbook` antigo.
"""

import pytest
from django.contrib.auth.models import Group, Permission

from apps.hymns.permissions import can_create_hymnbook, can_edit_hymnbook, can_publish_hymnbook


@pytest.mark.django_db
class TestEditorGroupMigration:
    def test_editor_group_exists(self):
        assert Group.objects.filter(name="editor").exists()

    def test_editor_group_has_review_permission(self):
        group = Group.objects.get(name="editor")
        assert group.permissions.filter(codename="can_review_any_hymnbook").exists()

    def test_editor_group_has_publish_permission(self):
        group = Group.objects.get(name="editor")
        assert group.permissions.filter(codename="can_publish_hymnbook").exists()

    def test_review_permission_is_on_hymnbook_content_type(self):
        perm = Permission.objects.get(codename="can_review_any_hymnbook")
        assert perm.content_type.app_label == "hymns"
        assert perm.content_type.model == "hymnbook"

    def test_publish_permission_is_on_hymnbook_content_type(self):
        perm = Permission.objects.get(codename="can_publish_hymnbook")
        assert perm.content_type.app_label == "hymns"
        assert perm.content_type.model == "hymnbook"


def _make_editor(user):
    user.groups.add(Group.objects.get(name="editor"))
    return user


@pytest.mark.django_db
class TestCanEditHymnbook:
    def test_anonymous_cannot_edit(self, hymn_book):
        from django.contrib.auth.models import AnonymousUser

        assert can_edit_hymnbook(AnonymousUser(), hymn_book) is False

    def test_random_user_cannot_edit(self, user_factory, hymn_book):
        user = user_factory(email="random@example.com")
        assert can_edit_hymnbook(user, hymn_book) is False

    def test_owner_who_is_not_editor_cannot_edit(self, user_factory, hymn_book_factory):
        # Política nova (cadastro/edição restrito a Editores e Admins): ser dono,
        # por si só, não dá direito de edição.
        owner = user_factory(email="owner@example.com")
        hb = hymn_book_factory(name="Owned", owner_user=owner)
        assert can_edit_hymnbook(owner, hb) is False

    def test_superuser_can_edit_any(self, user_factory, hymn_book):
        admin = user_factory(email="root@example.com")
        admin.is_superuser = True
        admin.save()
        assert can_edit_hymnbook(admin, hymn_book) is True

    def test_editor_can_edit_any(self, user_factory, hymn_book):
        editor = _make_editor(user_factory(email="editor@example.com"))
        assert can_edit_hymnbook(editor, hymn_book) is True

    def test_editor_can_edit_other_users_hymnbook(self, user_factory, hymn_book_factory):
        owner = user_factory(email="dono@example.com")
        editor = _make_editor(user_factory(email="ed@example.com"))
        hb = hymn_book_factory(name="Alheio", owner_user=owner)
        assert can_edit_hymnbook(editor, hb) is True


@pytest.mark.django_db
class TestCanCreateHymnbook:
    def test_anonymous_cannot_create(self):
        from django.contrib.auth.models import AnonymousUser

        assert can_create_hymnbook(AnonymousUser()) is False

    def test_common_user_cannot_create(self, user_factory):
        user = user_factory(email="common@example.com")
        assert can_create_hymnbook(user) is False

    def test_editor_can_create(self, user_factory):
        editor = _make_editor(user_factory(email="ed@example.com"))
        assert can_create_hymnbook(editor) is True

    def test_superuser_can_create(self, user_factory):
        admin = user_factory(email="root@example.com")
        admin.is_superuser = True
        admin.save()
        assert can_create_hymnbook(admin) is True


@pytest.mark.django_db
class TestCanPublishHymnbook:
    def test_anonymous_cannot_publish(self, hymn_book):
        from django.contrib.auth.models import AnonymousUser

        assert can_publish_hymnbook(AnonymousUser(), hymn_book) is False

    def test_random_user_cannot_publish(self, user_factory, hymn_book):
        user = user_factory(email="rand@example.com")
        assert can_publish_hymnbook(user, hymn_book) is False

    def test_owner_who_is_not_editor_cannot_publish(self, user_factory, hymn_book_factory):
        # Política nova: ser dono não habilita publicação.
        owner = user_factory(email="ownerp@example.com")
        hb = hymn_book_factory(name="OwnedP", owner_user=owner)
        assert can_publish_hymnbook(owner, hb) is False

    def test_editor_can_publish_any(self, user_factory, hymn_book):
        editor = _make_editor(user_factory(email="edp@example.com"))
        assert can_publish_hymnbook(editor, hymn_book) is True

    def test_superuser_can_publish_any(self, user_factory, hymn_book):
        admin = user_factory(email="rootp@example.com")
        admin.is_superuser = True
        admin.save()
        assert can_publish_hymnbook(admin, hymn_book) is True
