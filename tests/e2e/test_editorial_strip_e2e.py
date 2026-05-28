"""E2E para a strip horizontal "STAFF" no hymnbook_detail (handoff §3).

Cobre:
- Strip aparece somente para staff
- Segmented control de prioridade tem feedback visual instantâneo no clique
  (via :has(input:checked) no CSS — sem JS)
- Submeter o form persiste priority + is_featured no hinário
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest
from playwright.sync_api import expect

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SEED_SLUG = "e2e-strip-book"


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


def _ensure_seed():
    """Cria hinário publicado + user staff com perm de editor."""
    code = (
        "from django.contrib.auth.models import Group;"
        "from apps.hymns.models import Hymn, HymnBook;"
        "from apps.users.models import User;"
        "from django.utils import timezone;"
        "ed, _ = Group.objects.get_or_create(name='editor');"
        "u, _ = User.objects.get_or_create(email='teste2e@example.com', defaults={'username': 'teste2e', 'is_active': True});"
        "u.groups.add(ed);"
        "u.is_staff = True;"
        "u.save();"
        f"HymnBook.objects.filter(slug={SEED_SLUG!r}).delete();"
        f"hb = HymnBook.objects.create(name='Strip Book', slug={SEED_SLUG!r}, owner_name='Mestre Strip', is_published=True, published_at=timezone.now(), priority='P3', is_featured=False);"
        "Hymn.objects.create(hymn_book=hb, number=1, title='H1', text='a');"
        "print('seeded')"
    )
    _shell(code)


def _book_state() -> tuple[str, bool]:
    out = _shell(
        "from apps.hymns.models import HymnBook;"
        f"hb = HymnBook.objects.get(slug={SEED_SLUG!r});"
        "print(hb.priority + ':' + str(hb.is_featured))"
    )
    prio, feat = out.split(":")
    return prio.strip(), feat.strip() == "True"


@pytest.fixture(autouse=True)
def reset_seed():
    _ensure_seed()
    yield
    _shell(
        "from apps.users.models import User;"
        "User.objects.filter(email='teste2e@example.com').update(is_staff=False);"
        f"from apps.hymns.models import HymnBook; HymnBook.objects.filter(slug={SEED_SLUG!r}).delete();"
        "print('cleaned')"
    )


class TestStripVisibility:
    def test_strip_appears_for_staff(self, authenticated_page, base_url):
        authenticated_page.goto(f"{base_url}/hinarios/{SEED_SLUG}/")
        strip = authenticated_page.locator("[data-editorial-panel]")
        expect(strip).to_be_visible()
        expect(authenticated_page.get_by_text("STAFF", exact=True)).to_be_visible()

    def test_strip_hidden_for_anon(self, page, base_url):
        page.goto(f"{base_url}/hinarios/{SEED_SLUG}/")
        expect(page.locator("[data-editorial-panel]")).to_have_count(0)


class TestPrioritySegmentedLiveFeedback:
    """Clicar num P1/P2/P3 deve mudar o visual ATIVO instantaneamente
    (via :has(input:checked) — não depende do form submit nem de JS)."""

    def test_initial_state_marks_p3(self, authenticated_page, base_url):
        # Seed começa com priority=P3
        authenticated_page.goto(f"{base_url}/hinarios/{SEED_SLUG}/")
        p3 = authenticated_page.locator("[data-priority-option='P3'] input")
        expect(p3).to_be_checked()

    def test_clicking_p1_activates_p1_radio(self, authenticated_page, base_url):
        authenticated_page.goto(f"{base_url}/hinarios/{SEED_SLUG}/")
        p1_label = authenticated_page.locator("[data-priority-option='P1']")
        p1_input = p1_label.locator("input")
        p3_input = authenticated_page.locator("[data-priority-option='P3'] input")
        expect(p3_input).to_be_checked()
        p1_label.click()
        expect(p1_input).to_be_checked()
        expect(p3_input).not_to_be_checked()

    def test_clicking_label_updates_visual_state(self, authenticated_page, base_url):
        """Cor de fundo do label P2 muda quando seu radio é checado.
        Pinamos a regra `:has(input:checked)` no CSS computado."""
        authenticated_page.goto(f"{base_url}/hinarios/{SEED_SLUG}/")
        p2_label = authenticated_page.locator("[data-priority-option='P2']")
        bg_before = p2_label.evaluate("el => getComputedStyle(el).backgroundColor")
        p2_label.click()
        # Aguarda o reflow do CSS — :has() é instantâneo, mas damos uma micro-sleep
        authenticated_page.wait_for_timeout(50)
        bg_after = p2_label.evaluate("el => getComputedStyle(el).backgroundColor")
        assert bg_before != bg_after, f"bg deveria mudar — antes={bg_before} depois={bg_after}"


class TestStripFormSubmission:
    def test_changing_priority_and_submitting_persists(self, authenticated_page, base_url):
        authenticated_page.goto(f"{base_url}/hinarios/{SEED_SLUG}/")
        # Antes do submit, o DB tem P3/False
        prio_before, feat_before = _book_state()
        assert prio_before == "P3"
        assert feat_before is False

        # Clica P1 e marca is_featured
        authenticated_page.locator("[data-priority-option='P1']").click()
        authenticated_page.locator("input[name='is_featured']").check()
        # Clica em Salvar — redireciona pro detail novamente
        authenticated_page.locator("[data-editorial-panel] button[type='submit']").click()
        # Pós-redirect, confirma persistência
        authenticated_page.wait_for_url(f"{base_url}/hinarios/{SEED_SLUG}/", timeout=5000)
        prio_after, feat_after = _book_state()
        assert prio_after == "P1"
        assert feat_after is True
