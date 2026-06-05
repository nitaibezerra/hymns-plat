import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/setup-test.ts"],
    include: ["src/**/*.{test,spec}.{js,ts}", "tests/**/*.{test,spec}.{js,ts}"],
    exclude: ["tests/e2e/**", "node_modules", ".svelte-kit"],
    // Faz Vite resolver os exports svelte na pista de `browser`/`client`
    // ao invés de `node`/`server` — necessário pra renderizar componentes
    // Svelte 5 com `mount()` via @testing-library/svelte sob jsdom.
    server: {
      deps: {
        inline: [/@testing-library\/svelte/, /svelte/],
      },
    },
    alias: [
      { find: /^svelte$/, replacement: "svelte" },
    ],
  },
  resolve: {
    conditions: process.env.VITEST ? ["browser"] : undefined,
  },
  server: {
    port: 5173,
  },
});
