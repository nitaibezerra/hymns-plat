/**
 * Sub-marco 5.D — Ciclo 5D.17 · jornada de CRUD do workspace editorial.
 *
 * A jornada pedida é: criar hinário → adicionar hino → subir áudio → aprovar
 * na fila de pendentes → publicar o hinário pelo modal de checklist. Ela está
 * escrita **até onde a UI permite hoje**, e o resto está em `test.fixme` com o
 * motivo exato de cada corte. Nada aqui é fiação nova: os pontos de embutir
 * pertencem a outras frentes.
 *
 * **Como rodar** (do diretório `web/`):
 *
 * ```bash
 * ./scripts/dev-fullstack.sh                 # semeia o banco e sobe os dois servidores
 * HINARIA_E2E_PLAYWRIGHT_READY=1 \
 *   pnpm exec playwright test --project=chromium tests/e2e/editor-crud.spec.ts
 * ./scripts/dev-fullstack.sh down
 * ```
 *
 * Se um dia esta spec passar a criar hinários de verdade, o nome deles TEM
 * que começar com `E2E ` — é o prefixo que `seed_e2e --reset` limpa, e sem
 * isso o banco de dev acumula lixo a cada corrida.
 *
 * ---
 *
 * ## O que está em fixme, e por quê
 *
 * **(a) Mutations do browser tomam 403 de CSRF em dev.** `createHymnBook`,
 * `createHymn` e `approveAudio` saem do browser em `:5173` para o Django em
 * `:9000`; o `CsrfViewMiddleware` recusa com `Origin checking failed -
 * http://localhost:5173 does not match any trusted origins`, porque
 * `config/settings/local.py` não define `CSRF_TRUSTED_ORIGINS` (só
 * `production.py` define). Medido nesta base, com curl e no browser. É
 * configuração, não UI, e o conserto é uma linha em `config/` — fora do
 * escopo desta frente.
 *
 * **(b) Dois componentes do 5.D existem mas não estão embutidos em tela
 * nenhuma.** `AudioUploadDrawer.svelte` e `PublishHymnBookModal.svelte` são
 * standalone e testados em unidade; nenhuma rota sob `src/routes/editor/` os
 * importa (conferido por grep nesta base). Sem ponto de entrada na UI, não há
 * jornada a percorrer — só haveria um teste que monta o componente à mão, e
 * isso é teste de unidade, que já existe.
 *
 * **(c) Nenhuma rota de CRUD tem link de entrada.** `/editor/hinarios/novo/`,
 * `/editor/hinarios/<slug>/hinos/novo/`, `/editor/hinos/<pk>/editar/` e
 * `/editor/audios/pendentes/` só são alcançáveis digitando a URL — o
 * dashboard e o detalhe de hinário não apontam pra elas. As specs abaixo
 * navegam por URL direta, o que é legítimo em E2E, mas a jornada "um editor
 * consegue chegar lá clicando" não existe pra ser testada.
 */

import { expect, test } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

import { describeSessionFailure, editorSession } from "./_helpers/editor-session";
import {
  DRAFT_BOOK_SLUG,
  PENDING_AUDIOS_EXPECTED,
  PENDING_AUDIO_TITLES,
  REVIEW_BOOK_SLUG,
  SEED_BOOKS,
  SEED_PREFIX,
  describeSeedMissing,
  editorUsername,
} from "./_helpers/seed-fixture";

const SVELTE_BASE = process.env.HINARIA_SVELTE_BASE_URL ?? "http://localhost:5173";

const RASCUNHO = SEED_BOOKS.find((book) => book.slug === DRAFT_BOOK_SLUG)!;

async function pageComoEditor(browser: Browser): Promise<Page> {
  const session = await editorSession();
  expect(session, describeSessionFailure(editorUsername())).not.toBeNull();
  const context = await browser.newContext({ storageState: session!.state, baseURL: SVELTE_BASE });
  return context.newPage();
}

test.describe("CRUD editorial — formulários (5D.17)", () => {
  test.skip(
    !process.env.HINARIA_E2E_PLAYWRIGHT_READY,
    "Precisa dos dois servidores no ar e do banco semeado. " +
      "Rode `./scripts/dev-fullstack.sh` e exporte HINARIA_E2E_PLAYWRIGHT_READY=1.",
  );

  test("o form de novo hinário abre com os campos do HymnBookForm", async ({ browser }) => {
    const page = await pageComoEditor(browser);

    await page.goto("/editor/hinarios/novo/");
    await expect(page.getByTestId("hymnbook-novo")).toBeVisible();
    await expect(page.getByTestId("editor-forbidden")).toHaveCount(0);

    for (const campo of ["name", "intro-name", "owner-name", "description", "cover-image"]) {
      await expect(page.getByTestId(`field-${campo}`)).toBeVisible();
    }
    await expect(page.getByTestId("submit")).toHaveText("Criar");
    await expect(page.getByTestId("cancel")).toHaveAttribute("href", "/editor/");
  });

  test("o form de novo hino abre dentro do hinário certo", async ({ browser }) => {
    const page = await pageComoEditor(browser);

    await page.goto(`/editor/hinarios/${REVIEW_BOOK_SLUG}/hinos/novo/`);
    await expect(page.getByTestId("hymn-novo"), describeSeedMissing()).toBeVisible();
    // `hymnbook-not-found` no lugar seria slug errado — vale distinguir, senão
    // um seed ausente vira "campo não encontrado" e ninguém entende.
    await expect(page.getByTestId("hymnbook-not-found")).toHaveCount(0);

    for (const campo of ["number", "title", "text", "style", "repetitions", "section"]) {
      await expect(page.getByTestId(`field-${campo}`)).toBeVisible();
    }
    await expect(page.getByTestId("hymn-form")).toBeVisible();
  });

  test("o form de edição de hino vem pré-populado com o hino do seed", async ({ browser }) => {
    const page = await pageComoEditor(browser);

    // Chega pelo hinário: os pks são UUIDs regerados a cada seed, então não há
    // URL fixa pra fixar.
    await page.goto(`/editor/hinarios/${REVIEW_BOOK_SLUG}/`);
    await expect(page.getByTestId("editor-hymnbook-detail"), describeSeedMissing()).toBeVisible();
    const href = await page
      .locator("[data-testid^='hymn-revise-']")
      .first()
      .getAttribute("href");
    const pk = href!.match(/\/editor\/hinos\/([0-9a-f-]+)\//)![1];

    await page.goto(`/editor/hinos/${pk}/editar/`);
    await expect(page.getByTestId("hymn-editar")).toBeVisible();
    await expect(page.getByTestId("hymn-not-found")).toHaveCount(0);
    await expect(page.getByTestId("field-title")).toHaveValue(new RegExp(`^${SEED_PREFIX}`));
    await expect(page.getByTestId("field-number")).toHaveValue("1");
  });

  test("o form de edição de hinário vem pré-populado com o rascunho", async ({ browser }) => {
    const page = await pageComoEditor(browser);

    await page.goto(`/editor/hinarios/${DRAFT_BOOK_SLUG}/editar/`);
    await expect(page.getByTestId("hymnbook-form"), describeSeedMissing()).toBeVisible();
    await expect(page.getByTestId("field-name")).toHaveValue(RASCUNHO.name);
  });

  test("o rascunho aparece marcado como rascunho no detalhe", async ({ browser }) => {
    // É este o hinário que o modal de publicação miraria. Enquanto o modal não
    // está embutido, o que dá pra afirmar é que o estado "não publicado"
    // chega à tela.
    const page = await pageComoEditor(browser);

    await page.goto(`/editor/hinarios/${DRAFT_BOOK_SLUG}/`);
    await expect(page.getByTestId("detail-draft-badge"), describeSeedMissing()).toBeVisible();
  });
});

test.describe("CRUD editorial — fila de áudios pendentes (5D.17)", () => {
  test.skip(
    !process.env.HINARIA_E2E_PLAYWRIGHT_READY,
    "Precisa dos dois servidores no ar e do banco semeado. " +
      "Rode `./scripts/dev-fullstack.sh` e exporte HINARIA_E2E_PLAYWRIGHT_READY=1.",
  );

  test("a fila lista as gravações semeadas com player e ações", async ({ browser }) => {
    const page = await pageComoEditor(browser);

    await page.goto("/editor/audios/pendentes/");
    await expect(page.getByTestId("pending-audios")).toBeVisible();
    await expect(page.getByTestId("pending-empty")).toHaveCount(0);
    await expect(page.getByTestId("pending-error")).toHaveCount(0);

    const total = await page.getByTestId("pending-audio-item").count();
    expect(total, describeSeedMissing()).toBeGreaterThanOrEqual(PENDING_AUDIOS_EXPECTED);

    // O contador do cabeçalho tem que concordar com a lista que ele resume.
    await expect(page.getByTestId("pending-count")).toHaveText(
      new RegExp(`^${total} pendente`),
    );

    // Os títulos da fixture, presentes por nome.
    for (const titulo of PENDING_AUDIO_TITLES) {
      await expect(page.getByText(`"${titulo}"`, { exact: false })).toBeVisible();
    }

    // Player por item — a tela existe pra ouvir antes de aprovar.
    expect(await page.getByTestId("pending-audio-player").count()).toBe(total);
  });

  test("rejeitar pede confirmação antes de qualquer chamada ao servidor", async ({ browser }) => {
    const page = await pageComoEditor(browser);

    await page.goto("/editor/audios/pendentes/");
    await expect(page.getByTestId("pending-audios")).toBeVisible();
    await page.waitForLoadState("networkidle");

    const primeiro = page.getByTestId("pending-audio-item").first();
    const rejeitar = primeiro.locator("[data-testid^='reject-']").first();
    await rejeitar.click();

    // Duas etapas de propósito: a rejeição apaga a gravação e é irreversível.
    const confirmacao = primeiro.locator("[data-testid^='reject-confirm-']").first();
    await expect(confirmacao).toBeVisible();
    await expect(confirmacao).toContainText("irreversível");

    await primeiro.locator("[data-testid^='reject-confirm-no-']").click();
    await expect(confirmacao).toHaveCount(0);

    // Cancelar não pode ter mexido na fila.
    await expect(page.getByTestId("queue-error")).toHaveCount(0);
    expect(await page.getByTestId("pending-audio-item").count()).toBeGreaterThanOrEqual(
      PENDING_AUDIOS_EXPECTED,
    );
  });
});

test.describe("CRUD editorial — jornada completa (5D.17, pendente de fiação)", () => {
  test.skip(
    !process.env.HINARIA_E2E_PLAYWRIGHT_READY,
    "Precisa dos dois servidores no ar e do banco semeado. " +
      "Rode `./scripts/dev-fullstack.sh` e exporte HINARIA_E2E_PLAYWRIGHT_READY=1.",
  );

  test.fixme("criar hinário pelo form leva ao detalhe do hinário criado", async ({ browser }) => {
    // BLOQUEIO (a): `createHymnBook` é mutation do browser → 403 de CSRF por
    // Origin em dev. Ver o cabeçalho do arquivo.
    const page = await pageComoEditor(browser);

    await page.goto("/editor/hinarios/novo/");
    await page.getByTestId("field-name").fill(`${SEED_PREFIX}Hinário da Jornada`);
    await page.getByTestId("field-owner-name").fill("Suíte E2E");
    await page.getByTestId("submit").click();

    await expect(page).toHaveURL(/\/editor\/hinarios\/e2e-hinario-da-jornada/);
    await expect(page.getByTestId("editor-hymnbook-detail")).toBeVisible();
  });

  test.fixme("adicionar hino ao hinário recém-criado", async ({ browser }) => {
    // BLOQUEIO (a): `createHymn` é mutation do browser → 403 de CSRF.
    // Depende, além disso, do hinário criado no passo anterior.
    const page = await pageComoEditor(browser);

    await page.goto(`/editor/hinarios/${REVIEW_BOOK_SLUG}/hinos/novo/`);
    await page.getByTestId("field-number").fill("99");
    await page.getByTestId("field-title").fill(`${SEED_PREFIX}Hino da Jornada`);
    await page.getByTestId("field-text").fill("Letra de teste\nSegunda linha");
    await page.getByTestId("submit").click();

    await expect(page).toHaveURL(new RegExp(`/editor/hinarios/${REVIEW_BOOK_SLUG}`));
    await expect(page.getByText(`${SEED_PREFIX}Hino da Jornada`)).toBeVisible();
  });

  test.fixme("subir áudio pelo drawer de upload", async () => {
    // BLOQUEIO (b): `AudioUploadDrawer.svelte` está pronto e testado em
    // unidade, mas nenhuma rota o importa — não existe botão "enviar
    // gravação" em tela nenhuma. Falta a fiação em
    // `src/routes/editor/hinos/[pk]/` (ou no detalhe do hinário), que
    // pertence a outra frente. Sem ponto de entrada, não há jornada.
  });

  test.fixme("aprovar a gravação na fila de pendentes tira ela da lista", async ({ browser }) => {
    // BLOQUEIO (a): `approveAudio` é mutation do browser → 403 de CSRF.
    // A tela em si está fiada (o botão existe e chama a mutation); o que
    // falha é a chamada.
    const page = await pageComoEditor(browser);

    await page.goto("/editor/audios/pendentes/");
    const antes = await page.getByTestId("pending-audio-item").count();
    await page.locator("[data-testid^='approve-']").first().click();

    await expect(page.getByTestId("queue-error")).toHaveCount(0);
    await expect(page.getByTestId("pending-audio-item")).toHaveCount(antes - 1);
    await expect(page.getByTestId("pending-count")).toHaveText(new RegExp(`^${antes - 1} `));
  });

  test.fixme("publicar o hinário pelo modal de checklist", async () => {
    // BLOQUEIO (b): `PublishHymnBookModal.svelte` está pronto e testado em
    // unidade (inclusive o `publishReadiness`), mas nenhuma rota o importa —
    // não existe botão "Publicar" no detalhe do hinário. Falta a fiação em
    // `src/routes/editor/hinarios/[slug]/+page.svelte`, que pertence a outra
    // frente.
    //
    // Quando ela existir, o alvo natural é o rascunho da fixture
    // (`e2e-rascunho-interno`), que já nasce não publicado justamente pra
    // isso — e `seed_e2e` o devolve a rascunho na corrida seguinte.
  });
});
