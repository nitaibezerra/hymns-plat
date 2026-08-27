/**
 * Sub-marco 5.D — Ciclo 5D.17 · jornada de CRUD do workspace editorial.
 * Frente 1 (fiação) — os 5 `test.fixme` viraram jornada de verdade.
 *
 * A jornada é: criar hinário → adicionar hino → subir áudio → aprovar na fila
 * de pendentes → publicar pelo modal de checklist. Quando esta spec foi
 * escrita, nada disso rodava: as mutations do browser tomavam 403 de CSRF
 * (`config/settings/local.py` não definia `CSRF_TRUSTED_ORIGINS`), e nem
 * `AudioUploadDrawer` nem `PublishHymnBookModal` estavam embutidos em rota
 * nenhuma — nem havia link de entrada pras rotas de CRUD. Os três bloqueios
 * caíram: o CSRF no PR #82, os modais e os links nesta frente. Cada fixme foi
 * rodado antes de sair; nenhum foi removido no escuro.
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
 * **Esta spec MUTA o banco** — cria hinário, cria hino, sobe áudio, aprova
 * gravação e publica. Antes de repetir a corrida, re-semeie com `--reset`:
 *
 * ```bash
 * SEED_E2E_ARGS=--reset ./scripts/dev-fullstack.sh seed
 * ```
 *
 * Tudo que a jornada cria começa com `E2E ` (`SEED_PREFIX`), que é exatamente
 * o filtro do `_reset` do comando — sem esse prefixo o banco de dev acumula
 * lixo a cada corrida.
 *
 * **Por que a jornada mira o hinário que ela mesma cria** e não um do seed:
 * `publish_readiness` exige dono identificado e trilha de auditoria, e
 * `seed_e2e` não define `owner_user` em hinário nenhum — os quatro semeados
 * têm `canPublish: false` (medido). O hinário criado pelo form nasce com
 * `owner_user` (`apps/api/mutations.py`), então marcar o único hino como
 * revisado fecha os quatro checks. Encostar no `e2e-fila-urgente` também
 * quebraria `revise-hymn.spec.ts`, que afirma "01 de 4" no indicador de fila.
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

/**
 * Espera o JS assumir antes de clicar num `<button>`.
 *
 * Um clique em botão no HTML do SSR é no-op SILENCIOSO: nada acontece, nada
 * falha, e a asserção seguinte morre por timeout num estado que parece bug de
 * produto. Medido nesta suíte — "aprovar a gravação" reprovou assim, com a
 * fila intacta e `queue-error` vazio. Links (`<a href>`) não precisam disto:
 * o clique pré-hidratação vira navegação completa.
 */
async function esperarHidratacao(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
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

/**
 * Nomes da jornada. Todos sob `SEED_PREFIX` pra `seed_e2e --reset` limpar.
 *
 * O slug é derivado do nome pelo `slugify` do Django. Afirmamos com regex
 * parcial: se uma corrida anterior não foi limpa, o Django desambigua o slug
 * com sufixo e a asserção continua verdadeira sem virar falso vermelho.
 */
const JORNADA_BOOK_NAME = `${SEED_PREFIX}Hinário da Jornada`;
const JORNADA_BOOK_SLUG = "e2e-hinario-da-jornada";
const JORNADA_HYMN_TITLE = `${SEED_PREFIX}Hino da Jornada`;
const JORNADA_AUDIO_TITLE = `${SEED_PREFIX}Gravação da Jornada`;

/**
 * MP3 de mentira — os mesmos bytes que `seed_e2e._AUDIO_BYTES` usa: cabeçalho
 * ID3 e zeros. `HymnAudioUploadForm` não inspeciona o conteúdo, e a fila de
 * pendentes usa `preload="none"`, então o browser nunca busca o arquivo.
 * Embutir um MP3 real só engordaria o repo.
 */
const FAKE_MP3 = Buffer.concat([
  Buffer.from("ID3\x03\x00\x00\x00\x00\x00\x00", "binary"),
  Buffer.alloc(512),
]);

test.describe("CRUD editorial — jornada completa (5D.17)", () => {
  test.skip(
    !process.env.HINARIA_E2E_PLAYWRIGHT_READY,
    "Precisa dos dois servidores no ar e do banco semeado. " +
      "Rode `./scripts/dev-fullstack.sh` e exporte HINARIA_E2E_PLAYWRIGHT_READY=1.",
  );

  test("criar hinário pelo form leva ao detalhe do hinário criado", async ({ browser }) => {
    const page = await pageComoEditor(browser);

    // Pelo dashboard, clicando — é a fiação do ciclo 1.1 que está sendo
    // exercitada aqui, não só o form.
    await page.goto("/editor/");
    await expect(page.getByTestId("editor-dashboard")).toBeVisible();
    await page.getByTestId("new-hymnbook-link").click();

    await expect(page.getByTestId("hymnbook-novo")).toBeVisible();
    await esperarHidratacao(page);
    await page.getByTestId("field-name").fill(JORNADA_BOOK_NAME);
    await page.getByTestId("field-owner-name").fill("Suíte E2E");
    // A descrição não é enfeite: `publish_readiness` a exige no check
    // "Capa e descrição preenchidas", e o passo final da jornada publica.
    await page.getByTestId("field-description").fill("Hinário criado pela suíte E2E.");
    await page.getByTestId("submit").click();

    await expect(page).toHaveURL(new RegExp(`/editor/hinarios/${JORNADA_BOOK_SLUG}`));
    await expect(page.getByTestId("editor-hymnbook-detail")).toBeVisible();
    await expect(page.getByTestId("detail-draft-badge")).toBeVisible();
  });

  test("adicionar hino ao hinário recém-criado", async ({ browser }) => {
    const page = await pageComoEditor(browser);

    await page.goto(`/editor/hinarios/${JORNADA_BOOK_SLUG}/`);
    await expect(page.getByTestId("editor-hymnbook-detail")).toBeVisible();
    // Ciclo 1.2: o caminho clicável até o form de novo hino.
    await page.getByTestId("new-hymn-link").click();

    await expect(page.getByTestId("hymn-novo")).toBeVisible();
    await esperarHidratacao(page);
    await page.getByTestId("field-number").fill("1");
    await page.getByTestId("field-title").fill(JORNADA_HYMN_TITLE);
    await page.getByTestId("field-text").fill("Letra de teste\nSegunda linha");
    await page.getByTestId("submit").click();

    // Destino em paridade com `hymn_create_view`, que redireciona pro detalhe
    // do HINO (não do hinário).
    await expect(page).toHaveURL(/\/hinos\/[0-9a-f-]+/);

    // E o hino aparece na lista do hinário.
    await page.goto(`/editor/hinarios/${JORNADA_BOOK_SLUG}/`);
    await expect(page.getByText(JORNADA_HYMN_TITLE).first()).toBeVisible();
  });

  test("subir áudio pelo drawer de upload", async ({ browser }) => {
    const page = await pageComoEditor(browser);

    // O drawer vive na tela de revisão do hino (fiação do ciclo 1.3).
    await page.goto(`/editor/hinarios/${JORNADA_BOOK_SLUG}/`);
    const href = await page.locator("[data-testid^='hymn-revise-']").first().getAttribute("href");
    await page.goto(href!);
    await expect(page.getByTestId("revise-hymn")).toBeVisible();
    await esperarHidratacao(page);

    await page.getByTestId("open-audio-upload").click();
    await expect(page.getByTestId("audio-upload-drawer")).toBeVisible();

    await page.getByTestId("field-file").setInputFiles({
      name: "e2e-gravacao.mp3",
      mimeType: "audio/mpeg",
      buffer: FAKE_MP3,
    });
    // `field-title` está DENTRO do drawer — a tela de revisão usa
    // `input.input-title` pro título do hino, então não há ambiguidade.
    await page.getByTestId("audio-upload-drawer").getByTestId("field-title").fill(
      JORNADA_AUDIO_TITLE,
    );
    await page.getByTestId("submit-upload").click();

    // `onuploaded` fecha o drawer e recarrega a rota; a gravação nova nasce
    // pendente, então o que aparece na tela é o botão de revisão dela.
    await expect(page.getByTestId("audio-upload-drawer")).toHaveCount(0);
    await expect(page.getByTestId("open-audio-review")).toContainText(JORNADA_AUDIO_TITLE);
  });

  test("aprovar a gravação na fila de pendentes tira ela da lista", async ({ browser }) => {
    const page = await pageComoEditor(browser);

    // Ciclo 1.1: o aviso do dashboard virou link — a fila se alcança clicando.
    await page.goto("/editor/");
    await page.getByTestId("pending-audios-badge").click();
    await expect(page.getByTestId("pending-audios")).toBeVisible();
    await esperarHidratacao(page);

    const antes = await page.getByTestId("pending-audio-item").count();
    expect(antes, describeSeedMissing()).toBeGreaterThanOrEqual(PENDING_AUDIOS_EXPECTED);
    await page.locator("[data-testid^='approve-']").first().click();

    await expect(page.getByTestId("queue-error")).toHaveCount(0);
    await expect(page.getByTestId("pending-audio-item")).toHaveCount(antes - 1);
    await expect(page.getByTestId("pending-count")).toHaveText(new RegExp(`^${antes - 1} `));
  });

  test("publicar o hinário pelo modal de checklist", async ({ browser }) => {
    const page = await pageComoEditor(browser);

    // 1. Fechar a revisão do único hino — é o que faltava pro checklist. A
    //    mutation `setReviewStatus` grava `last_reviewed_by`, e o signal
    //    editorial deriva dele o `revised_by` da `HymnRevision`: com isso os
    //    checks "revisados" e "auditoria" passam de uma vez.
    await page.goto(`/editor/hinarios/${JORNADA_BOOK_SLUG}/`);
    const href = await page.locator("[data-testid^='hymn-revise-']").first().getAttribute("href");
    await page.goto(href!);
    await expect(page.getByTestId("revise-hymn")).toBeVisible();
    await esperarHidratacao(page);
    await page.getByTestId("save-and-advance").click();

    // Sem próximo pendente, "avançar" devolve ao hinário.
    await expect(page).toHaveURL(new RegExp(`/editor/hinarios/${JORNADA_BOOK_SLUG}`));
    await expect(page.getByTestId("all-reviewed")).toBeVisible();

    // 2. Publicar pelo modal (fiação do ciclo 1.2).
    await page.getByTestId("publish-hymnbook").click();
    const modal = page.getByTestId("publish-hymnbook-modal");
    await expect(modal).toBeVisible();
    await expect(page.getByTestId("readiness-error")).toHaveCount(0);

    // Os 4 checks do `publish_readiness`, todos cumpridos.
    await expect(page.getByTestId("readiness-check")).toHaveCount(4);
    await expect(page.locator("[data-testid='readiness-check'][data-ok='false']")).toHaveCount(0);

    await page.getByTestId("confirm-publish").click();

    // 3. Publicado: o modal fecha, a rota recarrega e o rascunho some.
    await expect(modal).toHaveCount(0);
    await expect(page.getByTestId("detail-draft-badge")).toHaveCount(0);
    await expect(page.getByTestId("publish-hymnbook")).toHaveText("Despublicar");
  });
});
