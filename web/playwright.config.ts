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
 * - `maxDiffPixelRatio: 0.05` (5%) é o threshold padrão de paridade visual
 *   por rota. Diferenças cosméticas anti-alias/Tailwind CDN vs build são
 *   aceitáveis dentro desse limite.
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
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.05,
      animations: "disabled",
    },
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
