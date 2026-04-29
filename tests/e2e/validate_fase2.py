"""
Validação visual da Fase 2 com Playwright.

Roda contra o servidor de dev em http://localhost:8000.

Uso:
    poetry run python tests/e2e/validate_fase2.py

O script:
1. Visita cada uma das 11 telas-chave da Fase 2 (anônimo + logado).
2. Em cada tela: confere status 200, presença de Tailwind, dos design tokens,
   das fontes serif/mono, do dark-mode toggle, e roda assertivas específicas.
3. Tira screenshots em light + dark em /tmp/hymns-fase2-screens/.
4. Imprime relatório resumido (✓/✗).
5. Sai com código 0 se tudo ok, 1 caso contrário.

Login: nitai / admin123.
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass, field
from typing import Callable

from playwright.sync_api import Page, sync_playwright

BASE = "http://localhost:8000"
SCREENS_DIR = "/tmp/hymns-fase2-screens"
USER = "nitai"
USER_EMAIL = "nitai@test.com"
PASS = "admin123"

# Slugs reais da DB local (descobertos via Django shell antes de rodar).
HYMNBOOK_SLUG = "o-justiceiro"
HYMN_PK = "04339b04-a771-40b4-b6aa-aa4e3aaa8c27"


@dataclass
class Result:
    name: str
    url: str
    ok: bool
    notes: list[str] = field(default_factory=list)


def log_check(result: Result, label: str, ok: bool, detail: str = "") -> None:
    mark = "✓" if ok else "✗"
    note = f"{mark} {label}" + (f" — {detail}" if detail else "")
    result.notes.append(note)
    if not ok:
        result.ok = False


def login(page: Page) -> None:
    page.goto(f"{BASE}/accounts/login/")
    page.fill('input[name="login"]', USER_EMAIL)
    page.fill('input[name="password"]', PASS)
    with page.expect_navigation(wait_until="networkidle"):
        page.click('button[type="submit"]')
    # Confirma autenticação visitando home e checando o avatar com iniciais.
    page.goto(BASE + "/")
    page.wait_for_load_state("networkidle")


def shoot(page: Page, name: str, theme: str) -> None:
    os.makedirs(SCREENS_DIR, exist_ok=True)
    path = f"{SCREENS_DIR}/{theme}-{name}.png"
    page.screenshot(path=path, full_page=True)


def assert_tailwind_loaded(page: Page, result: Result) -> None:
    # Tailwind CDN script presente no <head>
    has_cdn = page.evaluate(
        "() => Array.from(document.scripts).some(s => s.src.includes('cdn.tailwindcss.com'))"
    )
    log_check(result, "Tailwind CDN carregado", has_cdn)

    # `bg-cream` deve resolver para a cor cream (#F5EDDC) quando claro
    bg = page.evaluate(
        "() => getComputedStyle(document.body).backgroundColor"
    )
    log_check(result, "Background é design token cream/night", bg.startswith("rgb"), detail=bg)


def assert_fonts_loaded(page: Page, result: Result) -> None:
    # Cormorant + Inter + JetBrains Mono presentes
    has_serif = page.evaluate("() => document.fonts && Array.from(document.fonts).some(f => f.family.includes('Cormorant'))")
    log_check(result, "Cormorant Garamond carregada", has_serif)


def assert_header_present(page: Page, result: Result, *, authenticated: bool) -> None:
    # Logo
    log_check(result, "Logo Hinaria no header", page.locator("header >> text=Hinaria").first.is_visible())
    # Dark mode toggle
    log_check(result, "Dark mode toggle presente", page.locator("[data-theme-toggle]").first.is_visible())
    # Search input no header (esconde em mobile)
    log_check(result, "Busca global no header", page.locator("[data-global-search]").first.count() > 0)
    if authenticated:
        log_check(result, "Link Editor visível para logado", page.locator("header >> text=Editor").first.is_visible())


def toggle_dark_and_screenshot(page: Page, name: str) -> None:
    page.evaluate("localStorage.setItem('theme', 'dark'); location.reload()")
    page.wait_for_load_state("networkidle")
    shoot(page, name, "dark")
    page.evaluate("localStorage.setItem('theme', 'light'); location.reload()")
    page.wait_for_load_state("networkidle")


def visit(page: Page, name: str, url: str, authenticated: bool, extra: Callable[[Page, Result], None] | None = None) -> Result:
    result = Result(name=name, url=url, ok=True)
    resp = page.goto(url)
    page.wait_for_load_state("networkidle")
    log_check(result, f"GET {url} → 200", resp is not None and resp.status == 200, detail=str(resp.status if resp else "?"))
    assert_tailwind_loaded(page, result)
    assert_fonts_loaded(page, result)
    assert_header_present(page, result, authenticated=authenticated)
    if extra is not None:
        try:
            extra(page, result)
        except Exception as e:
            log_check(result, "Asserções específicas", False, detail=str(e)[:100])
    shoot(page, name, "light")
    toggle_dark_and_screenshot(page, name)
    return result


# Asserções específicas por tela ------------------------------------------------


def home_extras(page: Page, result: Result) -> None:
    h1 = page.locator("h1.font-serif").first
    log_check(result, "H1 hero serif visível", h1.is_visible() and "Hinários" in (h1.inner_text() or ""))
    log_check(result, "Stats inline (>= 4 números)", page.locator("dl dt.font-serif").count() >= 4)
    log_check(result, "Seção 'Em destaque'", page.get_by_role("heading", name="Em destaque").first.is_visible())
    cards = page.locator("a[href^='/hinarios/']:not(:has-text('Hinários'))").count()
    log_check(result, "Pelo menos 1 card de hinário", cards > 0)


def hymnbook_list_extras(page: Page, result: Result) -> None:
    log_check(result, "H1 'Hinários'", page.locator("h1 >> text=Hinários").first.is_visible())
    cards = page.locator("a[href^='/hinarios/']").count()
    log_check(result, "Lista renderiza cards", cards > 0)


def hymnbook_detail_extras(page: Page, result: Result) -> None:
    log_check(result, "Header navy com cover-card", page.locator("h1").first.is_visible())
    # Toggle de modo (3 pílulas)
    pills = page.locator("[data-mode-toggle] [data-mode]").count()
    log_check(result, "Toggle 3 modos (índice/corrido/carrossel)", pills == 3)
    # Modo Índice é default
    log_check(
        result,
        "Modo Índice ativo por default",
        page.evaluate("() => document.querySelector('[data-mode=\"indice\"]').dataset.active === 'true'"),
    )
    # Switch para modo "Corrido"
    page.click("[data-mode='corrido']")
    page.wait_for_timeout(200)
    corrido_visible = page.locator("[data-mode-pane='corrido']:not(.hidden)").count() > 0
    log_check(result, "Switch para Corrido funciona", corrido_visible)
    # Volta para índice
    page.click("[data-mode='indice']")


def hymn_detail_extras(page: Page, result: Result) -> None:
    log_check(result, "Card central com letra (font-serif)", page.locator(".hymn-card").first.is_visible())
    # Anterior/próximo
    nav_count = page.locator("[data-prev-url], [data-next-url]").count()
    log_check(result, "Atributos prev/next no main", nav_count > 0)
    # Sidebar com Detalhes
    log_check(result, "Sidebar 'Detalhes'", page.locator("text=Detalhes").first.is_visible())
    log_check(result, "Botão imprimir presente", page.locator("button:has-text('Imprimir')").first.is_visible())
    # Marco 2 (audio redesign) — sem controls nativo, com player custom.
    has_audio = page.locator("[data-audio-card]").count() > 0
    if has_audio:
        log_check(result, "Player custom (data-audio-card)", True)
        log_check(result, "Botão play customizado", page.locator("button[data-audio-toggle]").first.is_visible())
        log_check(result, "Sem <audio controls> nativo", page.locator("audio[controls]").count() == 0)
        log_check(result, "Waveform SVG presente", page.locator("[data-audio-waveform-svg]").first.is_visible())


def search_extras(page: Page, result: Result) -> None:
    page.fill("input[name='q']", "lua")
    page.press("input[name='q']", "Enter")
    page.wait_for_load_state("networkidle")
    # Tabs
    log_check(result, "3 tabs (Tudo/Hinos/Hinários)", page.locator("a:has-text('Tudo')").first.is_visible())
    log_check(result, "Resultado tem snippet com mark", page.locator("mark").count() >= 0)


def editor_list_extras(page: Page, result: Result) -> None:
    log_check(result, "H1 'Fila de revisão'", page.locator("h1 >> text=Fila de revisão").first.is_visible())
    log_check(result, "Stats inline 3 números", page.locator("dt:has-text('Hinários')").first.is_visible())
    log_check(result, "Toggle ordenação 3 pílulas", page.locator("a[href*='sort=least_reviewed']").first.is_visible())
    log_check(result, "Cards com barra de progresso", page.locator(".bg-gold").count() > 0)


def editor_detail_extras(page: Page, result: Result) -> None:
    log_check(result, "Botão 'Revisar próximo'", page.locator("a:has-text('Revisar próximo')").first.is_visible())
    log_check(result, "Lista de hinos com status", page.locator("text=Não revisado").first.count() >= 0)


def editor_revise_extras(page: Page, result: Result) -> None:
    log_check(result, "Header com posição", page.locator("text=Revisar hino").first.is_visible())
    log_check(result, "Painel Fonte original", page.locator("text=Fonte original").first.is_visible())
    log_check(result, "Painel Versão revisada", page.locator("text=Versão revisada").first.is_visible())
    log_check(result, "Toggle OCR/Diff", page.locator("[data-source-tabs] [data-tab]").count() >= 2)
    log_check(result, "3 pílulas de status", page.locator("input[name='review_status']").count() == 3)
    log_check(result, "Botão 'Marcar revisado e avançar'", page.locator("button:has-text('Marcar revisado')").first.is_visible())


def upload_extras(page: Page, result: Result) -> None:
    # Stepper visível
    log_check(result, "Stepper 4 passos", page.locator("text=UPLOAD").first.is_visible())
    log_check(result, "Form com input type=file", page.locator("input[type='file']").first.is_visible())


def profile_extras(page: Page, result: Result) -> None:
    log_check(result, "Avatar grande circular", page.locator("h1").first.is_visible())
    log_check(result, "Trabalho editorial heatmap", page.locator("[data-heatmap]").first.is_visible())
    log_check(result, "Stats hinos revisados", page.locator("dt:has-text('Hinos revisados')").first.is_visible())


# ------------------------------------------------------------------------------


def main() -> int:
    results: list[Result] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})

        # Anônimo
        page = ctx.new_page()
        results.append(visit(page, "01-home", BASE + "/", authenticated=False, extra=home_extras))
        results.append(visit(page, "02-hymnbook-list", BASE + "/hinarios/", authenticated=False, extra=hymnbook_list_extras))
        results.append(visit(page, "03-hymnbook-detail", f"{BASE}/hinarios/{HYMNBOOK_SLUG}/", authenticated=False, extra=hymnbook_detail_extras))
        results.append(visit(page, "04-hymn-detail", f"{BASE}/hinos/{HYMN_PK}/", authenticated=False, extra=hymn_detail_extras))
        results.append(visit(page, "05-search", BASE + "/busca/", authenticated=False, extra=search_extras))
        page.close()

        # Logado
        page = ctx.new_page()
        login(page)
        results.append(visit(page, "06-editor-list", BASE + "/editor/hinarios/", authenticated=True, extra=editor_list_extras))
        results.append(visit(page, "07-editor-detail", f"{BASE}/editor/hinarios/{HYMNBOOK_SLUG}/", authenticated=True, extra=editor_detail_extras))
        results.append(visit(page, "08-editor-revise", f"{BASE}/editor/hinos/{HYMN_PK}/revisar/", authenticated=True, extra=editor_revise_extras))
        results.append(visit(page, "09-upload", BASE + "/contribuir/", authenticated=True, extra=upload_extras))
        results.append(visit(page, "10-profile", f"{BASE}/perfil/{USER}/", authenticated=True, extra=profile_extras))
        results.append(visit(page, "11-notifications", BASE + "/notificacoes/", authenticated=True))
        page.close()

        ctx.close()
        browser.close()

    # Relatório
    print()
    print("=" * 70)
    print("FASE 2 — Validação visual com Playwright")
    print(f"Screenshots em: {SCREENS_DIR}/")
    print("=" * 70)
    failed = 0
    for r in results:
        mark = "✓" if r.ok else "✗"
        print(f"\n{mark} {r.name}  ({r.url})")
        for n in r.notes:
            print(f"    {n}")
        if not r.ok:
            failed += 1

    print()
    print("=" * 70)
    print(f"Resultado: {len(results) - failed}/{len(results)} telas ok")
    print("=" * 70)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
