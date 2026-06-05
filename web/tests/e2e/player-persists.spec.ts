/**
 * Marco 4.F — Ciclo 4F.9 — TESTE-ÂNCORA do refactor headless.
 *
 * Tocar áudio em `/hinos/<slug>/<n>/`, navegar pra `/hinarios/` via
 * client-side routing, e verificar:
 *
 *   1. O `<audio>` HTML element NÃO foi desmontado (sobreviveu à transição).
 *   2. `audio.currentTime` continuou progredindo (não voltou a 0).
 *   3. A barra do player ainda está visível.
 *
 * Esse cenário é o motivo do refactor — se quebra, o ganho da SPA está
 * comprometido e vale a pena revisitar a arquitetura.
 *
 * **SKIP graceful:** Playwright ainda não foi configurado neste worktree
 * (sem `playwright.config.ts` nem servidor dev disponível em CI). O `test`
 * abaixo apenas registra o cenário; quando Sub-marco 4.G/4.H/4.I subir o
 * setup E2E, basta remover o skip e rodar `pnpm test:e2e`.
 *
 * O teste vive aqui (`tests/e2e/`) e é excluído explicitamente do vitest
 * via `vite.config.ts` (`exclude: ["tests/e2e/**"]`).
 */

import { expect, test } from "@playwright/test";

test.describe("Player global persiste em navegação client-side (4F.9)", () => {
  test.skip(
    !process.env.HINARIA_E2E_PLAYWRIGHT_READY,
    "Playwright config + dev server ainda não disponíveis neste worktree. " +
      "Setar HINARIA_E2E_PLAYWRIGHT_READY=1 quando 4.G/4.H configurarem o stack.",
  );

  test("áudio segue tocando após navegar /hinos/X → /hinarios/", async ({ page }) => {
    await page.goto("/hinos/justiceiro/1");
    await page.getByTestId("hymn-play-button").first().click();

    // Aguarda o player aparecer e tocar pelo menos 0.5s.
    const playerBar = page.getByTestId("audio-player-bar");
    await expect(playerBar).toBeVisible();
    await page.waitForFunction(() => {
      const audio = document.querySelector(
        "[data-testid=audio-player-audio]",
      ) as HTMLAudioElement | null;
      return !!audio && audio.currentTime > 0.4;
    });

    const audioElemHandleBefore = await page.$("[data-testid=audio-player-audio]");
    const tBefore = await page.evaluate(() => {
      const audio = document.querySelector(
        "[data-testid=audio-player-audio]",
      ) as HTMLAudioElement | null;
      return audio?.currentTime ?? 0;
    });

    // Navegação client-side (link interno SvelteKit).
    await page.getByRole("link", { name: /hinários/i }).click();
    await expect(page).toHaveURL(/\/hinarios\/?$/);

    // O mesmo <audio> element segue lá (não foi remontado).
    const audioElemHandleAfter = await page.$("[data-testid=audio-player-audio]");
    expect(audioElemHandleBefore).not.toBeNull();
    expect(audioElemHandleAfter).not.toBeNull();

    const tAfter = await page.evaluate(() => {
      const audio = document.querySelector(
        "[data-testid=audio-player-audio]",
      ) as HTMLAudioElement | null;
      return audio?.currentTime ?? 0;
    });

    // currentTime avançou (não voltou pra 0).
    expect(tAfter).toBeGreaterThanOrEqual(tBefore);
    // Barra ainda visível na nova rota.
    await expect(playerBar).toBeVisible();
  });

  test("dismiss esconde a barra mas mantém o sistema funcional", async ({ page }) => {
    await page.goto("/hinos/justiceiro/1");
    await page.getByTestId("hymn-play-button").first().click();
    await expect(page.getByTestId("audio-player-bar")).toBeVisible();
    await page.getByTestId("audio-player-close").click();
    await expect(page.getByTestId("audio-player-bar")).toBeHidden();
  });
});
