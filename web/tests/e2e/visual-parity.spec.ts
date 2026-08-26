/**
 * Paridade visual Django ↔ SvelteKit — comparação real, medida em pixels.
 *
 * Pra cada rota da tabela:
 *
 *   1. Captura a rota no Django (`:9000`).
 *   2. Captura a rota equivalente no SvelteKit (`:5173`) — mesma corrida,
 *      mesmo browser, mesmo viewport, mesmo tema, animações congeladas,
 *      `prefers-reduced-motion: reduce`, mesmas máscaras.
 *   3. Confere que os DOIS lados renderizaram conteúdo real (status HTTP e
 *      ausência do estado de erro do shell).
 *   4. Compara as duas capturas pixel a pixel com `pixelmatch` e falha se o
 *      diff passar do threshold, emitindo o percentual medido.
 *
 * **O que mudou em relação ao Sub-marco 4.I** (e por quê):
 *
 * A versão anterior usava `expect(svelteShot).toMatchSnapshot("<id>.png")`.
 * `toMatchSnapshot` é snapshot-file-based por construção: a baseline vem do
 * disco. Na primeira corrida ela gravava a captura do **SvelteKit** como
 * baseline e, dali em diante, comparava SvelteKit contra SvelteKit — 0% de
 * diff sempre, independentemente do Django, cuja captura era só conferida com
 * `expect(djangoShot).toBeTruthy()`. O critério de aceite (">=95% das rotas
 * com diff <=5%") nunca foi medido.
 *
 * Agora não existe baseline em disco: as duas capturas são feitas ao vivo na
 * mesma corrida e comparadas uma contra a outra. Artefatos de inspeção (as
 * duas capturas + o PNG de diff) vão pra `test-results/visual-parity/`, que o
 * `web/.gitignore` já cobre — nada disso é commitado.
 *
 * **Pra rodar:**
 *
 * ```bash
 * cd web
 * ./scripts/dev-fullstack.sh
 * pnpm test:e2e:parity
 * ./scripts/dev-fullstack.sh down
 * ```
 *
 * Sem `HINARIA_E2E_PLAYWRIGHT_READY=1` a suíte fica em skip, pra CI normal não
 * depender da orquestração full-stack. Resultados e pendências ficam em
 * `_plan/marco4-diff-notes.md`.
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { captureRouteWithDiagnostics } from "./_helpers/capture";
import { authenticatedContextState, describeAuthFixture } from "./_helpers/auth-fixture";
import {
  DEFAULT_MAX_DIFF_RATIO,
  assertVisualParity,
  formatParityLine,
  type ParityOutcome,
} from "./_helpers/parity-report";
import { findLoadFailure } from "./_helpers/render-guard";

const DJANGO_BASE = process.env.HINARIA_DJANGO_BASE_URL ?? "http://localhost:9000";
const SVELTE_BASE = process.env.HINARIA_SVELTE_BASE_URL ?? "http://localhost:5173";

/** Slug de hinário publicado em dev (o-justiceiro, o-cruzeiro, selecao-ingrid, viagem). */
const HYMN_BOOK_SLUG = process.env.HINARIA_E2E_HYMNBOOK_SLUG ?? "o-justiceiro";
const USERNAME = process.env.HINARIA_E2E_USERNAME ?? "nitaibezerra";
const SEARCH_QUERY = process.env.HINARIA_E2E_SEARCH_QUERY ?? "luz";

/**
 * Máscaras aplicadas em TODAS as rotas, pras regiões legitimamente voláteis.
 *
 * O Django renderiza tempo relativo no servidor (`|timesince` → "há 3 dias",
 * "2 horas atrás") e o SvelteKit formata no cliente (`.meta`, timestamp ISO
 * curto). São textos diferentes por natureza; mascarar a região é o jeito
 * honesto de tirá-la da conta sem esconder diferença de layout. Seletor
 * ausente na página não quebra a captura.
 */
const GLOBAL_MASKS = {
  django: ['p:has-text("Membro há")', 'p:has-text("atrás")', 'span:has-text("atrás")'],
  svelte: [".meta"],
};

type Paths = { django: string; svelte: string };

type RouteCase = {
  /** Identificador estável — vira nome dos arquivos de artefato. */
  id: string;
  /** Paths dos dois lados, ou um resolvedor pra quando dependem de dado real. */
  paths: Paths | ((page: Page) => Promise<Paths>);
  /** Override do threshold pra diferença aceita e documentada em diff-notes. */
  maxDiffPixelRatio?: number;
  /** Máscaras extras específicas da rota. */
  masks?: { django?: string[]; svelte?: string[] };
  /** Rotas que exigem sessão autenticada. */
  requiresAuth?: boolean;
};

/**
 * Tabela de paridade — espelho da seção "Rotas cobertas" em
 * `_plan/marco4-diff-notes.md`. Manter as duas em sincronia.
 */
const ROUTES: ReadonlyArray<RouteCase> = [
  { id: "home", paths: { django: "/", svelte: "/" } },
  { id: "hinarios-list", paths: { django: "/hinarios/", svelte: "/hinarios/" } },
  {
    id: "hymnbook-indice",
    paths: {
      django: `/hinarios/${HYMN_BOOK_SLUG}/?mode=indice`,
      svelte: `/hinarios/${HYMN_BOOK_SLUG}/?mode=indice`,
    },
  },
  {
    id: "hymnbook-corrido",
    paths: {
      django: `/hinarios/${HYMN_BOOK_SLUG}/?mode=corrido`,
      svelte: `/hinarios/${HYMN_BOOK_SLUG}/?mode=corrido`,
    },
  },
  {
    id: "hymnbook-carrossel",
    paths: {
      django: `/hinarios/${HYMN_BOOK_SLUG}/?mode=carrossel`,
      svelte: `/hinarios/${HYMN_BOOK_SLUG}/?mode=carrossel`,
    },
  },
  // `/hinos/<pk>/` é `<uuid:pk>` nos dois lados; o pk é descoberto na hora a
  // partir do índice do hinário no Django, em vez de vir de um default fixo
  // (o `HINARIA_E2E_HYMN_PK=1` do 4.I não existia no Postgres dev e a rota
  // ficou fora da medição).
  { id: "hymn-detail", paths: resolveHymnPaths },
  {
    id: "busca",
    paths: {
      django: `/busca/?q=${encodeURIComponent(SEARCH_QUERY)}`,
      svelte: `/busca/?q=${encodeURIComponent(SEARCH_QUERY)}`,
    },
  },
  {
    id: "profile",
    paths: { django: `/perfil/${USERNAME}/`, svelte: `/perfil/${USERNAME}/` },
  },
  {
    id: "profile-followers",
    paths: {
      django: `/perfil/${USERNAME}/seguidores/`,
      svelte: `/perfil/${USERNAME}/seguidores/`,
    },
  },
  {
    id: "profile-following",
    paths: {
      django: `/perfil/${USERNAME}/seguindo/`,
      svelte: `/perfil/${USERNAME}/seguindo/`,
    },
  },
  {
    id: "notifications",
    paths: { django: "/notificacoes/", svelte: "/notificacoes/" },
    requiresAuth: true,
  },
];

/**
 * Descobre um pk de hino real lendo o primeiro link `/hinos/<uuid>/` do índice
 * do hinário no Django. `HINARIA_E2E_HYMN_PK` continua valendo como override.
 */
async function resolveHymnPaths(page: Page): Promise<Paths> {
  const fromEnv = process.env.HINARIA_E2E_HYMN_PK;
  if (fromEnv) {
    return { django: `/hinos/${fromEnv}/`, svelte: `/hinos/${fromEnv}/` };
  }

  await page.goto(`${DJANGO_BASE}/hinarios/${HYMN_BOOK_SLUG}/?mode=indice`, {
    waitUntil: "domcontentloaded",
  });
  const href = await page.locator('a[href^="/hinos/"]').first().getAttribute("href");
  const pk = href?.match(/^\/hinos\/([^/]+)\//)?.[1];
  if (!pk) {
    throw new Error(
      `Não achei nenhum link /hinos/<pk>/ no índice de "${HYMN_BOOK_SLUG}" no Django. ` +
        "Confira HINARIA_E2E_HYMNBOOK_SLUG ou passe HINARIA_E2E_HYMN_PK.",
    );
  }
  return { django: `/hinos/${pk}/`, svelte: `/hinos/${pk}/` };
}

const measured: ParityOutcome[] = [];

test.describe("Paridade visual Django ↔ SvelteKit", () => {
  test.skip(
    !process.env.HINARIA_E2E_PLAYWRIGHT_READY,
    "Setar HINARIA_E2E_PLAYWRIGHT_READY=1 e subir `web/scripts/dev-fullstack.sh` " +
      "(Django :9000 + SvelteKit :5173) antes de rodar a suíte.",
  );

  for (const route of ROUTES) {
    test(`${route.id} — diff Django ↔ SvelteKit dentro do threshold`, async ({
      browser,
      page,
    }) => {
      const contextState = route.requiresAuth ? await authenticatedContextState() : null;
      if (route.requiresAuth && !contextState) {
        // Sem fixture de auth utilizável a rota não é medível — e um skip
        // silencioso foi justamente o que deixou `/notificacoes/` fora da
        // conta no 4.I. O motivo vai explícito na mensagem.
        test.skip(true, describeAuthFixture());
      }

      const workPage = contextState
        ? await (await browser.newContext({ storageState: contextState })).newPage()
        : page;

      const paths =
        typeof route.paths === "function" ? await route.paths(workPage) : route.paths;

      const django = await captureRouteWithDiagnostics(
        workPage,
        `${DJANGO_BASE}${paths.django}`,
        { mask: [...GLOBAL_MASKS.django, ...(route.masks?.django ?? [])] },
      );
      const svelte = await captureRouteWithDiagnostics(
        workPage,
        `${SVELTE_BASE}${paths.svelte}`,
        { mask: [...GLOBAL_MASKS.svelte, ...(route.masks?.svelte ?? [])] },
      );

      // Guardas: um percentual só significa paridade se os dois lados
      // renderizaram conteúdo de verdade.
      expect(
        django.status,
        `Django respondeu ${django.status} em ${paths.django} — captura de referência inválida`,
      ).toBeLessThan(400);
      expect(
        svelte.status,
        `SvelteKit respondeu ${svelte.status} em ${paths.svelte}`,
      ).toBeLessThan(400);

      const djangoFailure = findLoadFailure(django.html);
      expect(
        djangoFailure,
        `Django renderizou estado de erro em ${paths.django}: ${djangoFailure}`,
      ).toBeNull();

      const svelteFailure = findLoadFailure(svelte.html);
      expect(
        svelteFailure,
        `SvelteKit renderizou estado de erro em ${paths.svelte}: ${svelteFailure}. ` +
          "Enquanto isso acontecer o diff mede 'página de erro vs página real', " +
          "não paridade de design — ver o bloqueador de CSRF em " +
          "_plan/marco4-diff-notes.md.",
      ).toBeNull();

      assertVisualParity({
        id: route.id,
        djangoShot: django.png,
        svelteShot: svelte.png,
        maxDiffPixelRatio: route.maxDiffPixelRatio,
        report: (outcome) => {
          measured.push(outcome);
          // eslint-disable-next-line no-console
          console.log(formatParityLine(outcome));
        },
      });
    });
  }

  test.afterAll(() => {
    if (measured.length === 0) return;
    const dentro = measured.filter((o) => o.withinThreshold).length;
    const pct = ((dentro / measured.length) * 100).toFixed(0);
    // eslint-disable-next-line no-console
    console.log(
      `\n[paridade] ${dentro} de ${measured.length} rotas medidas dentro do ` +
        `threshold de ${(DEFAULT_MAX_DIFF_RATIO * 100).toFixed(0)}% (${pct}%). ` +
        "Critério do Sub-marco 4.I: >=95%.",
    );
  });
});
