"""E2E para a CTA pill "Fila de revisão" no header (handoff §2).

Visível só para users com perm de revisor; fica ao lado do avatar (fora do
<nav> central); navega para o workspace editorial.
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest
from playwright.sync_api import expect

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _shell(code: str) -> str:
    result = subprocess.run(
        ["uv", "run", "python", "manage.py", "shell", "-c", code],
        env={**os.environ, "DJANGO_SETTINGS_MODULE": "config.settings.local"},
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    lines = [ln for ln in result.stdout.strip().splitlines() if ln.strip()]
    return lines[-1] if lines else ""


def _ensure_editor_user():
    _shell(
        "from django.contrib.auth.models import Group;"
        "from apps.users.models import User;"
        "ed, _ = Group.objects.get_or_create(name='editor');"
        "u, _ = User.objects.get_or_create(email='teste2e@example.com', defaults={'username': 'teste2e', 'is_active': True});"
        "u.groups.add(ed);"
        "print('seeded')"
    )


@pytest.fixture(autouse=True)
def reset_user():
    _ensure_editor_user()
    yield


class TestCtaVisibility:
    def test_editor_sees_cta_pill(self, authenticated_page, base_url):
        authenticated_page.goto(f"{base_url}/")
        cta = authenticated_page.locator("[data-editor-cta]")
        expect(cta).to_be_visible()
        expect(cta).to_contain_text("Fila de revisão")

    def test_anon_does_not_see_cta(self, page, base_url):
        page.goto(f"{base_url}/")
        expect(page.locator("[data-editor-cta]")).to_have_count(0)


class TestCtaPositioning:
    """CTA fica FORA do <nav> central — segundo handoff §2 vive entre o
    search/sino e o avatar, ao lado das ações de conta."""

    def test_cta_is_outside_main_nav(self, authenticated_page, base_url):
        authenticated_page.goto(f"{base_url}/")
        # Verifica via boolean compound query — o CTA não pode estar dentro
        # do <nav aria-label="Principal">.
        inside_nav = authenticated_page.locator("nav[aria-label='Principal'] [data-editor-cta]")
        expect(inside_nav).to_have_count(0)
        # E o data-editor-cta existe em algum lugar da página
        expect(authenticated_page.locator("[data-editor-cta]")).to_have_count(1)


class TestCtaNavigation:
    def test_clicking_cta_goes_to_workspace(self, authenticated_page, base_url):
        authenticated_page.goto(f"{base_url}/")
        authenticated_page.locator("[data-editor-cta]").click()
        expect(authenticated_page).to_have_url(f"{base_url}/editor/hinarios/")

    def test_cta_marks_active_on_editor_pages(self, authenticated_page, base_url):
        authenticated_page.goto(f"{base_url}/editor/hinarios/")
        cta = authenticated_page.locator("[data-editor-cta]")
        expect(cta).to_have_class(__import__("re").compile(r"is-active"))


class TestCtaCount:
    def test_pending_count_badge_renders_for_pending_books(self, authenticated_page, base_url):
        """Se houver hinários com hinos não-revisados visíveis, o badge contém
        um número >= 1. Não pinamos o valor exato (depende do estado do DB),
        só a presença do elemento."""
        # Garantir ≥1 hinário com hino pendente
        _shell(
            "from apps.hymns.models import Hymn, HymnBook;"
            "from django.utils import timezone;"
            "hb, _ = HymnBook.objects.update_or_create(slug='e2e-cta-book', defaults={'name': 'CTA Book', 'owner_name': 'X', 'is_published': True, 'published_at': timezone.now()});"
            "Hymn.objects.update_or_create(hymn_book=hb, number=1, defaults={'title': 'h', 'text': 'a', 'review_status': 'not_reviewed'});"
            "print('ok')"
        )
        authenticated_page.goto(f"{base_url}/")
        badge = authenticated_page.locator("[data-editor-cta] .editor-cta-count")
        expect(badge).to_be_visible()
        text = badge.text_content() or ""
        assert text.strip().isdigit() and int(text.strip()) >= 1
        # cleanup
        _shell(
            "from apps.hymns.models import HymnBook; HymnBook.objects.filter(slug='e2e-cta-book').delete(); print('ok')"
        )
