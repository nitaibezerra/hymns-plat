/**
 * Marco 5.B — Ciclo 5B.10 · jornadas do dashboard editorial.
 *
 * As três jornadas que ficaram pendentes quando `web/tests/` pertencia a outra
 * frente, mais o guard:
 *
 *   1. Editor logado abre `/editor/` e vê os 4 cards de stats.
 *   2. Chip "Revisão" muda a URL pra `?sort=review:asc` e REORDENA a fila.
 *   3. O badge de áudios pendentes traz a contagem certa.
 *   4. Guard: usuário comum e anônimo caem em `/login?next=/editor`.
 *
 * **Como rodar** (do diretório `web/`):
 *
 * ```bash
 * ./scripts/dev-fullstack.sh                 # semeia o banco e sobe os dois servidores
 * HINARIA_E2E_PLAYWRIGHT_READY=1 \
 *   pnpm exec playwright test --project=chromium tests/e2e/editor-dashboard.spec.ts
 * ./scripts/dev-fullstack.sh down
 * ```
 *
 * Portas diferentes do default? Passe `HINARIA_SVELTE_BASE_URL` e
 * `HINARIA_DJANGO_BASE_URL` (as mesmas que o script imprime no fim).
 * Credenciais: `HINARIA_E2E_EDITOR_USERNAME` / `HINARIA_E2E_VIEWER_USERNAME` /
 * `HINARIA_E2E_PASSWORD` — todas com o default do `seed_e2e`, então quem subiu
 * pelo script não precisa exportar nada.
 *
 * Sem `HINARIA_E2E_PLAYWRIGHT_READY=1` a suíte fica em skip, pra quem roda
 * `pnpm test:e2e` sem servidores não ver vermelho falso (mesma convenção de
 * `player-persists.spec.ts` e `visual-parity.spec.ts`).
 *
 * **Sobre a ordem afirmada.** As asserções de ordem são RELATIVAS aos
 * hinários do seed (`seededOrder`). Um banco de dev tem dezenas de outros
 * hinários intercalados e um banco de CI recém-semeado não tem nenhum;
 * afirmar posição absoluta daria uma spec que só passa numa das duas
 * situações.
 */

import { expect, test } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

import { describeSessionFailure, editorSession, viewerSession } from "./_helpers/editor-session";
import {
  PENDING_AUDIOS_EXPECTED,
  SEED_BOOKS,
  SEED_ORDER_DEFAULT,
  SEED_ORDER_REVIEW_ASC,
  describeSeedMissing,
  editorUsername,
  seededOrder,
  viewerUsername,
} from "./_helpers/seed-fixture";

const SVELTE_BASE = process.env.HINARIA_SVELTE_BASE_URL ?? "http://localhost:5173";

/** Slugs dos cards da fila, na ordem em que estão no DOM. */
async function queueSlugs(page: Page): Promise<string[]> {
  const ids = await page.locator("[data-testid^='queue-card-']").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-testid") ?? ""),
  );
  return ids.map((id) => id.replace("queue-card-", ""));
}

/** Contexto de browser já autenticado como o usuário pedido. */
async function pageComoUsuario(browser: Browser, quem: "editor" | "viewer"): Promise<Page> {
  const session = quem === "editor" ? await editorSession() : await viewerSession();
  const username = quem === "editor" ? editorUsername() : viewerUsername();
  expect(session, describeSessionFailure(username)).not.toBeNull();
  const context = await browser.newContext({
    storageState: session!.state,
    baseURL: SVELTE_BASE,
  });
  return context.newPage();
}

test.describe("dashboard editorial (5B.10)", () => {
  test.skip(
    !process.env.HINARIA_E2E_PLAYWRIGHT_READY,
    "Precisa dos dois servidores no ar e do banco semeado. " +
      "Rode `./scripts/dev-fullstack.sh` e exporte HINARIA_E2E_PLAYWRIGHT_READY=1.",
  );

  test("editor logado vê o dashboard com os 4 cards de stats", async ({ browser }) => {
    const page = await pageComoUsuario(browser, "editor");

    await page.goto("/editor/");
    await expect(page.getByTestId("editor-dashboard")).toBeVisible();

    // A faixa do shell confirma QUEM entrou — sem isso, um dashboard
    // renderizado por outra sessão passaria despercebido.
    await expect(page.getByTestId("editor-identity")).toHaveText(`@${editorUsername()}`);

    // Os 4 cards, na ordem do template Django.
    for (const chave of ["p1", "hinarios", "pendentes", "revisados"]) {
      await expect(page.getByTestId(`stat-card-${chave}`)).toBeVisible();
      await expect(page.getByTestId(`stat-value-${chave}`)).toHaveText(/^\d+$/);
    }

    // O hinário P1 do seed tem que estar contado na stat de urgência.
    const p1 = Number(await page.getByTestId("stat-value-p1").innerText());
    expect(p1).toBeGreaterThanOrEqual(
      SEED_BOOKS.filter((book) => book.priority === "P1").length,
    );

    // E os 4 cards da fixture, presentes na fila.
    const slugs = await queueSlugs(page);
    expect(seededOrder(slugs), describeSeedMissing()).toHaveLength(SEED_BOOKS.length);
  });

  test("chip de revisão vai pra ?sort=review:asc e reordena a fila", async ({ browser }) => {
    const page = await pageComoUsuario(browser, "editor");

    await page.goto("/editor/");
    const antes = seededOrder(await queueSlugs(page));
    expect(antes, describeSeedMissing()).toEqual([...SEED_ORDER_DEFAULT]);

    const chip = page.getByTestId("sort-chip-review");
    await expect(chip).toHaveAttribute("data-sort-state", "off");
    await chip.click();

    // A ordenação é ESTADO DE URL — precisa ser compartilhável e sobreviver a
    // um refresh, então a asserção começa pela URL.
    await expect(page).toHaveURL(/[?&]sort=review%3Aasc|[?&]sort=review:asc/);
    await expect(chip).toHaveAttribute("data-sort-state", "asc");

    const depois = seededOrder(await queueSlugs(page));
    expect(depois).toEqual([...SEED_ORDER_REVIEW_ASC]);
    expect(depois).not.toEqual(antes);
  });

  test("a ordenação sobrevive a um refresh (é estado de URL, não de memória)", async ({
    browser,
  }) => {
    const page = await pageComoUsuario(browser, "editor");

    await page.goto("/editor/?sort=review:asc");
    await expect(page.getByTestId("sort-chip-review")).toHaveAttribute("data-sort-state", "asc");
    expect(seededOrder(await queueSlugs(page))).toEqual([...SEED_ORDER_REVIEW_ASC]);
  });

  test("badge de áudios pendentes traz a contagem certa", async ({ browser }) => {
    const page = await pageComoUsuario(browser, "editor");

    await page.goto("/editor/");
    const badge = page.getByTestId("pending-audios-badge");
    await expect(badge).toBeVisible();

    const noBadge = Number((await badge.innerText()).match(/\d+/)?.[0] ?? "0");
    expect(noBadge).toBeGreaterThanOrEqual(PENDING_AUDIOS_EXPECTED);

    // "Contagem certa" é a que bate com a fila de verdade. Comparar o badge
    // com uma constante só provaria que o seed é o que é; comparar com a tela
    // de pendentes prova que as duas leem a MESMA regra de escopo
    // (`_pending_audios_for`).
    await page.goto("/editor/audios/pendentes/");
    await expect(page.getByTestId("pending-audios")).toBeVisible();
    const naFila = await page.getByTestId("pending-audio-item").count();
    expect(naFila).toBe(noBadge);
  });
});

test.describe("guard do workspace (5B.1)", () => {
  test.skip(
    !process.env.HINARIA_E2E_PLAYWRIGHT_READY,
    "Precisa dos dois servidores no ar e do banco semeado. " +
      "Rode `./scripts/dev-fullstack.sh` e exporte HINARIA_E2E_PLAYWRIGHT_READY=1.",
  );

  test("anônimo é mandado pro login com o destino preservado", async ({ page }) => {
    await page.goto(`${SVELTE_BASE}/editor/`);
    // O `next` sai sem a barra final: o SvelteKit normaliza o path antes do
    // layout load rodar, então `/editor/` já chegou lá como `/editor`.
    await expect(page).toHaveURL(/\/login\?next=%2Feditor|\/login\?next=\/editor/);
    await expect(page.getByTestId("login-page")).toBeVisible();
  });

  test("usuário logado sem papel editorial também é barrado", async ({ browser }) => {
    // O ponto do 5.A½: o guard decide por `UserType.isEditor`, não por
    // "tem sessão". Este é o teste que separa as duas leituras.
    const session = await viewerSession();
    expect(session, describeSessionFailure(viewerUsername())).not.toBeNull();
    expect(session!.isEditor, "o usuário comum da fixture não pode ser editor").toBe(false);

    const context = await browser.newContext({ storageState: session!.state, baseURL: SVELTE_BASE });
    const page = await context.newPage();

    await page.goto("/editor/");
    await expect(page).toHaveURL(/\/login\?next=%2Feditor|\/login\?next=\/editor/);
    await expect(page.getByTestId("editor-dashboard")).toHaveCount(0);
  });

  test("o guard cobre as rotas de baixo, não só a raiz de /editor/", async ({ browser }) => {
    const session = await viewerSession();
    expect(session, describeSessionFailure(viewerUsername())).not.toBeNull();
    const context = await browser.newContext({ storageState: session!.state, baseURL: SVELTE_BASE });
    const page = await context.newPage();

    await page.goto("/editor/audios/pendentes/");
    await expect(page).toHaveURL(/\/login\?next=/);
  });
});
