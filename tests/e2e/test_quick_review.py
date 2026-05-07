"""E2E para a tela 07c · Revisão ágil · Estilo & Repetições.

Pré-requisitos:
- `uv run python manage.py runserver 9000` rodando contra DB local.
- Seed compartilhado com `test_revise_hymn_v3.py` (HymnBook 'e2e-test-book',
  3 hinos, user `teste2e@example.com` no grupo `editor`).

Cobre:
- Atalho `V` ativa o tile "Valsa" (campo `style`).
- Atalho `2` seta `repetitions=1-4` (preset).
- `→` navega para o próximo hino sem salvar.
- Botão primário POSTa, banco atualizado, redireciona pro próximo.
- Atalhos pausam quando input manual de repetições tem foco.
- Mini-diagrama de `1-2,3-4,1-4` posiciona barra `1-4` à ESQUERDA
  (regra de column-packing).
"""

import os
import subprocess
from pathlib import Path

import pytest
from playwright.sync_api import expect

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SEED_BOOK = "e2e-test-book"


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
    """Reusa o mesmo seed do test_revise_hymn_v3 + reset de style/repetitions."""
    code = (
        "from django.contrib.auth.models import Group;"
        "from apps.hymns.models import Hymn, HymnBook;"
        "from apps.users.models import User;"
        f"hb, _ = HymnBook.objects.get_or_create(slug={SEED_BOOK!r}, defaults={{'name': 'E2E Test Book', 'owner_name': 'E2E', 'is_published': False}});"
        "Hymn.objects.update_or_create(hymn_book=hb, number=1, defaults={'title': 'Lua Branca', 'text': 'Lua branca\\nClareando', 'style': '', 'repetitions': '', 'review_status': 'not_reviewed'});"
        "Hymn.objects.update_or_create(hymn_book=hb, number=2, defaults={'title': 'Sol da Manha', 'text': 'Sol da manha\\nQue ilumina', 'style': '', 'repetitions': '', 'review_status': 'not_reviewed'});"
        "Hymn.objects.update_or_create(hymn_book=hb, number=3, defaults={'title': 'Estrela', 'text': 'Estrela brilhante\\nNo ceu', 'style': '', 'repetitions': '', 'review_status': 'not_reviewed'});"
        "ed, _ = Group.objects.get_or_create(name='editor');"
        "u, _ = User.objects.get_or_create(email='teste2e@example.com', defaults={'username': 'teste2e', 'is_active': True});"
        "u.groups.add(ed);"
        "print('seeded')"
    )
    _shell(code)


def _hymn_field(number: int, field: str) -> str:
    """Lê um campo do hino e devolve a string. Wrapper `<<...>>` evita que
    valores vazios deixem a heurística "última linha não-vazia" do _shell()
    pegar warnings do `manage.py shell` (ex.: "57 objects imported…")."""
    raw = _shell(
        "from apps.hymns.models import Hymn;"
        f"h = Hymn.objects.get(hymn_book__slug={SEED_BOOK!r}, number={number});"
        f"print(f'<<{{getattr(h, {field!r})}}>>')"
    )
    if raw.startswith("<<") and raw.endswith(">>"):
        return raw[2:-2]
    return raw


@pytest.fixture(autouse=True)
def reset_seed():
    _ensure_seed()
    yield
    _ensure_seed()


@pytest.fixture
def quick_url(base_url):
    return f"{base_url}/editor/hinarios/{SEED_BOOK}/agil/"


class TestQuickReviewShortcuts:
    def test_v_shortcut_activates_valsa_tile(self, authenticated_page, quick_url):
        authenticated_page.goto(quick_url)
        authenticated_page.keyboard.press("V")
        valsa = authenticated_page.locator('[data-quick-tile="style"][data-value="Valsa"]')
        expect(valsa).to_have_attribute("data-active", "true")

    def test_2_shortcut_sets_repetitions_to_1_4(self, authenticated_page, quick_url):
        authenticated_page.goto(quick_url)
        authenticated_page.keyboard.press("2")
        reps = authenticated_page.locator("[data-quick-reps]").input_value()
        assert reps == "1-4"

    def test_arrow_right_navigates_without_saving(self, authenticated_page, quick_url):
        authenticated_page.goto(quick_url + "?h=1")
        # Muda o estilo via tile mas NÃO salva — só seta visual + hidden input.
        authenticated_page.keyboard.press("V")
        # Navega sem salvar
        authenticated_page.keyboard.press("ArrowRight")
        import re

        expect(authenticated_page).to_have_url(re.compile(r"h=2"), timeout=4000)
        # Banco do hino 1 não mudou
        assert _hymn_field(1, "style") == ""

    def test_enter_submits_form_and_advances(self, authenticated_page, quick_url):
        authenticated_page.goto(quick_url + "?h=1")
        authenticated_page.keyboard.press("M")  # Marcha
        authenticated_page.keyboard.press("1")  # 1-2,3-4
        authenticated_page.keyboard.press("Enter")
        import re

        expect(authenticated_page).to_have_url(re.compile(r"h=2"), timeout=4000)
        assert _hymn_field(1, "style") == "Marcha"
        assert _hymn_field(1, "repetitions") == "1-2,3-4"

    def test_shortcuts_paused_when_reps_input_focused(self, authenticated_page, quick_url):
        authenticated_page.goto(quick_url)
        # Foca no input manual e digita "2"; com o pause, não deve trocar para preset 1-4.
        manual = authenticated_page.locator("[data-quick-reps]")
        manual.click()
        # O input começa vazio (seed). Digita "5".
        manual.type("5")
        # Esperamos que o valor seja literalmente "5" (não 1-4 do preset).
        assert manual.input_value() == "5"
        # Tile do preset 1-4 NÃO deve estar ativo.
        preset = authenticated_page.locator('[data-quick-tile="repetitions"][data-value="1-4"]')
        active = preset.get_attribute("data-active")
        assert active != "true"


class TestQuickReviewMiniDiagram:
    def test_overlapping_ranges_outer_to_left(self, authenticated_page, quick_url):
        """1-2,3-4,1-4: 2 colunas. Barra cobrindo 1-4 fica MAIS À ESQUERDA
        que as barras que cobrem só 2 linhas."""
        authenticated_page.goto(quick_url)
        tile = authenticated_page.locator('[data-quick-tile="repetitions"][data-value="1-2,3-4,1-4"]')
        bars = tile.locator(".quick-mini-bar")
        # Espera 3 barras (1-2, 3-4, 1-4)
        expect(bars).to_have_count(3)
        # Pega altura de cada barra para identificar qual é a 1-4 (a mais alta)
        bbs = []
        count = bars.count()
        for i in range(count):
            box = bars.nth(i).bounding_box()
            bbs.append((box["x"], box["height"]))
        bbs.sort(key=lambda t: -t[1])  # mais alta primeiro
        long_bar_x = bbs[0][0]
        short_bar_xs = [t[0] for t in bbs[1:]]
        # Barra mais alta (1-4) deve estar à esquerda das mais curtas
        assert all(long_bar_x < x for x in short_bar_xs), (
            f"Barra englobante (1-4, x={long_bar_x:.1f}) precisa estar à esquerda " f"das menores (xs={short_bar_xs})."
        )
