/**
 * Sub-marco 5.C — Ciclo 5C.17 · jornada da tela 07 (Revisar hino).
 *
 * O 5.C mergeou depois desta frente ter sido desenhada, então a spec dele
 * caiu aqui. A jornada:
 *
 *   1. Abrir a tela de revisão de um hino pendente (pelo botão "Próximo
 *      pendente" do hinário — o mesmo caminho que o editor faz).
 *   2. Ver o diff inline vs OCR e o sparkline de fidelidade.
 *   3. Editar um campo e esperar o autosave de 2s: sem redirect, com
 *      "Salvo às HH:MM" no rodapé.
 *   4. Abrir o drawer de histórico de revisões.
 *   5. "Marcar revisado e avançar" e conferir que caiu no próximo pendente.
 *
 * **Como rodar** (do diretório `web/`):
 *
 * ```bash
 * ./scripts/dev-fullstack.sh                 # semeia o banco e sobe os dois servidores
 * HINARIA_E2E_PLAYWRIGHT_READY=1 \
 *   pnpm exec playwright test --project=chromium tests/e2e/revise-hymn.spec.ts
 * ./scripts/dev-fullstack.sh down
 * ```
 *
 * Esta spec MUTA o banco (marca hino como revisado). Antes de repetir a
 * corrida, re-semeie — `./scripts/dev-fullstack.sh seed` devolve o estado
 * conhecido, e é exatamente por isso que `seed_e2e` é idempotente e
 * sobrescreve o que a suíte deixou.
 *
 * **Os dois `test.fixme` saíram (Frente 1).** Autosave e "marcar revisado" são
 * MUTATIONS disparadas do browser contra o Django noutra porta, e o
 * `CsrfViewMiddleware` recusava com `Origin checking failed - … does not match
 * any trusted origins` porque `config/settings/local.py` não definia
 * `CSRF_TRUSTED_ORIGINS`. O PR #82 definiu, e os dois testes passam como
 * estavam escritos — rodados de verdade antes de sair do fixme, não
 * destravados no escuro. Se você rodar em porta customizada, passe a origem
 * pelo env (`DJANGO_CSRF_TRUSTED_ORIGINS`), senão o 403 volta.
 */

import { expect, test } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

import { describeSessionFailure, editorSession } from "./_helpers/editor-session";
import {
  NEXT_PENDING_HYMN_TITLE,
  REVIEW_BOOK_SLUG,
  REVIEW_HYMN_TITLE,
  describeSeedMissing,
  editorUsername,
} from "./_helpers/seed-fixture";

const SVELTE_BASE = process.env.HINARIA_SVELTE_BASE_URL ?? "http://localhost:5173";

/** 2s de debounce (`AUTOSAVE_DELAY_MS`) + folga pro round-trip. */
const AUTOSAVE_WAIT_MS = 6000;

async function pageComoEditor(browser: Browser): Promise<Page> {
  const session = await editorSession();
  expect(session, describeSessionFailure(editorUsername())).not.toBeNull();
  const context = await browser.newContext({ storageState: session!.state, baseURL: SVELTE_BASE });
  return context.newPage();
}

/**
 * Entra na tela de revisão pelo caminho do editor: hinário → "Próximo
 * pendente". Deliberadamente NÃO navega por URL com pk: os pks são UUIDs
 * gerados a cada seed, e uma spec que os fixasse quebraria na primeira
 * re-semeadura.
 */
async function abrirProximoPendente(page: Page): Promise<void> {
  await page.goto(`/editor/hinarios/${REVIEW_BOOK_SLUG}/`);
  await expect(page.getByTestId("editor-hymnbook-detail"), describeSeedMissing()).toBeVisible();

  // Espera a hidratação antes de clicar. "Próximo pendente" é um `<button>`,
  // não um `<a href>` — de propósito, porque o destino é escolhido pelo
  // backend (`nextPendingHymn`) e não é derivável da URL desta página. O
  // preço é que ele só faz alguma coisa depois que o JS assume: um clique no
  // HTML do SSR é um no-op silencioso, e a spec ficaria intermitente.
  // (As chips de sort do dashboard não precisam disso: lá são links de
  // verdade, e o clique pré-hidratação vira navegação completa.)
  await page.waitForLoadState("networkidle");
  await page.getByTestId("next-pending").click();

  await expect(page).toHaveURL(/\/editor\/hinos\/[0-9a-f-]+\/revisar/);
  await expect(page.getByTestId("revise-hymn")).toBeVisible();
}

test.describe("revisar hino — tela 07 (5C.17)", () => {
  test.skip(
    !process.env.HINARIA_E2E_PLAYWRIGHT_READY,
    "Precisa dos dois servidores no ar e do banco semeado. " +
      "Rode `./scripts/dev-fullstack.sh` e exporte HINARIA_E2E_PLAYWRIGHT_READY=1.",
  );

  test("o hinário leva ao próximo pendente, e é o hino certo", async ({ browser }) => {
    const page = await pageComoEditor(browser);
    await abrirProximoPendente(page);

    await expect(page.getByTestId("revise-title")).toHaveText("Revisar hino");
    await expect(page.locator("input.input-title")).toHaveValue(REVIEW_HYMN_TITLE);

    // O indicador de fila é o que diz ao editor onde ele está: "01 de 4 · N
    // restantes". Sem ele, "avançar" seria um salto às cegas.
    await expect(page.getByTestId("queue-indicator")).toHaveText(/^01 de 4 · \d+ restantes?$/);
  });

  test("mostra o diff inline vs OCR com as contagens do texto semeado", async ({ browser }) => {
    const page = await pageComoEditor(browser);
    await abrirProximoPendente(page);

    await expect(page.getByTestId("inline-diff")).toBeVisible();

    // O OCR da fixture erra 3 palavras ("la", "Iuz", "forca") e inventa uma
    // linha. Números exatos de propósito: é a fixture que os garante, e um
    // `> 0` deixaria passar um diff que degradou pra "tudo é uma linha só".
    await expect(page.getByTestId("diff-count-changes")).toHaveText(/3 substituições/);
    await expect(page.getByTestId("diff-count-dels")).toHaveText(/1 remoção/);
    await expect(page.getByTestId("diff-token").first()).toBeVisible();
  });

  test("mostra o sparkline de fidelidade do OCR", async ({ browser }) => {
    const page = await pageComoEditor(browser);
    await abrirProximoPendente(page);

    await expect(page.getByTestId("ocr-confidence")).toBeVisible();
    await expect(page.getByTestId("ocr-average")).toHaveText(/Fidelidade média do OCR · \d+%/);

    // Uma barra por linha do OCR (5 no texto semeado).
    expect(await page.getByTestId("ocr-bar").count()).toBe(5);
  });

  test("o drawer de histórico de revisões abre com o que o seed gravou", async ({ browser }) => {
    const page = await pageComoEditor(browser);
    await abrirProximoPendente(page);

    const abrir = page.getByTestId("open-revision-history");
    await expect(abrir).toHaveText(/Histórico · [1-9]\d* revis/);
    await abrir.click();

    const drawer = page.getByTestId("revision-history-drawer");
    await expect(drawer).toBeVisible();
    await expect(page.getByTestId("revision-history-empty")).toHaveCount(0);

    // O hino nasce com a revisão automática "Criado via OCR" e recebe do seed
    // uma segunda com `field_diff` de verdade — é essa que tem campo listado.
    expect(await page.getByTestId("revision-item").count()).toBeGreaterThanOrEqual(2);
    await expect(page.getByTestId("revision-field").first()).toBeVisible();
  });

  test("o drawer de revisão de áudio abre na gravação semeada", async ({ browser }) => {
    const page = await pageComoEditor(browser);
    await abrirProximoPendente(page);

    // `audio-review-absent` no lugar do botão significaria hino sem áudio —
    // a fixture garante que tem.
    await expect(page.getByTestId("audio-review-absent")).toHaveCount(0);
    await page.getByTestId("open-audio-review").click();
    await expect(page.getByTestId("audio-review-drawer")).toBeVisible();
  });

  test("a prévia acompanha o que se digita no campo de letra", async ({ browser }) => {
    const page = await pageComoEditor(browser);
    await abrirProximoPendente(page);

    // Prévia é derivação local do formulário, não mutation — funciona
    // independentemente do CSRF.
    await page.locator("input.input-title").fill("Título de prova da suíte");
    await expect(page.getByTestId("preview-title")).toContainText("Título de prova da suíte");
  });

  test("editar um campo agenda o autosave e NÃO redireciona", async ({ browser }) => {
    // A metade da jornada que não depende do CSRF, e que é o ponto do ciclo
    // 5C.8: digitar marca "não salvo", o debounce de 2s dispara sozinho e a
    // página não sai do lugar. O resultado da mutation é o outro teste
    // (abaixo, em fixme) — aqui interessa a mecânica.
    const page = await pageComoEditor(browser);
    await abrirProximoPendente(page);

    const urlAntes = page.url();
    const status = page.getByTestId("autosave-status");
    await expect(status).toHaveAttribute("data-state", "idle");

    await page.locator("input.input-title").fill("Revisado pela suíte E2E");
    await expect(status).toHaveAttribute("data-state", "pending");
    await expect(status).toHaveText("Alterações não salvas…");

    // Passados os 2s, o autosave saiu de "pending" por conta própria — sem
    // clique em botão nenhum.
    await expect(status).not.toHaveAttribute("data-state", "pending", {
      timeout: AUTOSAVE_WAIT_MS,
    });
    expect(page.url()).toBe(urlAntes);
  });

  test("autosave de 2s grava e mostra 'Salvo às HH:MM'", async ({ browser }) => {
    const page = await pageComoEditor(browser);
    await abrirProximoPendente(page);

    // O rodapé em "idle" é o sinal de que os efeitos da tela já rodaram.
    const status = page.getByTestId("autosave-status");
    await expect(status).toHaveAttribute("data-state", "idle");

    // Valor ÚNICO por corrida, de propósito: o autosave compara com o último
    // snapshot persistido e não agenda nada quando o campo não mudou. O teste
    // anterior desta mesma spec já gravou "Revisado pela suíte E2E" neste
    // hino; repetir a string deixaria o rodapé em "idle" e o teste morreria
    // esperando um "saved" que nunca viria — por um motivo que não é bug.
    const marca = `E2E Autosave ${Date.now()}`;
    await page.locator("input.input-title").fill(marca);
    await expect(status).toHaveAttribute("data-state", "pending");

    await expect(status).toHaveAttribute("data-state", "saved", { timeout: AUTOSAVE_WAIT_MS });
    await expect(status).toHaveText(/^Salvo às \d{2}:\d{2}$/);
  });

  test("'Marcar revisado e avançar' cai no próximo pendente", async ({ browser }) => {
    const page = await pageComoEditor(browser);
    await abrirProximoPendente(page);

    // Mesma espera de hidratação do teste acima: o botão é `<button>` e um
    // clique antes dos efeitos é um no-op silencioso.
    await expect(page.getByTestId("autosave-status")).toHaveAttribute("data-state", "idle");

    const urlAntes = page.url();
    await page.getByTestId("save-and-advance").click();

    // A espera vem PRIMEIRO no título, não na URL: o padrão
    // `/editor/hinos/<uuid>/revisar` já casa com a página de onde saímos,
    // então `toHaveURL` passaria na hora e `page.url()` seria lido antes de a
    // navegação terminar. O título do próximo pendente é o que só existe
    // depois de chegar lá.
    await expect(page.locator("input.input-title")).toHaveValue(NEXT_PENDING_HYMN_TITLE);
    await expect(page).toHaveURL(/\/editor\/hinos\/[0-9a-f-]+\/revisar/);
    expect(page.url()).not.toBe(urlAntes);
  });
});
