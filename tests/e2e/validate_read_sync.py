"""Validação manual com Playwright do fluxo: player tocando hino N → "Abrir hinário" → tela /ler/ posicionada no hino N.

Rodar com: `uv run python tests/e2e/validate_read_sync.py`
Pré-requisito: servidor live em http://localhost:8000 com hinário `o-cruzeiro` publicado.
"""

import sys

from playwright.sync_api import sync_playwright

BASE = "http://localhost:8000"
SLUG = "o-cruzeiro"
TARGET_HYMN = 5


def fail(msg: str) -> None:
    print(f"❌ {msg}", file=sys.stderr)
    sys.exit(1)


def ok(msg: str) -> None:
    print(f"✅ {msg}")


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1280, "height": 800})
        # Esconde Django Debug Toolbar — intercepta cliques.
        ctx.add_init_script(
            "document.addEventListener('DOMContentLoaded', function () {"
            "  var el = document.getElementById('djDebug');"
            "  if (el) el.remove();"
            "});"
        )
        page = ctx.new_page()

        # 1. Vai para o detail do hinário.
        page.goto(f"{BASE}/hinarios/{SLUG}/", wait_until="networkidle")
        ok(f"detail carregou: /hinarios/{SLUG}/")

        # 2. Verifica que o link "Abrir hinário" existe.
        abrir = page.locator('a:has-text("Abrir hinário")').first
        if not abrir.is_visible():
            fail("link 'Abrir hinário' não está visível no detail")
        ok("link 'Abrir hinário' presente no detail")

        # 3. Simula player tocando hino N do mesmo hinário, manipulando
        #    localStorage como o player.js faria. Mais determinístico que
        #    esperar áudio carregar de fato.
        page.evaluate(
            """
            ([slug, n]) => {
              const queue = [];
              for (let i = 1; i <= 10; i++) {
                queue.push({n: i, title: `Hino ${i}`, audioUrl: '', duration: 60, style: ''});
              }
              const state = {
                visible: true,
                book: {slug, name: 'O Cruzeiro', owner: 'Mestre Irineu'},
                queue,
                currentIdx: queue.findIndex(h => h.n === n),
                progress: 0,
              };
              localStorage.setItem('hinaria-player', JSON.stringify(state));
            }
            """,
            [SLUG, TARGET_HYMN],
        )
        ok(f"localStorage simula player tocando hino {TARGET_HYMN}")

        # 4. Clica no link "Abrir hinário" (hx-boost faz navegação HTMX).
        abrir.click()
        page.wait_for_url(f"{BASE}/hinarios/{SLUG}/ler/**", timeout=5000)
        ok("navegou para /ler/ via hx-boost")

        # 5. Espera o sync rodar (htmx:load + requestAnimationFrame).
        page.wait_for_timeout(500)

        # 6. Verifica que #hymn-5 está visível na viewport (scroll posicionou).
        anchor = page.locator(f"#hymn-{TARGET_HYMN}")
        if anchor.count() == 0:
            fail(f"âncora #hymn-{TARGET_HYMN} não existe no DOM")
        # bounding_box.y deve ser próximo de 0 (topo da viewport), não muito
        # positivo (abaixo) nem negativo (já passou).
        bb = anchor.bounding_box()
        if bb is None:
            fail(f"não consegui obter bounding box de #hymn-{TARGET_HYMN}")
        scroll_y = page.evaluate("window.scrollY")
        anchor_top_in_doc = page.evaluate(
            f"document.getElementById('hymn-{TARGET_HYMN}').getBoundingClientRect().top + window.scrollY"
        )
        # Espera-se que scrollY ≈ anchor_top_in_doc (block: 'start').
        delta = abs(scroll_y - anchor_top_in_doc)
        print(f"   scrollY={scroll_y:.0f}  anchor_top_in_doc={anchor_top_in_doc:.0f}  delta={delta:.0f}")
        if scroll_y < 100:
            fail(f"viewport não rolou — scrollY={scroll_y} (esperado próximo de {anchor_top_in_doc})")
        if delta > 80:  # tolerância para padding/breadcrumb
            fail(f"scroll não está alinhado com #hymn-{TARGET_HYMN} (delta {delta}px)")
        ok(f"viewport posicionada no #hymn-{TARGET_HYMN} (scrollY={scroll_y:.0f})")

        # 7. Caso negativo: navegar para hinário diferente DEVERIA abrir no hino 1.
        page.goto(f"{BASE}/hinarios/o-justiceiro/ler/", wait_until="networkidle")
        page.wait_for_timeout(500)
        scroll_y_2 = page.evaluate("window.scrollY")
        if scroll_y_2 > 100:
            fail(f"em hinário diferente do player, scroll deveria estar no topo (scrollY={scroll_y_2})")
        ok(f"hinário diferente do player → fica no topo (scrollY={scroll_y_2:.0f})")

        # 8. Caso de deep link explícito: ?hino=3 deve posicionar no 3.
        page.goto(f"{BASE}/hinarios/{SLUG}/ler/?hino=3", wait_until="networkidle")
        page.wait_for_timeout(500)
        anchor3_top = page.evaluate("document.getElementById('hymn-3').getBoundingClientRect().top + window.scrollY")
        scroll_y_3 = page.evaluate("window.scrollY")
        delta3 = abs(scroll_y_3 - anchor3_top)
        if delta3 > 80:
            fail(f"?hino=3 não posicionou: scrollY={scroll_y_3}, esperado≈{anchor3_top}")
        ok("?hino=3 (deep link explícito) posicionou no #hymn-3")

        browser.close()
        print("\n🎉 Tudo verde.")


if __name__ == "__main__":
    main()
