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

import { PARITY_VIEWPORT, captureRouteWithDiagnostics } from "./_helpers/capture";
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
import {
  type NomeDeRegiao,
  type RegiaoMedida,
  medirRegioes,
  retangulosDeRegiao,
} from "./_helpers/parity-regions";
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
/**
 * Ruído tolerado sobre o valor fixado no ratchet, em pontos percentuais.
 *
 * Existe porque o ratchet é fixado com números medidos numa máquina e o CI roda
 * noutra: rasterização de fonte e anti-aliasing diferem entre macOS e o runner
 * Linux, e uma diferença de fração de ponto não é regressão de design. O que o
 * ratchet precisa pegar são movimentos de ponto percentual inteiro — uma casca
 * que voltou a divergir, um card que perdeu o gradiente.
 *
 * Não é folga pra "caber": o teto de cada rota é o valor MEDIDO, e cada fase
 * abaixa o seu. A margem só absorve o ruído de máquina.
 */
const MARGEM_DE_RUIDO = 0.02;

/**
 * O RATCHET: teto de diff por rota, fixado no valor medido.
 *
 * Substitui o threshold único de 5% (`DEFAULT_MAX_DIFF_RATIO`), que não servia
 * pra nada nesta suíte: 4 rotas estavam tão acima dele que reprovavam sempre —
 * e uma suíte que reprova sempre não detecta regressão, só ruído de fundo — e
 * as outras 7 passavam com folga grande o bastante pra esconder uma piora
 * inteira.
 *
 * Com o teto fixado no valor medido, cada rota tem um número que só pode
 * DESCER. Uma piora reprova na hora, e cada fase do plano abaixa o teto da rota
 * que consertou. É o que transforma "64% → 95%" numa sequência de entregas
 * verificáveis em vez de um salto único.
 *
 * Valores medidos em 2026-08-31 com a fixture `e2e-paridade`, com as Fases 1
 * (fundação), 2 (casca) e 4a/4c (card de hinário + home) aplicadas. Cada fase
 * reabaixa o que consertou.
 *
 * O ratchet já provou o valor dele em operação: ao portar o card SEM portar o
 * hero da home, a `home` subiu de 8,87% pra 12,94% e a suíte REPROVOU. Os cards
 * ficaram mais altos e mais pesados, e o hero antigo da SPA desalinhou tudo
 * abaixo dele. Sem o teto por rota isso teria passado como "ainda dentro dos
 * 5%... não, dentro do vermelho de sempre" e ninguém veria. Com ele, a saída
 * foi portar o hero — que era o passo seguinte do plano de todo jeito — e a
 * home caiu pra 1,15%.
 * Ver `_plan/plano-paridade-visual-spa.md`.
 *
 * PROCEDIMENTO ao abaixar um teto: rode `pnpm test:e2e:parity`, pegue o número
 * medido na tabela do final e escreva-o aqui. Nunca arredonde pra cima.
 */
const TETO_POR_ROTA: Record<string, number> = {
  "hymnbook-indice": 0.5942,
  "hinarios-list": 0.1271,
  notifications: 0.0782,
  profile: 0.0294,
  "hymn-detail": 0.0198,
  "hymnbook-carrossel": 0.0171,
  "hymnbook-corrido": 0.015,
  "profile-followers": 0.0143,
  busca: 0.0117,
  home: 0.0115,
  "profile-following": 0.011,
};

/**
 * Teto por REGIÃO, mesmo regime do ratchet de rota.
 *
 * Fixado em 2026-08-31 junto com os de rota. Uma região sem entrada aqui é
 * apenas reportada, sem gate — é como uma região nova entra sem derrubar a
 * suíte antes de ter linha de base.
 */
const TETO_POR_REGIAO: Record<string, Partial<Record<NomeDeRegiao, number>>> = {
  // `header: 0` em 10 das 11 rotas — paridade EXATA de pixel na casca, depois
  // da Fase 2. Era ~3,4% em quase toda rota antes dela.
  //
  // A única exceção é `hymnbook-carrossel`, com 4,62% (era 8,04%): a rota
  // `/ler/` do Django tem header PRÓPRIO (minimalista, com as abas
  // Corrido/Carrossel de `hymnbook_read.html`) em vez do header global, então
  // o seletor compara dois elementos diferentes. Divergência estrutural real,
  // não ruído — e ela some quando a Fase 4 portar a tela de leitura.
  //
  // Um teto de 0 ainda tolera `MARGEM_DE_RUIDO`, porque 0,00% é o número desta
  // máquina; o runner Linux rasteriza fonte de outro jeito e vai medir algo
  // pequeno e não-zero.
  "hymnbook-indice": { header: 0, corpo: 0.6529 },
  "hinarios-list": { header: 0, corpo: 0.1397 },
  home: { header: 0, corpo: 0.0127 },
  notifications: { header: 0, corpo: 0.1056, rodape: 0.0087 },
  profile: { header: 0, corpo: 0.0323 },
  "hymn-detail": { header: 0, corpo: 0.0218 },
  "profile-followers": { header: 0, corpo: 0.0182, rodape: 0.0109 },
  "hymnbook-carrossel": { header: 0.0462, corpo: 0.0142 },
  "hymnbook-corrido": { header: 0, corpo: 0.0165 },
  "profile-following": { header: 0, corpo: 0.0137, rodape: 0.0109 },
  busca: { header: 0, corpo: 0.0129 },
};

/** Teto efetivo de uma rota: o fixado no ratchet, ou o default se não houver. */
function tetoDaRota(id: string, override?: number): number {
  if (override !== undefined) return override;
  const fixado = TETO_POR_ROTA[id];
  return fixado === undefined ? DEFAULT_MAX_DIFF_RATIO : fixado + MARGEM_DE_RUIDO;
}

/** Uma linha legível por região, pro output do runner. */
function formatarRegioes(regioes: RegiaoMedida[]): string {
  return regioes
    .map(({ nome, resultado }) =>
      resultado === null
        ? `${nome} n/d`
        : `${nome} ${formatRatio(resultado.ratio)}`,
    )
    .join(" · ");
}

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
      // Os retângulos das regiões saem da página do DJANGO — a referência —
      // e o mesmo retângulo é aplicado às duas capturas. Tem que ser lido aqui,
      // antes de navegar pro shell, porque `workPage` é reusada.
      const rectsDeRegiao = await retangulosDeRegiao(
        workPage,
        PARITY_VIEWPORT.height,
        PARITY_VIEWPORT.width,
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
      const regioes = medirRegioes(django.png, svelte.png, rectsDeRegiao);

      assertVisualParity({
        id: route.id,
        djangoShot: django.png,
        svelteShot: svelte.png,
        maxDiffPixelRatio: tetoDaRota(route.id, route.maxDiffPixelRatio),
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
            regioes: Object.fromEntries(
              regioes.map(({ nome, resultado }) => [nome, resultado?.ratio ?? null]),
            ),
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
              `(equilíbrio ${formatRatio(balance)})` +
              ` · por região: ${formatarRegioes(regioes)}${suspeito}`,
          );
        },
      });

      // ---- Gate por região. ---------------------------------------------- //
      //
      // Roda DEPOIS do gate de rota, de propósito: se o diff total estourou, a
      // mensagem que interessa é a da rota. As regiões entram pra pegar o caso
      // que o número total esconde — a casca voltar a divergir numa página cujo
      // corpo melhorou tanto que o total ainda caiu.
      const tetosDaRota = TETO_POR_REGIAO[route.id] ?? {};
      for (const { nome, resultado } of regioes) {
        const teto = tetosDaRota[nome];
        if (teto === undefined || resultado === null) continue;
        expect(
          resultado.ratio,
          `Região "${nome}" da rota "${route.id}" piorou: ` +
            `${formatRatio(resultado.ratio)} contra teto de ` +
            `${formatRatio(teto + MARGEM_DE_RUIDO)}. ` +
            "Capturas em test-results/visual-parity/.",
        ).toBeLessThanOrEqual(teto + MARGEM_DE_RUIDO);
      }
    });
  }

  test.afterAll(() => {
    const measured = readMeasurements();
    if (measured.length === 0) return;

    const dentro = measured.filter((m) => m.withinThreshold).length;
    const pct = ((dentro / measured.length) * 100).toFixed(0);
    // Passe suspeito só é armadilha pra quem CUMPRE o critério: é o "está em
    // paridade" que não está. Rota acima do critério já se declara incompleta.
    const suspeitos = measured.filter(
      (m) => m.ratio <= DEFAULT_MAX_DIFF_RATIO && m.contentBalance < EQUILIBRIO_SUSPEITO,
    );
    const linhas = measured.map((m) => {
      // Três estados, não dois. O ratchet fez "verde" mudar de significado:
      // passar agora quer dizer "não piorou", que NÃO é "está em paridade".
      // Um rótulo só para as duas coisas era como o placar de 64% virou
      // "7 de 11 passam" na cabeça de quem leu.
      //
      //   PAR  — cumpre o critério do 4.I (<=5%): está em paridade.
      //   ract — dentro do próprio teto do ratchet, mas acima do critério:
      //          não regrediu, e também não chegou.
      //   FORA — passou do próprio teto: regressão, conserta antes de seguir.
      const rotulo = !m.withinThreshold
        ? "FORA"
        : m.ratio <= DEFAULT_MAX_DIFF_RATIO
          ? m.contentBalance < EQUILIBRIO_SUSPEITO
            ? "PAR?"
            : "PAR "
          : "ract";
      const porRegiao = Object.entries(m.regioes ?? {})
        .map(([nome, ratio]) => `${nome} ${ratio === null ? "  n/d" : formatRatio(ratio).padStart(7)}`)
        .join("  ");
      return (
        `  ${rotulo} ${m.id.padEnd(20)} diff ${formatRatio(m.ratio).padStart(7)}` +
        `   teto ${formatRatio(m.maxDiffPixelRatio).padStart(7)}` +
        `   equilíbrio ${formatRatio(m.contentBalance).padStart(7)}` +
        `   tinta ${formatRatio(m.inkDjango).padStart(7)} / ${formatRatio(m.inkSvelte).padStart(7)}` +
        (porRegiao ? `\n       └─ ${porRegiao}` : "")
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
        `[paridade] ${dentro} de ${measured.length} rotas dentro do próprio teto ` +
          `do ratchet (${pct}%). O teto de cada rota é o valor MEDIDO, não o ` +
          `critério: verde aqui significa "não piorou", não "está em paridade". ` +
          `O critério do Sub-marco 4.I segue sendo <=${(DEFAULT_MAX_DIFF_RATIO * 100).toFixed(0)}% ` +
          "em >=95% das rotas — hoje: " +
          `${measured.filter((m) => m.ratio <= DEFAULT_MAX_DIFF_RATIO).length} de ${measured.length}.`,
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
