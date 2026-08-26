/**
 * Captura estabilizada de rota — o outro metade do trabalho da paridade.
 *
 * Comparar pixel-a-pixel só faz sentido se os dois lados forem capturados no
 * mesmo estado. Esse helper fixa tudo que é fixável:
 *
 * - **Viewport idêntico** (`PARITY_VIEWPORT`), pros bounding boxes casarem.
 * - **Tema igual nos dois apps.** As chaves de persistência são diferentes:
 *   o Django lê `localStorage.theme` (`templates/base.html`) e o SvelteKit lê
 *   `localStorage["hinaria-theme"]` (`src/lib/stores/theme.ts`). O init script
 *   grava as duas, e `emulateMedia({ colorScheme: "light" })` cobre o
 *   fallback por `prefers-color-scheme` que o Django usa quando não há valor
 *   salvo — sem isso, um dos lados poderia renderizar em dark.
 * - **`prefers-reduced-motion: reduce`** + CSS que zera animações, transições
 *   e o blink do caret, além do `animations: "disabled"` do próprio
 *   Playwright.
 * - **Fontes carregadas** (`document.fonts.ready`) e scroll no topo.
 * - **Máscaras** por seletor CSS pras regiões legitimamente voláteis — o caso
 *   real é o timestamp relativo ("criado há X minutos"), que o Django
 *   renderiza no servidor com `|timesince` e o SvelteKit formata no cliente.
 *   Congelar o relógio do browser não resolveria esse caso justamente porque
 *   um dos lados calcula o texto no servidor; mascarar resolve.
 * - **Esconder** (`hide`) o chrome que existe só num dos lados — o
 *   `django-debug-toolbar` do dev server, que cobre ~17% da viewport.
 */

import type { Page } from "@playwright/test";

/** Viewport único das duas capturas. Casa com `devices["Desktop Chrome"]`. */
export const PARITY_VIEWPORT = { width: 1280, height: 720 };

/** Cor chapada das máscaras — igual nas duas capturas, logo diff zero. */
const MASK_COLOR = "#ff00ff";

const CSS_FREEZE = `
  *, *::before, *::after {
    animation-delay: 0s !important;
    animation-duration: 0s !important;
    animation-iteration-count: 1 !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
    transition-delay: 0s !important;
    transition-duration: 0s !important;
  }
`;

const prepared = new WeakSet<Page>();

export type CaptureOptions = {
  /** Seletores CSS cobertos com cor chapada antes da captura. */
  mask?: string[];
  /**
   * Seletores escondidos (`display: none`) antes da captura — pra chrome que
   * existe só num dos lados. O caso real é o `django-debug-toolbar`: painel
   * fixo que ocupa ~17% da viewport no dev server do Django e não existe no
   * shell. Mascarar não resolveria (a máscara viraria diff contra o lado sem
   * painel); esconder faz a página renderizar como sem ele.
   */
  hide?: string[];
  /** `true` captura a página inteira em vez de só a viewport. */
  fullPage?: boolean;
};

/**
 * Fixa o estado do contexto. Idempotente por página — os init scripts do
 * Playwright acumulam, então só registra uma vez.
 */
export async function preparePage(page: Page): Promise<void> {
  await page.setViewportSize(PARITY_VIEWPORT);
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  if (prepared.has(page)) return;
  prepared.add(page);
  await page.addInitScript(() => {
    try {
      // Django (`templates/base.html`) e SvelteKit (`stores/theme.ts`) usam
      // chaves diferentes; gravar as duas garante o mesmo tema nos dois.
      window.localStorage.setItem("theme", "light");
      window.localStorage.setItem("hinaria-theme", "light");
    } catch {
      /* private mode / storage bloqueado — o emulateMedia já cobre o fallback */
    }
  });
}

export type RouteCapture = {
  /** PNG da captura. */
  png: Buffer;
  /** Status HTTP da navegação (0 quando o browser não reportou resposta). */
  status: number;
  /** HTML renderizado — insumo da guarda de estado de erro. */
  html: string;
};

/**
 * Navega, estabiliza e captura, devolvendo também status HTTP e HTML.
 *
 * O status e o HTML não são luxo: sem eles a suíte mediria pixels de uma
 * página 404 ou do estado de erro do shell e reportaria o resultado como se
 * fosse paridade de design.
 */
export async function captureRouteWithDiagnostics(
  page: Page,
  url: string,
  options: CaptureOptions = {},
): Promise<RouteCapture> {
  await preparePage(page);
  const response = await page.goto(url, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: CSS_FREEZE });
  const hide = options.hide ?? [];
  if (hide.length > 0) {
    await page.addStyleTag({
      content: `${hide.join(", ")} { display: none !important; }`,
    });
  }
  await page.evaluate(async () => {
    if ("fonts" in document) {
      await document.fonts.ready;
    }
    window.scrollTo(0, 0);
  });

  const png = await page.screenshot({
    animations: "disabled",
    caret: "hide",
    fullPage: options.fullPage ?? false,
    mask: (options.mask ?? []).map((selector) => page.locator(selector)),
    maskColor: MASK_COLOR,
    scale: "css",
  });

  return { png, status: response?.status() ?? 0, html: await page.content() };
}

/** Atalho pra quando só o PNG interessa. */
export async function captureRoute(
  page: Page,
  url: string,
  options: CaptureOptions = {},
): Promise<Buffer> {
  return (await captureRouteWithDiagnostics(page, url, options)).png;
}
