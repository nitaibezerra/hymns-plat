/**
 * Contrato da fixture de seed, do lado do Playwright.
 *
 * Espelho fiel de `apps/hymns/management/commands/seed_e2e.py`. As duas pontas
 * precisam concordar em nomes, slugs, contagens e ORDEM — é isso que separa
 * "a suíte falhou porque a UI regrediu" de "a suíte falhou porque o banco era
 * outro". Quando um lado mudar, o outro muda junto; `tests/unit/test_seed_e2e.py`
 * trava o lado Python e `seed-fixture.test.ts` trava a coerência daqui.
 *
 * Os defaults de usuário/senha são os MESMOS do comando e os mesmos que
 * `scripts/dev-fullstack.sh` imprime em `env` — quem subiu o ambiente pelo
 * script não precisa exportar nada.
 */

/** Prefixo de tudo que o seed cria. Distingue "meu dado" de dado de dev. */
export const SEED_PREFIX = "E2E ";

export const DEFAULT_EDITOR_USERNAME = "e2e-editor";
export const DEFAULT_VIEWER_USERNAME = "e2e-viewer";
export const DEFAULT_PASSWORD = "e2e-senha-dev";

/** Usuário com papel editorial (grupo `editor` — não superuser). */
export function editorUsername(): string {
  return process.env.HINARIA_E2E_EDITOR_USERNAME || DEFAULT_EDITOR_USERNAME;
}

/** Usuário comum. Existe para o guard de `/editor/` ter quem negar. */
export function viewerUsername(): string {
  return process.env.HINARIA_E2E_VIEWER_USERNAME || DEFAULT_VIEWER_USERNAME;
}

export function seedPassword(): string {
  return process.env.HINARIA_E2E_PASSWORD || DEFAULT_PASSWORD;
}

export interface SeedBook {
  slug: string;
  name: string;
  priority: "P1" | "P2" | "P3";
  isPublished: boolean;
  hymnsTotal: number;
  hymnsReviewed: number;
}

export const SEED_BOOKS: readonly SeedBook[] = [
  {
    slug: "e2e-fila-urgente",
    name: `${SEED_PREFIX}Fila Urgente`,
    priority: "P1",
    isPublished: true,
    hymnsTotal: 4,
    hymnsReviewed: 1,
  },
  {
    slug: "e2e-coral-revisado",
    name: `${SEED_PREFIX}Coral Revisado`,
    priority: "P2",
    isPublished: true,
    hymnsTotal: 3,
    hymnsReviewed: 2,
  },
  {
    slug: "e2e-rascunho-interno",
    name: `${SEED_PREFIX}Rascunho Interno`,
    priority: "P2",
    isPublished: false,
    hymnsTotal: 2,
    hymnsReviewed: 0,
  },
  {
    slug: "e2e-selo-final",
    name: `${SEED_PREFIX}Selo Final`,
    priority: "P3",
    isPublished: true,
    hymnsTotal: 2,
    hymnsReviewed: 2,
  },
  {
    slug: "e2e-paridade",
    name: `${SEED_PREFIX}Paridade Visual`,
    priority: "P3",
    isPublished: true,
    hymnsTotal: 24,
    hymnsReviewed: 24,
  },
];

/** Hinário da jornada de revisão: tem pendente, próximo pendente, OCR e histórico. */
export const REVIEW_BOOK_SLUG = "e2e-fila-urgente";

/** Hinário 100% revisado — o caso do "Tudo revisado ✓" na tela de detalhe. */
export const FULLY_REVIEWED_BOOK_SLUG = "e2e-selo-final";

/** Hinário em rascunho — alvo do modal de publicação do 5.D. */
export const DRAFT_BOOK_SLUG = "e2e-rascunho-interno";

/**
 * Hinário-alvo da suíte de paridade visual (`visual-parity.spec.ts`).
 *
 * Existe porque a suíte apontava para o banco de DEV (`o-justiceiro`, 124
 * hinos) e por isso não rodava em CI nem na máquina de mais ninguém. Este é
 * denso de propósito: 24 hinos, 12 linhas de letra cada, estilo e repetições
 * preenchidos, um áudio aprovado e tocável. Comparar telas quase vazias
 * mediria o fundo creme dos dois lados, não o design.
 */
export const PARITY_BOOK_SLUG = "e2e-paridade";

/** Quantos hinos o hinário de paridade tem (enche o índice em duas colunas). */
export const PARITY_HYMN_COUNT = 24;

/**
 * Termo default de `/busca/?q=`. Existe na letra da fixture — senão, num banco
 * de CI recém-semeado, a rota compara "nenhum resultado" com "nenhum
 * resultado", que é o falso verde já documentado em
 * `_plan/marco4-diff-notes.md`.
 */
export const PARITY_SEARCH_QUERY = "luz";

/**
 * Gravação aprovada e DECODIFICÁVEL do hino nº 1 do hinário de paridade.
 *
 * O resto da fixture usa bytes falsos de propósito (a fila de pendentes usa
 * `preload="none"`). Esta é a exceção: o teste-âncora do Sub-marco 4.F afirma
 * que `audio.currentTime` avança ao navegar, e isso exige som que o browser
 * consiga decodificar. O seed grava uma senoide WAV de 3 s.
 */
export const PARITY_AUDIO_TITLE = `${SEED_PREFIX}Gravação de Paridade`;

/** Seguidores do editor — o que torna `/perfil/<u>/seguidores/` medível. */
export const PARITY_FOLLOWERS_EXPECTED = 3;

/** Quantos o editor segue — `/perfil/<u>/seguindo/`. */
export const PARITY_FOLLOWING_EXPECTED = 2;

/** Notificações não lidas do editor — `/notificacoes/`. */
export const PARITY_NOTIFICATIONS_EXPECTED = 3;

/** Título do hino nº 1 do hinário de revisão (o pendente com OCR sujo). */
export const REVIEW_HYMN_TITLE = `${SEED_PREFIX}Primeiro Pendente`;

/** Título do próximo pendente — onde "Marcar revisado e avançar" tem que cair. */
export const NEXT_PENDING_HYMN_TITLE = `${SEED_PREFIX}Em Revisão`;

/**
 * Ordem RELATIVA dos hinários semeados na fila, no default
 * (`priority` asc, depois `name` asc).
 *
 * Relativa de propósito: um banco de dev tem dezenas de outros hinários no
 * meio, e um banco de CI recém-semeado tem só estes. Afirmar posição absoluta
 * daria uma spec que só passa numa das duas situações.
 */
export const SEED_ORDER_DEFAULT: readonly string[] = [
  "e2e-fila-urgente",
  "e2e-coral-revisado",
  "e2e-rascunho-interno",
  "e2e-paridade",
  "e2e-selo-final",
];

/**
 * Ordem RELATIVA com `?sort=review:asc`.
 *
 * Os dois P2 trocam de lugar: `rascunho-interno` (0% revisado) sobe na frente
 * de `coral-revisado` (66%). A troca acontece DENTRO da prioridade porque,
 * com `priority=all`, o backend promove `priority` a sort primário e os
 * chips do usuário ficam secundários (`Query.editorHymnbooks`).
 *
 * Os dois P3 (`e2e-paridade` e `e2e-selo-final`) estão ambos 100% revisados,
 * então empatam em `review_pct` e o desempate por nome mantém a mesma ordem
 * nas duas listas — é por isso que só o par P2 troca.
 */
export const SEED_ORDER_REVIEW_ASC: readonly string[] = [
  "e2e-fila-urgente",
  "e2e-rascunho-interno",
  "e2e-coral-revisado",
  "e2e-paridade",
  "e2e-selo-final",
];

/** Quantos áudios do seed ficam aguardando aprovação. */
export const PENDING_AUDIOS_EXPECTED = 2;

/** Títulos dos áudios pendentes, na fila `/editor/audios/pendentes/`. */
export const PENDING_AUDIO_TITLES: readonly string[] = [
  `${SEED_PREFIX}Gravação do Primeiro Pendente`,
  `${SEED_PREFIX}Gravação Aguardando Aprovação`,
];

/**
 * Filtra uma lista de slugs vista na tela, mantendo só os do seed e na ordem
 * em que apareceram. É o que permite afirmar ordem relativa sem depender do
 * que mais existe no banco.
 */
export function seededOrder(slugsNaTela: string[]): string[] {
  const doSeed = new Set(SEED_BOOKS.map((book) => book.slug));
  return slugsNaTela.filter((slug) => doSeed.has(slug));
}

/** Mensagem de diagnóstico quando a fixture não está no banco. */
export function describeSeedMissing(): string {
  return (
    "Fixture E2E ausente no banco. Rode `./scripts/dev-fullstack.sh seed` " +
    "(ou `DJANGO_SETTINGS_MODULE=config.settings.local uv run python " +
    "manage.py seed_e2e` na raiz do repo Django) antes da suíte."
  );
}
