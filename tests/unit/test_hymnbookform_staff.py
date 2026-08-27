"""
Testes do HymnBookForm com a extensão de curadoria editorial staff-only:
- `priority`, `is_featured`, `is_published` só aparecem para usuários staff
- `clean()` rejeita publicação direta sem permissão ou sem readiness
- `save()` seta `published_at` + `published_by` quando publica
"""

from unittest.mock import patch

import pytest

from apps.hymns.forms import HymnBookForm


def _staff_user(user_factory, **kwargs):
    u = user_factory(email="staff@example.com", **kwargs)
    u.is_staff = True
    u.save()
    return u


def _admin_user(user_factory, **kwargs):
    u = user_factory(email="admin@example.com", **kwargs)
    u.is_staff = True
    u.is_superuser = True
    u.save()
    return u


@pytest.mark.django_db
class TestHymnBookFormStaffFields:
    def test_non_staff_user_does_not_see_curadoria_fields(self, user_factory):
        u = user_factory(email="alice@example.com")
        form = HymnBookForm(user=u)
        assert "priority" not in form.fields
        assert "is_featured" not in form.fields
        assert "is_published" not in form.fields

    def test_anonymous_does_not_see_curadoria_fields(self):
        form = HymnBookForm(user=None)
        for f in ("priority", "is_featured", "is_published"):
            assert f not in form.fields

    def test_staff_user_sees_curadoria_fields(self, user_factory):
        u = _staff_user(user_factory)
        form = HymnBookForm(user=u)
        assert "priority" in form.fields
        assert "is_featured" in form.fields
        assert "is_published" in form.fields


@pytest.mark.django_db
class TestHymnBookFormPublishGate:
    def test_save_without_publish_does_not_touch_published_at(self, user_factory, hymn_book_factory):
        hb = hymn_book_factory(name="Sem Publicar", is_published=False)
        u = _staff_user(user_factory)
        form = HymnBookForm(
            data={"name": hb.name, "owner_name": hb.owner_name, "priority": "P3"},
            instance=hb,
            user=u,
        )
        assert form.is_valid(), form.errors
        form.save()
        hb.refresh_from_db()
        assert hb.is_published is False
        assert hb.published_at is None

    def test_publish_rejected_when_readiness_fails(self, user_factory, hymn_book_factory):
        hb = hymn_book_factory(name="Vazio", is_published=False, description="")
        u = _admin_user(user_factory)  # superuser passa gate de permissão; readiness ainda falha
        form = HymnBookForm(
            data={
                "name": hb.name,
                "owner_name": hb.owner_name,
                "priority": "P3",
                "is_published": True,
            },
            instance=hb,
            user=u,
        )
        assert not form.is_valid()
        assert any("não pode ser publicado" in str(e) for e in form.non_field_errors())

    def test_publish_sets_published_at_and_by_when_ready(self, user_factory, hymn_book_factory):
        u = _admin_user(user_factory)
        hb = hymn_book_factory(
            name="Pronto",
            owner_name="Mestre",
            description="Tem descrição.",
            is_published=False,
            owner_user=u,
        )
        # Mocka readiness pra dar can_publish=True sem precisar de seed completo.
        fake_report = {"can_publish": True, "checks": [], "review_progress": {}, "reviewer_count": 1}
        with patch("apps.hymns.services.review.publish_readiness", return_value=fake_report):
            form = HymnBookForm(
                data={
                    "name": hb.name,
                    "owner_name": hb.owner_name,
                    "description": hb.description,
                    "priority": "P3",
                    "is_published": True,
                },
                instance=hb,
                user=u,
            )
            assert form.is_valid(), form.errors
            form.save()
        hb.refresh_from_db()
        assert hb.is_published is True
        assert hb.published_at is not None
        assert hb.published_by_id == u.id

    def test_publish_rejected_when_user_lacks_permission(self, user_factory, hymn_book_factory):
        # Staff por user.is_staff, mas mock can_publish_hymnbook → False.
        u = _staff_user(user_factory)
        hb = hymn_book_factory(name="A", is_published=False)
        with patch("apps.hymns.forms.can_publish_hymnbook", return_value=False):
            form = HymnBookForm(
                data={
                    "name": hb.name,
                    "owner_name": hb.owner_name,
                    "priority": "P3",
                    "is_published": True,
                },
                instance=hb,
                user=u,
            )
            assert not form.is_valid()
        assert any("permissão" in str(e) for e in form.non_field_errors())

    def test_already_published_does_not_overwrite_published_at(self, user_factory, hymn_book_factory):
        from django.utils import timezone

        original = timezone.now() - timezone.timedelta(days=5)
        u = _staff_user(user_factory)
        hb = hymn_book_factory(name="Já Publicado", is_published=True, published_at=original)
        form = HymnBookForm(
            data={
                "name": hb.name,
                "owner_name": hb.owner_name,
                "priority": "P3",
                "is_published": True,
            },
            instance=hb,
            user=u,
        )
        assert form.is_valid(), form.errors
        form.save()
        hb.refresh_from_db()
        assert hb.published_at == original
