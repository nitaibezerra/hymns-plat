/**
 * Marco 4.I — configuração base do Playwright pra suíte E2E e
 * paridade visual Django ↔ SvelteKit.
 *
 * **Decisões fixadas:**
 *
 * - Dois projects: `chromium` e `firefox`. Local roda só Chromium por
 *   velocidade (`pnpm exec playwright test --project=chromium`); CI
 *   roda os dois quando for ligado.
 * - `baseURL` aponta pra `localhost:5173` (SvelteKit). O Django roda em
 *   `localhost:9000` e é orquestrado por `scripts/dev-fullstack.sh`.
 *   Os specs usam URLs absolutas pra Django e relativas pra SvelteKit.
 * - Por default os testes ficam em SKIP (`HINARIA_E2E_PLAYWRIGHT_READY=1`
 *   pra ativar) — mantém CI normal verde enquanto orquestração de Django
 *   dev server em GitHub Actions é follow-up.
 * - O threshold de paridade (5%) NÃO mora aqui. `expect.toHaveScreenshot` só
 *   valeria pra comparação contra baseline em disco, e a suíte de paridade
 *   compara duas capturas ao vivo (Django e SvelteKit na mesma corrida) via
 *   `tests/e2e/_helpers/parity-report.ts` — é lá que `DEFAULT_MAX_DIFF_RATIO`
 *   vive, junto das tolerâncias de anti-alias e sub-pixel de fonte.
 * - `outputDir` recebe as capturas e os PNGs de diff em
 *   `test-results/visual-parity/`.
 * - `test-results/`, `playwright-report/` já no `.gitignore`.
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  outputDir: "test-results",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
  ],
});
