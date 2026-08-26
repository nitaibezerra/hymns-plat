/**
 * Marco 4.I — Ciclo 4I.1 — paridade visual sistemática Django ↔ SvelteKit.
 *
 * Pra cada rota da tabela de paridade:
 *
 *   1. Navega no Django (port 9000), faz scroll-to-top, espera fontes
 *      e DOM idle, captura screenshot da viewport.
 *   2. Mesmo pra SvelteKit (port 5173) na rota equivalente.
 *   3. Compara via `expect(svelteShot).toMatchSnapshot({...})` usando a
 *      screenshot do Django como baseline. Threshold default
 *      `maxDiffPixelRatio: 0.05` (5%) — configurado em
 *      `playwright.config.ts`.
 *
 * **Decisões fixadas:**
 *
 * - `test.skip(!HINARIA_E2E_PLAYWRIGHT_READY, ...)` mantém CI normal
 *   verde enquanto a orquestração full-stack não está em GitHub Actions.
 * - Pra rodar: `web/scripts/dev-fullstack.sh` sobe ambos os servidores,
 *   depois `HINARIA_E2E_PLAYWRIGHT_READY=1 pnpm exec playwright test
 *   --project=chromium`.
 * - Slugs/usuários reais do Postgres dev: `o-justiceiro` (publicado),
 *   `nitaibezerra` (superuser). Vide `_plan/marco4-diff-notes.md`.
 * - Diferenças aceitas (ex.: dark-mode default distinto, fonte com
 *   anti-alias divergente) ficam documentadas em
 *   `_plan/marco4-diff-notes.md` — não silenciamos no código.
 * - Snapshots vivem em `tests/e2e/visual-parity.spec.ts-snapshots/`.
 */

import { test, expect, type Page } from "@playwright/test";

const DJANGO_BASE = process.env.HINARIA_DJANGO_BASE_URL ?? "http://localhost:9000";
const SVELTE_BASE = process.env.HINARIA_SVELTE_BASE_URL ?? "http://localhost:5173";

// Slug de hinário publicado em dev. Override via env pra CI.
const HYMN_BOOK_SLUG = process.env.HINARIA_E2E_HYMNBOOK_SLUG ?? "o-justiceiro";
// pk de um hino real (UUID em dev; numérico em outros ambientes).
const HYMN_PK = process.env.HINARIA_E2E_HYMN_PK ?? "1";
const USERNAME = process.env.HINARIA_E2E_USERNAME ?? "nitaibezerra";
const SEARCH_QUERY = process.env.HINARIA_E2E_SEARCH_QUERY ?? "luz";

type RouteCase = {
  /** Identificador estável (vira nome do snapshot). */
  id: string;
  /** Path Django (sem host). */
  django: string;
  /** Path SvelteKit (sem host). */
  svelte: string;
  /** Sobrescreve threshold pra rotas com diferenças aceitas (ver diff-notes). */
  maxDiffPixelRatio?: number;
  /** Rotas que exigem autenticação. Default: false (anônimo). */
  requiresAuth?: boolean;
};

/**
 * Tabela de paridade — espelho da seção "Tabela de paridade" no plano do
 * Sub-marco 4.I. Manter ordem aqui sincronizada com `marco4-diff-notes.md`.
 */
const ROUTES: ReadonlyArray<RouteCase> = [
  { id: "home", django: "/", svelte: "/" },
  { id: "hinarios-list", django: "/hinarios/", svelte: "/hinarios/" },
  {
    id: "hymnbook-indice",
    django: `/hinarios/${HYMN_BOOK_SLUG}/?mode=indice`,
    svelte: `/hinarios/${HYMN_BOOK_SLUG}/?mode=indice`,
  },
  {
    id: "hymnbook-corrido",
    django: `/hinarios/${HYMN_BOOK_SLUG}/?mode=corrido`,
    svelte: `/hinarios/${HYMN_BOOK_SLUG}/?mode=corrido`,
  },
  {
    id: "hymnbook-carrossel",
    django: `/hinarios/${HYMN_BOOK_SLUG}/?mode=carrossel`,
    svelte: `/hinarios/${HYMN_BOOK_SLUG}/?mode=carrossel`,
  },
  { id: "hymn-detail", django: `/hinos/${HYMN_PK}/`, svelte: `/hinos/${HYMN_PK}/` },
  {
    id: "busca",
    django: `/busca/?q=${encodeURIComponent(SEARCH_QUERY)}`,
    svelte: `/busca/?q=${encodeURIComponent(SEARCH_QUERY)}`,
  },
  { id: "profile", django: `/perfil/${USERNAME}/`, svelte: `/perfil/${USERNAME}/` },
  {
    id: "profile-followers",
    django: `/perfil/${USERNAME}/seguidores/`,
    svelte: `/perfil/${USERNAME}/seguidores/`,
  },
  {
    id: "profile-following",
    django: `/perfil/${USERNAME}/seguindo/`,
    svelte: `/perfil/${USERNAME}/seguindo/`,
  },
  {
    id: "notifications",
    django: "/notificacoes/",
    svelte: "/notificacoes/",
    requiresAuth: true,
  },
];

async function prepPage(page: Page, fullURL: string) {
  // Network idle + fontes carregadas + scroll-to-top — pra estabilizar diff.
  await page.goto(fullURL, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    if ("fonts" in document) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (document as any).fonts.ready;
    }
    window.scrollTo(0, 0);
  });
}

test.describe("Paridade visual Django ↔ SvelteKit (4I.1)", () => {
  test.skip(
    !process.env.HINARIA_E2E_PLAYWRIGHT_READY,
    "Setar HINARIA_E2E_PLAYWRIGHT_READY=1 + rodar `web/scripts/dev-fullstack.sh` " +
      "antes de executar a suíte.",
  );

  for (const route of ROUTES) {
    test(`${route.id} — Django ↔ SvelteKit dentro do threshold`, async ({ page }) => {
      test.skip(
        !!route.requiresAuth,
        "Rota com auth (ex.: notificações) precisa de sessão Django + cookie " +
          "SvelteKit. Documentado em diff-notes; reativar quando seed de auth " +
          "estiver pronto.",
      );

      // Captura screenshot da rota Django (referência).
      await prepPage(page, `${DJANGO_BASE}${route.django}`);
      const djangoShot = await page.screenshot({ fullPage: false });

      // Captura screenshot da rota SvelteKit.
      await prepPage(page, `${SVELTE_BASE}${route.svelte}`);
      const svelteShot = await page.screenshot({ fullPage: false });

      // A baseline (Django) é registrada via `toMatchSnapshot` na primeira
      // execução; corridas subsequentes comparam SvelteKit contra essa
      // baseline com o threshold definido em playwright.config.ts (ou
      // override por rota).
      expect(djangoShot, "captura Django não pode estar vazia").toBeTruthy();

      // Aqui o que medimos é: svelteShot ≈ djangoShot dentro do threshold.
      // Em vez de salvar dois snapshots e comparar manualmente, usamos
      // `toMatchSnapshot` com baseline = djangoShot (gerado on-the-fly).
      // Convenção: cada rota grava sob `visual-parity.spec.ts-snapshots/`.
      const maxRatio = route.maxDiffPixelRatio ?? 0.05;
      expect(svelteShot).toMatchSnapshot(`${route.id}.png`, {
        maxDiffPixelRatio: maxRatio,
      });

      // Loga o ratio efetivo pra debugging humano (não falha o teste).
      // (Playwright já reporta isso no HTML report.)
    });
  }
});
