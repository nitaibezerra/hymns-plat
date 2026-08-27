/**
 * Paridade visual Django ↔ SvelteKit — comparação real, medida em pixels.
 *
 * Pra cada rota da tabela:
 *
 *   1. Captura a rota no Django (`:9000`).
 *   2. Captura a rota equivalente no SvelteKit (`:5173`) — mesma corrida,
 *      mesmo browser, mesmo viewport, mesmo tema, animações congeladas,
 *      `prefers-reduced-motion: reduce`, mesmas máscaras.
 *   3. Confere que os DOIS lados renderizaram conteúdo real: status HTTP,
 *      ausência de estado de erro, ausência de estado VAZIO e (onde a
 *      contagem significa algo) um piso de itens listados.
 *   4. Compara as duas capturas pixel a pixel com `pixelmatch` e falha se o
 *      diff passar do threshold, emitindo o percentual medido.
 *
 * **A suíte roda contra a FIXTURE, não contra o banco de dev.** Antes ela
 * apontava pra `o-justiceiro` e pro usuário `nitaibezerra`, que só existem no
 * Postgres de uma máquina — e foi por isso que as 8 specs ficaram vermelhas e
 * fora do CI. O `seed_e2e` agora semeia `e2e-paridade`: 24 hinos, 12 linhas de
 * letra cada, estilo e repetições preenchidos, um áudio aprovado e tocável,
 * mais seguidores e notificações pro editor. Densidade importa: comparar telas
 * quase vazias mede o fundo creme, não o design (ver o falso verde de
 * `/busca/` em `_plan/marco4-diff-notes.md`).
 *
 * Pra medir contra o banco de dev — hinário de 124 hinos, letra longa de
 * verdade, dezenas de áudios — sobrescreva os três env: veja
 * "Modo banco de dev" abaixo. Os dois modos foram medidos e o resultado é o
 * mesmo em ordem de grandeza; a fixture não subestima a divergência.
 *
 * **Pra rodar:**
 *
 * ```bash
 * cd web
 * ./scripts/dev-fullstack.sh          # semeia e sobe Django :9000 + SvelteKit :5173
 * pnpm test:e2e:parity
 * ./scripts/dev-fullstack.sh down
 * ```
 *
 * Sem `HINARIA_E2E_PLAYWRIGHT_READY=1` a suíte fica em skip, pra CI normal não
 * depender da orquestração full-stack. Resultados e pendências ficam em
 * `_plan/marco4-diff-notes.md`.
 *
 * **Esta suíte NÃO está na seleção do CI (`pnpm test:e2e:ci`), e é de
 * propósito.** Ela é determinística agora, mas o veredito medido é NEGATIVO: o
 * shell SvelteKit é um design diferente do monolito, não uma réplica, e o
 * critério do Sub-marco 4.I (">=95% das rotas com diff <=5%") está longe.
 * Colocá-la num check required deixaria `development` vermelho por um motivo
 * que não é regressão, e baixar o threshold pra caber no resultado seria
 * apagar o achado. Ela é o INSTRUMENTO que mede a distância; a tabela medida e
 * a hipótese de causa por rota estão na nota do plano.
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { captureRouteWithDiagnostics } from "./_helpers/capture";
import { contentBalance, formatRatio, inkRatio } from "./_helpers/image-diff";
import { describeSessionFailure, seedSession } from "./_helpers/editor-session";
import {
  PARITY_BOOK_SLUG,
  PARITY_HYMN_COUNT,
  PARITY_SEARCH_QUERY,
  SEED_BOOKS,
  describeSeedMissing,
  editorUsername,
} from "./_helpers/seed-fixture";
import {
  DEFAULT_MAX_DIFF_RATIO,
  assertVisualParity,
  formatParityLine,
  readMeasurements,
  recordMeasurement,
  resetMeasurements,
} from "./_helpers/parity-report";
import { countOccurrences, findEmptyState, findLoadFailure } from "./_helpers/render-guard";

const DJANGO_BASE = process.env.HINARIA_DJANGO_BASE_URL ?? "http://localhost:9000";
const SVELTE_BASE = process.env.HINARIA_SVELTE_BASE_URL ?? "http://localhost:5173";

/**
 * **Modo banco de dev.** Os três overrides abaixo apontam a suíte pra dados
 * reais em vez da fixture:
 *
 * ```bash
 * HINARIA_E2E_HYMNBOOK_SLUG=o-justiceiro \
 *   HINARIA_E2E_USERNAME=<usuário do banco> \
 *   HINARIA_E2E_PASSWORD=<senha dele> \
 *   HINARIA_E2E_SEARCH_QUERY=luz \
 *   pnpm test:e2e:parity
 * ```
 *
 * Vale pra conferir que a fixture não está escondendo divergência (foi feito;
 * ver a nota do plano). Não serve pra CI: o banco de dev não existe lá.
 */
const HYMN_BOOK_SLUG = process.env.HINARIA_E2E_HYMNBOOK_SLUG ?? PARITY_BOOK_SLUG;
const USERNAME = process.env.HINARIA_E2E_USERNAME ?? editorUsername();
const SEARCH_QUERY = process.env.HINARIA_E2E_SEARCH_QUERY ?? PARITY_SEARCH_QUERY;

/** `true` quando a suíte está medindo a fixture semeada. */
const MODO_FIXTURE = HYMN_BOOK_SLUG === PARITY_BOOK_SLUG;

/** Hinários publicados da fixture — o que aparece em `/` e em `/hinarios/`. */
const SEED_PUBLICADOS = SEED_BOOKS.filter((book) => book.isPublished).length;

/**
 * Equilíbrio de densidade de conteúdo abaixo do qual um "passou" é SUSPEITO.
 *
 * Não é gate — é rótulo. O threshold de 5% do Sub-marco 4.I conta pixels do
 * viewport inteiro, e numa página que é 95% fundo creme QUALQUER conteúdo
 * divergente cabe nos 5%. Medido em 2026-08-27: `hymnbook-corrido` deu 1,95%
 * de diff (PASSA) com 40,36% de tinta no Django contra 2,16% no shell — as
 * duas capturas em `test-results/visual-parity/` são visivelmente outro
 * design. O rótulo existe pra esse "passou" não ser lido como paridade.
 */
const EQUILIBRIO_SUSPEITO = 0.5;

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

/**
 * Chrome escondido antes da captura, porque existe só num dos lados.
 *
 * O `django-debug-toolbar` roda no dev server do Django (`config.settings.local`)
 * e o painel abre expandido, cobrindo ~220px da direita da viewport — ~16% da
 * área. Não existe no shell SvelteKit. Medido: comparando o Django contra ELE
 * MESMO, a rota `profile` dava 1,52% de diff só pelo texto de CPU/queries do
 * painel, que muda a cada request; contra o SvelteKit o painel inteiro entraria
 * na conta como se fosse divergência de design.
 */
const GLOBAL_HIDE = {
  django: ["#djDebug"],
  svelte: [] as string[],
};

/**
 * Modo auto-verificação: `HINARIA_E2E_SELF_COMPARE=1` aplica as máscaras e os
 * `hide` do Django aos DOIS lados. Aponte as duas bases pro mesmo app e o diff
 * tem que cair no chão de ruído — é como se prova que a suíte compara duas
 * capturas ao vivo, e não uma baseline em disco contra si mesma (o bug do
 * Sub-marco 4.I passaria "verde" nesse teste tanto quanto num real).
 *
 * ```bash
 * HINARIA_E2E_SELF_COMPARE=1 \
 *   HINARIA_DJANGO_BASE_URL=http://localhost:9000 \
 *   HINARIA_SVELTE_BASE_URL=http://localhost:9000 \
 *   pnpm test:e2e:parity
 * ```
 */
const SELF_COMPARE = !!process.env.HINARIA_E2E_SELF_COMPARE;

type Paths = { django: string; svelte: string };

/** Piso de itens listados, contado no HTML CRU dos dois lados. */
type ContentFloor = {
  /** Trecho literal a contar (`href="/hinos/` casa nos dois apps). */
  needle: string;
  /** Mínimo exigido em cada lado. */
  min: number;
};

type RouteCase = {
  /** Identificador estável — vira nome dos arquivos de artefato. */
  id: string;
  /** Paths dos dois lados, ou um resolvedor pra quando dependem de dado real. */
  paths: Paths | ((page: Page) => Promise<Paths>);
  /** Override do threshold pra diferença aceita e documentada em diff-notes. */
  maxDiffPixelRatio?: number;
  /** Máscaras extras específicas da rota. */
  masks?: { django?: string[]; svelte?: string[] };
  /** Seletores extras a esconder, específicos da rota. */
  hide?: { django?: string[]; svelte?: string[] };
  /** Rotas que exigem sessão autenticada em pelo menos um dos lados. */
  requiresAuth?: boolean;
  /** Piso de conteúdo, quando contar itens diz algo (só no modo fixture). */
  floor?: ContentFloor;
};

/**
 * Tabela de paridade — espelho da seção "Rotas cobertas" em
 * `_plan/marco4-diff-notes.md`. Manter as duas em sincronia.
 *
 * **Duas rotas não têm o mesmo path nos dois lados**, e isso é achado, não
 * descuido: no Django, `?mode=corrido|carrossel` em `/hinarios/<slug>/`
 * **redireciona** pra `/hinarios/<slug>/ler/?modo=…` (a leitura virou view
 * própria), enquanto o shell manteve o `?mode=` na mesma rota. A tabela aponta
 * pro destino final de cada lado em vez de depender do redirect legado, que
 * pode sair a qualquer momento.
 */
const ROUTES: ReadonlyArray<RouteCase> = [
  // O piso é o número de hinários PUBLICADOS da fixture: é o que os dois lados
  // têm obrigação de listar. Contagens exatas divergem de propósito — o Django
  // repete `href="/hinarios/` na navegação e o shell usa `/hinarios` sem barra
  // no menu — e exigir igualdade mediria o markup, não o conteúdo.
  {
    id: "home",
    paths: { django: "/", svelte: "/" },
    floor: { needle: 'href="/hinarios/', min: SEED_PUBLICADOS },
  },
  {
    id: "hinarios-list",
    paths: { django: "/hinarios/", svelte: "/hinarios/" },
    floor: { needle: 'href="/hinarios/', min: SEED_PUBLICADOS },
  },
  {
    id: "hymnbook-indice",
    paths: {
      django: `/hinarios/${HYMN_BOOK_SLUG}/?mode=indice`,
      svelte: `/hinarios/${HYMN_BOOK_SLUG}/?mode=indice`,
    },
    floor: { needle: 'href="/hinos/', min: Math.min(20, PARITY_HYMN_COUNT) },
  },
  {
    id: "hymnbook-corrido",
    paths: {
      django: `/hinarios/${HYMN_BOOK_SLUG}/ler/?modo=corrido`,
      svelte: `/hinarios/${HYMN_BOOK_SLUG}/?mode=corrido`,
    },
  },
  {
    id: "hymnbook-carrossel",
    paths: {
      django: `/hinarios/${HYMN_BOOK_SLUG}/ler/?modo=carrossel`,
      svelte: `/hinarios/${HYMN_BOOK_SLUG}/?mode=carrossel`,
    },
  },
  // `/hinos/<pk>/` é `<uuid:pk>` nos dois lados; o pk é descoberto na hora a
  // partir do índice do hinário no Django, em vez de vir de um default fixo
  // (o `HINARIA_E2E_HYMN_PK=1` do 4.I não existia no Postgres e a rota ficou
  // fora da medição).
  { id: "hymn-detail", paths: resolveHymnPaths },
  {
    id: "busca",
    paths: {
      django: `/busca/?q=${encodeURIComponent(SEARCH_QUERY)}`,
      svelte: `/busca/?q=${encodeURIComponent(SEARCH_QUERY)}`,
    },
    floor: { needle: 'href="/hinos/', min: 1 },
  },
  {
    id: "profile",
    paths: { django: `/perfil/${USERNAME}/`, svelte: `/perfil/${USERNAME}/` },
  },
  // `/seguidores/` e `/seguindo/` são `@login_required` no Django
  // (`apps/users/views_social.py`) e PÚBLICAS no shell. Medido: como anônimo,
  // o Django devolve 302 pro `/accounts/login/` e o shell renderiza a lista —
  // a comparação media página de login contra página real. Com sessão as duas
  // medem a mesma tela. A divergência de gate está registrada na nota.
  {
    id: "profile-followers",
    paths: {
      django: `/perfil/${USERNAME}/seguidores/`,
      svelte: `/perfil/${USERNAME}/seguidores/`,
    },
    requiresAuth: true,
  },
  {
    id: "profile-following",
    paths: {
      django: `/perfil/${USERNAME}/seguindo/`,
      svelte: `/perfil/${USERNAME}/seguindo/`,
    },
    requiresAuth: true,
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
        `${describeSeedMissing()} Ou passe HINARIA_E2E_HYMNBOOK_SLUG / HINARIA_E2E_HYMN_PK.`,
    );
  }
  return { django: `/hinos/${pk}/`, svelte: `/hinos/${pk}/` };
}



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
      // A primeira rota da tabela limpa o placar da corrida anterior. Roda uma
      // vez só por corrida, falhe ela ou não — e o placar tem que viver em
      // disco porque o Playwright reinicia o worker depois de cada falha (ver
      // `_helpers/parity-report.ts`).
      if (route.id === ROUTES[0].id) resetMeasurements();

      let workPage = page;
      if (route.requiresAuth) {
        // A sessão sai da mutation `login` de verdade (`_helpers/editor-session`),
        // não do form do django-admin: aquele exige `is_staff`, e dar staff ao
        // editor da fixture o faria passar por gates que um editor comum não
        // passa. Falha de login é ERRO com motivo, nunca skip silencioso — foi
        // um skip desses que deixou `/notificacoes/` fora da conta no 4.I.
        const session = await seedSession(USERNAME);
        expect(session, describeSessionFailure(USERNAME)).not.toBeNull();
        const context = await browser.newContext({ storageState: session!.state });
        workPage = await context.newPage();
      }

      const paths =
        typeof route.paths === "function" ? await route.paths(workPage) : route.paths;

      // Django primeiro, e nesta ordem de propósito: `/notificacoes/` do
      // Django MARCA as não lidas como lidas ao renderizar
      // (`views_social.notifications_list`), enquanto o shell só lê. Capturando
      // o Django antes, os dois lados mostram os mesmos itens já lidos; ao
      // contrário, o shell mostraria "não lida" e o Django não.
      const django = await captureRouteWithDiagnostics(
        workPage,
        `${DJANGO_BASE}${paths.django}`,
        {
          mask: [...GLOBAL_MASKS.django, ...(route.masks?.django ?? [])],
          hide: [...GLOBAL_HIDE.django, ...(route.hide?.django ?? [])],
        },
      );
      const svelte = await captureRouteWithDiagnostics(
        workPage,
        `${SVELTE_BASE}${paths.svelte}`,
        {
          mask: SELF_COMPARE
            ? [...GLOBAL_MASKS.django, ...(route.masks?.django ?? [])]
            : [...GLOBAL_MASKS.svelte, ...(route.masks?.svelte ?? [])],
          hide: SELF_COMPARE
            ? [...GLOBAL_HIDE.django, ...(route.hide?.django ?? [])]
            : [...GLOBAL_HIDE.svelte, ...(route.hide?.svelte ?? [])],
        },
      );

      // ---- Guardas: um percentual só significa paridade se os dois lados
      // renderizaram conteúdo de verdade. --------------------------------- //

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
          "não paridade de design.",
      ).toBeNull();

      // Estado VAZIO é o falso verde caro: duas páginas majoritariamente fundo
      // creme batem em pixels mesmo dizendo coisas opostas. Medido em
      // 2026-08-26: `/busca/?q=luz` deu 1,74% (PASSA no threshold de 5%) com o
      // Django listando 50 resultados e o shell dizendo "Nenhum resultado".
      const djangoEmpty = findEmptyState(django.html);
      expect(
        djangoEmpty,
        `Django renderizou estado vazio em ${paths.django} (${djangoEmpty}). ` +
          `${describeSeedMissing()}`,
      ).toBeNull();

      const svelteEmpty = findEmptyState(svelte.html);
      expect(
        svelteEmpty,
        `SvelteKit renderizou estado vazio em ${paths.svelte} (${svelteEmpty}) ` +
          "enquanto o Django tem conteúdo — o diff mediria o fundo, não o design.",
      ).toBeNull();

      // Piso de itens: onde contar diz algo, exige o mesmo mínimo dos dois
      // lados. `href="/hinos/` e `href="/hinarios/` casam nos dois apps porque
      // as ROTAS são as mesmas — é o contrato do refactor headless. Só no modo
      // fixture: no banco de dev as contagens são outras.
      if (route.floor && MODO_FIXTURE) {
        const { needle, min } = route.floor;
        const naDjango = countOccurrences(django.html, needle);
        const naSvelte = countOccurrences(svelte.html, needle);
        expect(
          naDjango,
          `Django listou ${naDjango} ocorrências de ${needle} em ${paths.django}, ` +
            `esperado >= ${min}. ${describeSeedMissing()}`,
        ).toBeGreaterThanOrEqual(min);
        expect(
          naSvelte,
          `SvelteKit listou ${naSvelte} ocorrências de ${needle} em ${paths.svelte}, ` +
            `esperado >= ${min}, e o Django listou ${naDjango} — um dos lados não ` +
            "renderizou a lista.",
        ).toBeGreaterThanOrEqual(min);
      }

      // ---- Medição. ------------------------------------------------------ //
      //
      // Densidade de tinta entra como DIAGNÓSTICO, não como gate. Havia um
      // gate (`contentBalance > 0.5`) e ele barrou justamente a medição que o
      // 4.I pede: o shell é um design mais esparso que o monolito — sem hero
      // com arte de capa, sem faixa de cor, sem tag de estilo por linha — então
      // a tinta desequilibra POR DESIGN. Medido com a fixture inteira na tela
      // dos dois lados: `hymnbook-indice` com 64,12% de tinta no Django contra
      // 3,69% no shell. Isso é o achado; transformá-lo em "não medi" perdia a
      // informação. O que separa "esparso" de "não renderizou" são as guardas
      // acima, que olham o que a página DIZ.
      assertVisualParity({
        id: route.id,
        djangoShot: django.png,
        svelteShot: svelte.png,
        maxDiffPixelRatio: route.maxDiffPixelRatio,
        report: (outcome) => {
          const inkDjango = inkRatio(django.png);
          const inkSvelte = inkRatio(svelte.png);
          const balance = contentBalance(django.png, svelte.png);
          recordMeasurement({
            id: outcome.id,
            ratio: outcome.ratio,
            maxDiffPixelRatio: outcome.maxDiffPixelRatio,
            withinThreshold: outcome.withinThreshold,
            contentBalance: balance,
            inkDjango,
            inkSvelte,
          });
          const suspeito =
            outcome.withinThreshold && balance < EQUILIBRIO_SUSPEITO
              ? " · PASSE SUSPEITO: passou no threshold com densidade de conteúdo" +
                ` desequilibrada (${formatRatio(balance)}) — ver as capturas em` +
                " test-results/visual-parity/"
              : "";
          // eslint-disable-next-line no-console
          console.log(
            `${formatParityLine(outcome)} · tinta Django ${formatRatio(inkDjango)} ` +
              `vs shell ${formatRatio(inkSvelte)} ` +
              `(equilíbrio ${formatRatio(balance)})${suspeito}`,
          );
        },
      });
    });
  }

  test.afterAll(() => {
    const measured = readMeasurements();
    if (measured.length === 0) return;

    const dentro = measured.filter((m) => m.withinThreshold).length;
    const pct = ((dentro / measured.length) * 100).toFixed(0);
    const suspeitos = measured.filter(
      (m) => m.withinThreshold && m.contentBalance < EQUILIBRIO_SUSPEITO,
    );
    const linhas = measured.map((m) => {
      const rotulo = m.withinThreshold
        ? m.contentBalance < EQUILIBRIO_SUSPEITO
          ? "OK?"
          : "OK "
        : "FORA";
      return (
        `  ${rotulo} ${m.id.padEnd(20)} diff ${formatRatio(m.ratio).padStart(7)}` +
        `   equilíbrio ${formatRatio(m.contentBalance).padStart(7)}` +
        `   tinta ${formatRatio(m.inkDjango).padStart(7)} / ${formatRatio(m.inkSvelte).padStart(7)}`
      );
    });
    const incompleto =
      measured.length < ROUTES.length
        ? `[paridade] placar INCOMPLETO: ${measured.length} de ${ROUTES.length} rotas ` +
          "chegaram a medir. As que faltam foram recusadas por uma guarda (status, " +
          "estado de erro, estado vazio ou piso de conteúdo) — o motivo está no erro " +
          "da rota, acima."
        : "";

    // eslint-disable-next-line no-console
    console.log(
      [
        "",
        "[paridade] tabela medida " +
          `(${MODO_FIXTURE ? `fixture ${PARITY_BOOK_SLUG}` : `banco de dev · ${HYMN_BOOK_SLUG}`})` +
          " — colunas: diff de pixels · equilíbrio de densidade · tinta Django/shell:",
        ...linhas,
        "",
        `[paridade] ${dentro} de ${measured.length} rotas medidas dentro do ` +
          `threshold de ${(DEFAULT_MAX_DIFF_RATIO * 100).toFixed(0)}% (${pct}%). ` +
          "Critério do Sub-marco 4.I: >=95%.",
        incompleto,
        suspeitos.length > 0
          ? `[paridade] ATENÇÃO: ${suspeitos.length} das ${dentro} rotas dentro do ` +
            `threshold são PASSES SUSPEITOS (${suspeitos.map((m) => m.id).join(", ")}) — ` +
            "passaram porque a página é majoritariamente fundo, não porque as duas " +
            "telas são iguais. O percentual acima SUPERESTIMA a paridade; ver a " +
            "análise em _plan/marco4-diff-notes.md."
          : "",
        "",
      ]
        .filter((linha) => linha !== "")
        .join("\n"),
    );
  });
});
