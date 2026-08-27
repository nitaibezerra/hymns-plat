/**
 * Marco 4.F — Ciclo 4F.9 — TESTE-ÂNCORA do refactor headless.
 *
 * Tocar áudio no detalhe de um hino, navegar pra `/hinarios/` por
 * client-side routing, e verificar:
 *
 *   1. O `<audio>` é o MESMO elemento (não foi desmontado e remontado).
 *   2. `audio.currentTime` continuou progredindo (não voltou a 0).
 *   3. A barra do player ainda está visível na rota nova.
 *
 * Esse cenário é o motivo do refactor — se quebra, o ganho da SPA está
 * comprometido e vale a pena revisitar a arquitetura. Ele é critério de aceite
 * do Marco 4 e, até esta frente, **nunca havia rodado**.
 *
 * **Por que nunca rodou.** A versão anterior desta spec era um esqueleto
 * escrito sob `test.skip` e jamais executado, e apontava pra coisas que não
 * existem em nenhum dos dois apps:
 *
 * - a rota `/hinos/justiceiro/1` — o detalhe de hino é `/hinos/<uuid>/` nos
 *   DOIS lados (`apps/hymns/urls.py` usa `<uuid:pk>`; o shell tem
 *   `src/routes/hinos/[pk]`). Nunca houve rota `slug/numero`;
 * - o testid `hymn-play-button` — o botão real é `data-testid="play-button"`
 *   (`src/lib/components/PlayButton.svelte`).
 *
 * Ou seja: não era "spec que depende do banco de dev", era spec que nunca foi
 * executada uma vez. Agora ela aponta pra fixture (`seed_e2e` semeia
 * `e2e-paridade` com um áudio aprovado e TOCÁVEL no hino nº 1) e pros testids
 * de verdade.
 *
 * **Áudio tocável não é detalhe.** `currentTime` só avança se o browser
 * conseguir DECODIFICAR o arquivo. O resto da fixture grava bytes falsos de
 * propósito (a fila de pendentes usa `preload="none"`, então o conteúdo nunca
 * é buscado); pra este hino o seed grava uma senoide WAV de 3 s.
 *
 * **Achado que a spec tem que contornar:** o `url` que o GraphQL devolve pra
 * um áudio é `FileField.url`, ou seja **relativo** (`/media/…`). O
 * `<audio src>` do shell resolve isso contra a origem do SHELL — e o dev
 * server do Vite não serve `/media/` (medido: 404 em `:5173`, 200 em `:9000`).
 * Aqui a spec redireciona as requisições de mídia pro Django com `page.route`
 * (o glob está no código, não aqui: um `*` seguido de barra fecharia este
 * comentário). O
 * problema é real em produção também: o shell é servido por outro domínio
 * (`adapter-cloudflare`) e uma URL relativa de mídia não vai resolver lá.
 * Corrigir é em `apps/api/types.py` ou em `web/src/**` — fora do escopo desta
 * frente; registrado em `_plan/marco4-diff-notes.md`.
 *
 * **Pra rodar:**
 *
 * ```bash
 * cd web
 * ./scripts/dev-fullstack.sh
 * HINARIA_E2E_PLAYWRIGHT_READY=1 pnpm exec playwright test \
 *   --project=chromium tests/e2e/player-persists.spec.ts
 * ./scripts/dev-fullstack.sh down
 * ```
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { PARITY_BOOK_SLUG, describeSeedMissing } from "./_helpers/seed-fixture";

const DJANGO_BASE = process.env.HINARIA_DJANGO_BASE_URL ?? "http://localhost:9000";
const SVELTE_BASE = process.env.HINARIA_SVELTE_BASE_URL ?? "http://localhost:5173";
const HYMN_BOOK_SLUG = process.env.HINARIA_E2E_HYMNBOOK_SLUG ?? PARITY_BOOK_SLUG;

/** Marcador cravado no `<audio>` pra provar identidade do elemento. */
const MARCA = "__hinariaE2EMarca";

/**
 * Faz o dev server do shell servir `/media/` do Django.
 *
 * Sem isso o `<audio>` recebe 404 e `currentTime` nunca sai de 0 — o teste
 * falharia por causa do ambiente, não do produto.
 */
async function roteiaMediaProDjango(page: Page): Promise<void> {
  await page.route("**/media/**", async (route) => {
    const url = new URL(route.request().url());
    const resposta = await page.request.fetch(`${DJANGO_BASE}${url.pathname}${url.search}`);
    await route.fulfill({ response: resposta });
  });
}

/**
 * Descobre a URL do detalhe do hino nº 1 do hinário da fixture — o que tem o
 * áudio aprovado e tocável — lendo o primeiro link `/hinos/<uuid>/` do índice
 * no Django.
 */
async function urlDoHinoComAudio(page: Page): Promise<string> {
  const fromEnv = process.env.HINARIA_E2E_HYMN_PK;
  if (fromEnv) return `${SVELTE_BASE}/hinos/${fromEnv}/`;

  await page.goto(`${DJANGO_BASE}/hinarios/${HYMN_BOOK_SLUG}/?mode=indice`, {
    waitUntil: "domcontentloaded",
  });
  const href = await page.locator('a[href^="/hinos/"]').first().getAttribute("href");
  const pk = href?.match(/^\/hinos\/([^/]+)\//)?.[1];
  expect(
    pk,
    `Não achei link /hinos/<pk>/ no índice de "${HYMN_BOOK_SLUG}". ${describeSeedMissing()}`,
  ).toBeTruthy();
  return `${SVELTE_BASE}/hinos/${pk}/`;
}

/**
 * Abre o detalhe do hino no shell e espera a HIDRATAÇÃO.
 *
 * `page.goto` com o default (`load`) volta antes do Svelte anexar os handlers,
 * e o click no botão vira no-op — medido: a barra do player simplesmente não
 * aparecia, e o teste falhava como se o produto estivesse quebrado.
 */
async function abreHinoHidratado(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: "networkidle" });
  await expect(page.getByTestId("hymn-detail")).toBeVisible();
}

/** Toca o primeiro áudio do hino e espera o `currentTime` passar de `minimo`. */
async function tocaEEsperaProgresso(page: Page, minimo: number): Promise<void> {
  await expect(
    page.getByTestId("play-button").first(),
    "o hino da fixture tem que ter um áudio APROVADO — só esses aparecem pro anônimo. " +
      describeSeedMissing(),
  ).toBeVisible();
  await page.getByTestId("play-button").first().click();

  await expect(page.getByTestId("audio-player-bar")).toBeVisible();
  await page.waitForFunction(
    (limite) => {
      const audio = document.querySelector(
        "[data-testid=audio-player-audio]",
      ) as HTMLAudioElement | null;
      return !!audio && audio.currentTime > limite;
    },
    minimo,
    { timeout: 15_000 },
  );
}

function leCurrentTime(page: Page): Promise<number> {
  return page.evaluate(() => {
    const audio = document.querySelector(
      "[data-testid=audio-player-audio]",
    ) as HTMLAudioElement | null;
    return audio?.currentTime ?? 0;
  });
}

test.describe("Player global persiste em navegação client-side (4F.9)", () => {
  test.skip(
    !process.env.HINARIA_E2E_PLAYWRIGHT_READY,
    "Precisa dos dois servidores no ar e do banco semeado. " +
      "Rode `./scripts/dev-fullstack.sh` e exporte HINARIA_E2E_PLAYWRIGHT_READY=1.",
  );

  test("áudio segue tocando após navegar /hinos/<pk> → /hinarios/", async ({ page }) => {
    await roteiaMediaProDjango(page);
    await abreHinoHidratado(page, await urlDoHinoComAudio(page));

    await tocaEEsperaProgresso(page, 0.4);

    // Marca o elemento. É isto que prova identidade: se o `<audio>` fosse
    // desmontado e remontado na transição, a propriedade sumiria. "O seletor
    // ainda casa" não provaria nada — casaria num elemento novo também, e a
    // versão anterior desta spec só checava isso.
    await page.evaluate((chave) => {
      const audio = document.querySelector("[data-testid=audio-player-audio]") as
        | (HTMLAudioElement & Record<string, unknown>)
        | null;
      if (audio) audio[chave] = "sobrevivi";
    }, MARCA);

    const tAntes = await leCurrentTime(page);
    expect(tAntes).toBeGreaterThan(0.4);

    // Navegação client-side (link interno do SvelteKit, não `page.goto`).
    await page.getByRole("link", { name: /hinários/i }).first().click();
    await expect(page).toHaveURL(/\/hinarios\/?$/);

    const marca = await page.evaluate((chave) => {
      const audio = document.querySelector("[data-testid=audio-player-audio]") as
        | (HTMLAudioElement & Record<string, unknown>)
        | null;
      return audio ? audio[chave] : null;
    }, MARCA);
    expect(
      marca,
      "o <audio> foi remontado na transição — o player NÃO sobreviveu à navegação, " +
        "que é justamente o ganho que o refactor headless (Marco 4.F) promete",
    ).toBe("sobrevivi");

    // Progressão: espera passar do tempo anterior em vez de comparar na hora —
    // um `>=` imediato passaria com o áudio pausado, que é o bug que interessa.
    await page.waitForFunction(
      (limite) => {
        const audio = document.querySelector(
          "[data-testid=audio-player-audio]",
        ) as HTMLAudioElement | null;
        return !!audio && audio.currentTime > limite;
      },
      tAntes,
      { timeout: 15_000 },
    );
    const tDepois = await leCurrentTime(page);
    expect(tDepois).toBeGreaterThan(tAntes);

    await expect(page.getByTestId("audio-player-bar")).toBeVisible();
  });

  test("dismiss esconde a barra mas mantém o <audio> montado", async ({ page }) => {
    await roteiaMediaProDjango(page);
    await abreHinoHidratado(page, await urlDoHinoComAudio(page));

    await tocaEEsperaProgresso(page, 0.2);
    await expect(page.getByTestId("audio-player-bar")).toBeVisible();
    const tAntes = await leCurrentTime(page);

    await page.getByTestId("audio-player-close").click();
    await expect(page.getByTestId("audio-player-bar")).toBeHidden();

    // O ponto de projeto do 4F.10, que também nunca havia sido verificado: o
    // `<audio>` fica no DOM quando o usuário "fecha" a barra, pra não resetar
    // o buffer (`{#if player.currentTrack}` em AudioPlayer.svelte). Só a barra
    // some. Se o elemento fosse desmontado, o download recomeçaria do zero na
    // próxima vez.
    await expect(page.locator("[data-testid=audio-player-audio]")).toHaveCount(1);
    const tDepois = await leCurrentTime(page);
    expect(
      tDepois,
      "o buffer foi descartado no dismiss — o <audio> não devia ser desmontado",
    ).toBeGreaterThanOrEqual(tAntes);
  });

  // ACHADO, não pendência de ambiente: depois de `dismiss()`, clicar no
  // `PlayButton` da MESMA faixa não traz a barra de volta — e não há outro
  // caminho na UI, porque a barra (dona dos controles) está escondida. A faixa
  // fica inalcançável até o usuário tocar OUTRO áudio ou recarregar a página.
  //
  // Causa, lida no código: `PlayButton.handleClick` chama `audioPlayer.play()`
  // só quando a faixa NÃO é a ativa; sendo a ativa, chama `togglePlay()`.
  // `play()` limpa `isDismissed` (`src/lib/stores/audio.ts`), `togglePlay()`
  // não — ele só inverte `isPlaying`. O comentário do próprio AudioPlayer diz
  // a intenção ("isDismissed=true → some completamente; recriado quando play()
  // é chamado"), então é o `PlayButton` que curto-circuita a intenção.
  //
  // Conserto de uma linha, em `web/src/**` — fora do escopo desta frente
  // (outra frente está editando esses arquivos em paralelo). Duas saídas
  // possíveis: `handleClick` chamar `play(track)` quando `isDismissed`, ou
  // `togglePlay()` limpar `isDismissed` ao voltar a tocar. Registrado em
  // `_plan/marco4-diff-notes.md`.
  //
  // Fica como `fixme` de propósito: é pendência declarada no código, que o
  // guard do job de CI aceita, e não um teste vermelho sem dono.
  test.fixme("tocar de novo depois do dismiss traz a barra de volta", async ({ page }) => {
    await roteiaMediaProDjango(page);
    await abreHinoHidratado(page, await urlDoHinoComAudio(page));

    await tocaEEsperaProgresso(page, 0.2);
    await page.getByTestId("audio-player-close").click();
    await expect(page.getByTestId("audio-player-bar")).toBeHidden();

    await page.getByTestId("play-button").first().click();
    await expect(page.getByTestId("audio-player-bar")).toBeVisible();
  });
});
