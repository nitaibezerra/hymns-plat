"""Painel "Curadoria editorial" no `hymnbook_detail` (staff-only).

Permite ao staff alterar `priority` (P1/P2/P3) e `is_featured` de um hinário
direto do detalhe, sem entrar no admin. Anônimos e usuários autenticados
não-staff não veem o painel e não podem fazer POST.
"""

from __future__ import annotations

import pytest
from django.urls import reverse


@pytest.mark.django_db
class TestPanelVisibility:
    def test_anonymous_does_not_see_panel(self, client, hymn_book_factory):
        hb = hymn_book_factory(name="Anon Vista")
        body = client.get(reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug})).content.decode()
        assert "data-editorial-panel" not in body

    def test_non_staff_authenticated_does_not_see_panel(self, authenticated_client, hymn_book_factory):
        hb = hymn_book_factory(name="Auth Vista")
        body = authenticated_client.get(reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug})).content.decode()
        assert "data-editorial-panel" not in body

    def test_staff_sees_panel(self, admin_client, hymn_book_factory):
        hb = hymn_book_factory(name="Staff Vista")
        body = admin_client.get(reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug})).content.decode()
        assert "data-editorial-panel" in body
        # Strip horizontal compacta (handoff §3): tem o eyebrow STAFF e o
        # segmented control de prioridade, sem o card-soft anterior.
        assert "editor-strip" in body
        assert "STAFF" in body
        assert "priority-segmented" in body
        # 3 radios de prioridade
        for value in ("P1", "P2", "P3"):
            assert f'value="{value}"' in body
        # checkbox de destaque
        assert 'name="is_featured"' in body


@pytest.mark.django_db
class TestPanelPost:
    def test_staff_can_update_priority_and_featured(self, admin_client, hymn_book_factory):
        hb = hymn_book_factory(name="Update OK")
        assert hb.priority == "P3"
        assert hb.is_featured is False

        resp = admin_client.post(
            reverse("hymns:hymnbook_editorial_update", kwargs={"slug": hb.slug}),
            data={"priority": "P1", "is_featured": "on"},
        )
        assert resp.status_code == 302  # redirect for hymnbook_detail
        hb.refresh_from_db()
        assert hb.priority == "P1"
        assert hb.is_featured is True

    def test_non_staff_cannot_update(self, authenticated_client, hymn_book_factory):
        hb = hymn_book_factory(name="Update Block")
        authenticated_client.post(
            reverse("hymns:hymnbook_editorial_update", kwargs={"slug": hb.slug}),
            data={"priority": "P1", "is_featured": "on"},
        )
        hb.refresh_from_db()
        assert hb.priority == "P3"
        assert hb.is_featured is False

    def test_anonymous_redirected_to_login(self, client, hymn_book_factory):
        hb = hymn_book_factory(name="Anon Block")
        resp = client.post(
            reverse("hymns:hymnbook_editorial_update", kwargs={"slug": hb.slug}),
            data={"priority": "P1", "is_featured": "on"},
        )
        # @login_required → redirect para login
        assert resp.status_code == 302
        hb.refresh_from_db()
        assert hb.priority == "P3"
        assert hb.is_featured is False
