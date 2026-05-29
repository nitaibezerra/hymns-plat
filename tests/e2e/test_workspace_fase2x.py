"""E2E para o Workspace Editorial (Fase 2.x, refinado).

Cobre o redesign visual + comportamentais:
- Card vertical com métricas em 2 seções: REV (formal) + Completude
  (Estilo/Repetições/Áudios) — todas mantêm o hook `data-metric=`
- Badge de prioridade (P1/P2/P3) + glifo "em destaque" condicional
- Stretched-link: clicar no card → vai para o detail; clicar nos botões
  internos → ações correspondentes (sem navegar pro detail)
- Filtros independentes/combináveis: ?sort=least_audios e ?priority=P1
- Chips de filtro têm estado ativo aplicado pelo server
- KPI "P1 Urgente" no header

Pré-requisitos (idempotentes via `_ensure_seed`):
- `uv run python manage.py runserver 9000`
- User `teste2e@example.com` no grupo `editor`
- Hinários de seed com prioridades distintas para os testes de filtro
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest
from playwright.sync_api import expect

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SEED_PREFIX = "e2e-fase2x"


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
    """Cria 3 hinários com prioridades distintas (P1, P2, P3) e variações de
    completude — base para testar filtros e ordenação."""
    code = (
        "from django.contrib.auth.models import Group;"
        "from apps.hymns.models import Hymn, HymnBook;"
        "from apps.users.models import User;"
        "ed, _ = Group.objects.get_or_create(name='editor');"
        "u, _ = User.objects.get_or_create(email='teste2e@example.com', defaults={'username': 'teste2e', 'is_active': True});"
        "u.groups.add(ed);"
        # Limpa hinários anteriores deste suite
        f"HymnBook.objects.filter(slug__startswith={SEED_PREFIX!r}).delete();"
        # P1 urgente com is_featured=True e 50% revisão
        f"hb1 = HymnBook.objects.create(name='Z2X Urgente', slug='{SEED_PREFIX}-p1', owner_name='Mestre Test', is_published=False, priority='P1', is_featured=True);"
        "Hymn.objects.create(hymn_book=hb1, number=1, title='H1', text='a', style='Marcha', review_status='reviewed');"
        "Hymn.objects.create(hymn_book=hb1, number=2, title='H2', text='b', review_status='not_reviewed');"
        # P2 atenção, sem destaque
        f"hb2 = HymnBook.objects.create(name='Z2X Atencao', slug='{SEED_PREFIX}-p2', owner_name='Mestre Test', is_published=False, priority='P2');"
        "Hymn.objects.create(hymn_book=hb2, number=1, title='H1', text='a');"
        # P3 calmo (default), sem destaque
        f"hb3 = HymnBook.objects.create(name='Z2X Calmo', slug='{SEED_PREFIX}-p3', owner_name='Mestre Test', is_published=False, priority='P3');"
        "Hymn.objects.create(hymn_book=hb3, number=1, title='H1', text='a');"
        "print('seeded')"
    )
    _shell(code)


@pytest.fixture(autouse=True)
def reset_seed():
    _ensure_seed()
    yield
    _shell(
        f"from apps.hymns.models import HymnBook; HymnBook.objects.filter(slug__startswith={SEED_PREFIX!r}).delete(); print('cleaned')"
    )


class TestWorkspaceCardStructure:
    """Anatomia do card (handoff §1) — toda a hierarquia é parte do contrato visual."""

    def test_p1_card_has_pill_glyph_and_four_metrics(self, authenticated_page, base_url):
        authenticated_page.goto(f"{base_url}/editor/hinarios/")
        card = authenticated_page.locator(f"[data-queue-card][data-slug='{SEED_PREFIX}-p1']")
        expect(card).to_be_visible()
        # Pill de prioridade P1
        pill = card.locator("[data-priority-pill]")
        expect(pill).to_have_class("priority-pill priority-pill--p1")
        # Glifo de destaque (is_featured=True para este hinário)
        expect(card.locator("[data-featured-glyph]")).to_have_count(1)
        # Métricas: REV (Revisão formal) + 3 de Completude
        for metric in ("rev", "est", "rep", "aud"):
            expect(card.locator(f"[data-metric='{metric}']")).to_be_visible()
        # REV agora vive em sua própria seção (separada de Completude)
        expect(card.locator(".metric-section--review [data-metric='rev']")).to_have_count(1)
        expect(card.locator(".metric-section--completude [data-metric='rev']")).to_have_count(0)

    def test_p3_card_has_no_featured_glyph(self, authenticated_page, base_url):
        authenticated_page.goto(f"{base_url}/editor/hinarios/")
        card = authenticated_page.locator(f"[data-queue-card][data-slug='{SEED_PREFIX}-p3']")
        expect(card).to_be_visible()
        # Sem is_featured → sem glifo
        expect(card.locator("[data-featured-glyph]")).to_have_count(0)
        # Pill P3 (outline, baixo contraste)
        expect(card.locator("[data-priority-pill]")).to_have_class("priority-pill priority-pill--p3")


class TestWorkspaceCardStretchedLink:
    """Stretched-link: card todo é clicável (overlay via ::after no título),
    mas os botões internos preservam suas próprias ações (z-index acima)."""

    def test_clicking_card_body_navigates_to_detail(self, authenticated_page, base_url):
        authenticated_page.goto(f"{base_url}/editor/hinarios/")
        card = authenticated_page.locator(f"[data-queue-card][data-slug='{SEED_PREFIX}-p3']")
        expect(card).to_be_visible()
        # Header é sticky e intercepta cliques — rola pra fora dele primeiro.
        card.scroll_into_view_if_needed()
        authenticated_page.wait_for_timeout(120)
        # `force=True` evita a interceptação do <form> de busca no header
        # sticky em viewports estreitos; o overlay ::after da stretched-link
        # cobre toda a área do card e responde ao click sintético. Alvo
        # estável: a seção de métricas (sempre presente).
        card.locator("[data-queue-metrics]").click(force=True)
        expect(authenticated_page).to_have_url(f"{base_url}/editor/hinarios/{SEED_PREFIX}-p3/")

    def test_clicking_quick_review_button_goes_to_quick_review(self, authenticated_page, base_url):
        import re

        authenticated_page.goto(f"{base_url}/editor/hinarios/")
        card = authenticated_page.locator(f"[data-queue-card][data-slug='{SEED_PREFIX}-p3']")
        card.locator("[data-action='quick']").click()
        # Quick review URL: /editor/hinarios/<slug>/agil/
        expect(authenticated_page).to_have_url(re.compile(rf"/editor/hinarios/{SEED_PREFIX}-p3/.*agil"))

    def test_clicking_revisar_proximo_button_goes_to_revise(self, authenticated_page, base_url):
        import re

        authenticated_page.goto(f"{base_url}/editor/hinarios/")
        card = authenticated_page.locator(f"[data-queue-card][data-slug='{SEED_PREFIX}-p3']")
        card.locator("[data-action='next']").click()
        # editor_next_hymn redireciona pra editor_revise_hymn de um hino pendente.
        expect(authenticated_page).to_have_url(re.compile(r"/editor/hinos/.+/revisar/"))


class TestWorkspaceFiltersChips:
    """Filtros: ordenar + prioridade em duas dimensões combináveis."""

    def test_priority_p1_filter_hides_p3_books(self, authenticated_page, base_url):
        authenticated_page.goto(f"{base_url}/editor/hinarios/?priority=P1")
        # Chip P1 fica ativo
        active_chips = authenticated_page.locator(".priority-chip.is-active")
        chip_labels = [(c or "").strip() for c in active_chips.all_text_contents()]
        assert any("P1" in label for label in chip_labels)
        # Card P1 aparece, P3 some
        expect(authenticated_page.locator(f"[data-queue-card][data-slug='{SEED_PREFIX}-p1']")).to_be_visible()
        expect(authenticated_page.locator(f"[data-queue-card][data-slug='{SEED_PREFIX}-p3']")).to_have_count(0)

    def test_combined_priority_and_sort_preserved_in_links(self, authenticated_page, base_url):
        authenticated_page.goto(f"{base_url}/editor/hinarios/?sort=least_audios&priority=P1")
        # Verifica que o chip de sort ativo aponta para um link que preserva ?priority=P1
        # (e vice-versa) — interleave correto entre as duas dimensões.
        sort_chip = authenticated_page.locator(".priority-chip.is-active", has_text="Menos áudios")
        expect(sort_chip).to_be_visible()
        # Verifica permanência do filtro priority via link de outro chip de sort
        other_sort = authenticated_page.locator(".priority-chip", has_text="Recém adicionados")
        href = other_sort.get_attribute("href") or ""
        assert "priority=P1" in href, f"link deveria preservar priority=P1 — got {href!r}"


class TestWorkspaceKpiP1Urgente:
    def test_kpi_counts_visible_p1_books(self, authenticated_page, base_url):
        authenticated_page.goto(f"{base_url}/editor/hinarios/")
        # Procura o dt "P1 Urgente" (capitalização exata vem do template)
        kpi = authenticated_page.get_by_text("P1 urgente", exact=False).first
        expect(kpi).to_be_visible()
