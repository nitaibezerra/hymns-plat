/**
 * Testes de sanidade da captura estabilizada.
 *
 * Uma comparação pixel-a-pixel só vale se os dois lados forem capturados no
 * MESMO estado. Aqui a gente prova, servindo HTML sintético por
 * `page.route()` (sem Django e sem SvelteKit no ar), que a preparação:
 *
 *   - liga `prefers-reduced-motion: reduce` e fixa o color-scheme claro;
 *   - grava a mesma escolha de tema nas duas chaves de `localStorage` que os
 *     dois apps usam (`theme` no Django, `hinaria-theme` no SvelteKit);
 *   - congela animações/transições;
 *   - mascara as regiões voláteis (timestamp "criado há X minutos"), de forma
 *     que duas páginas que só diferem ali batam em 0% de diff.
 */

import { expect, test } from "@playwright/test";

import { diffPngBuffers } from "./image-diff";
import {
  PARITY_VIEWPORT,
  captureRoute,
  captureRouteWithDiagnostics,
  preparePage,
} from "./capture";

const ORIGIN = "http://parity.test";

/** Serve HTML sintético num origin fake — nenhum servidor real envolvido. */
async function serve(
  page: import("@playwright/test").Page,
  path: string,
  html: string,
): Promise<string> {
  const url = `${ORIGIN}${path}`;
  await page.route(url, (route) =>
    route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }),
  );
  return url;
}

const PAGE_WITH_TIMESTAMP = (stamp: string) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body { margin: 0; background: #fff; font: 16px/1.4 monospace; }
  .box { height: 120px; background: #123; animation: slide 1s linear infinite; }
  .meta { padding: 8px; }
  @keyframes slide { from { transform: translateX(0); } to { transform: translateX(400px); } }
</style></head>
<body><div class="box"></div><p class="meta">criado ${stamp}</p></body></html>`;

test.describe("captura estabilizada (capture)", () => {
  test("liga reduced-motion e fixa o tema claro nos dois apps", async ({ page }) => {
    await preparePage(page);
    const url = await serve(page, "/estado/", PAGE_WITH_TIMESTAMP("há 1 minuto"));
    await page.goto(url);

    const state = await page.evaluate(() => ({
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      prefersDark: window.matchMedia("(prefers-color-scheme: dark)").matches,
      djangoTheme: window.localStorage.getItem("theme"),
      svelteTheme: window.localStorage.getItem("hinaria-theme"),
    }));

    expect(state.reducedMotion).toBe(true);
    expect(state.prefersDark).toBe(false);
    expect(state.djangoTheme).toBe("light");
    expect(state.svelteTheme).toBe("light");
  });

  test("captura no viewport de paridade e congela animações", async ({ page }) => {
    const url = await serve(page, "/animado/", PAGE_WITH_TIMESTAMP("há 2 minutos"));

    const first = await captureRoute(page, url);
    const second = await captureRoute(page, url);

    const diff = diffPngBuffers(first, second);
    expect(diff.width).toBe(PARITY_VIEWPORT.width);
    expect(diff.height).toBe(PARITY_VIEWPORT.height);
    // Com a animação congelada, duas capturas da mesma página são idênticas.
    expect(diff.ratio).toBe(0);
  });

  test("máscara neutraliza o timestamp volátil", async ({ page }) => {
    const antes = await serve(page, "/antes/", PAGE_WITH_TIMESTAMP("há 3 minutos"));
    const depois = await serve(page, "/depois/", PAGE_WITH_TIMESTAMP("há 41 minutos"));

    const semMascara = diffPngBuffers(
      await captureRoute(page, antes),
      await captureRoute(page, depois),
    );
    const comMascara = diffPngBuffers(
      await captureRoute(page, antes, { mask: [".meta"] }),
      await captureRoute(page, depois, { mask: [".meta"] }),
    );

    expect(semMascara.diffPixels).toBeGreaterThan(0);
    expect(comMascara.diffPixels).toBe(0);
  });

  test("seletor de máscara ausente na página não quebra a captura", async ({ page }) => {
    const url = await serve(page, "/sem-meta/", PAGE_WITH_TIMESTAMP("há 4 minutos"));
    const shot = await captureRoute(page, url, { mask: [".nao-existe", ".meta"] });
    expect(shot.byteLength).toBeGreaterThan(0);
  });

  test("hide remove overlay que só existe num dos lados", async ({ page }) => {
    // O caso real é o django-debug-toolbar: um painel fixo que cobre ~17% da
    // viewport no dev server do Django e não existe no shell SvelteKit.
    // Mascarar não resolve (a máscara também viraria diff contra o lado sem
    // painel); esconder faz a página renderizar como renderizaria sem ele.
    const limpa = await serve(page, "/limpa/", PAGE_WITH_TIMESTAMP("há 5 minutos"));
    const comOverlay = await serve(
      page,
      "/com-overlay/",
      PAGE_WITH_TIMESTAMP("há 5 minutos").replace(
        "</body>",
        `<div id="overlay" style="position:fixed;top:0;right:0;width:220px;
           height:100%;background:#0af"></div></body>`,
      ),
    );

    const semHide = diffPngBuffers(
      await captureRoute(page, limpa),
      await captureRoute(page, comOverlay),
    );
    const comHide = diffPngBuffers(
      await captureRoute(page, limpa),
      await captureRoute(page, comOverlay, { hide: ["#overlay"] }),
    );

    expect(semHide.ratio).toBeGreaterThan(0.1);
    expect(comHide.diffPixels).toBe(0);
  });

  test("diagnóstico devolve status HTTP e HTML junto com o PNG", async ({ page }) => {
    const url = `${ORIGIN}/diagnostico/`;
    await page.route(url, (route) =>
      route.fulfill({
        status: 404,
        contentType: "text/html; charset=utf-8",
        body: `<html><body><p data-testid="error">Falha ao carregar hino: HTTP 404</p></body></html>`,
      }),
    );

    const capture = await captureRouteWithDiagnostics(page, url);

    expect(capture.status).toBe(404);
    expect(capture.html).toContain("HTTP 404");
    expect(capture.png.subarray(1, 4).toString("ascii")).toBe("PNG");
  });
});
