/**
 * Marco 3 — Ciclo 3.1.
 *
 * Smoke test: `pnpm build` produz artefato válido. Isso garante que o
 * scaffold SvelteKit + Vite + adapter-cloudflare está bem configurado antes
 * de tocar em código de domínio.
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const WEB_DIR = join(import.meta.dirname, "..");

describe("SvelteKit build", () => {
  it("produces a valid build output", () => {
    execSync("pnpm build", { cwd: WEB_DIR, stdio: "pipe" });
    expect(existsSync(join(WEB_DIR, ".svelte-kit/output"))).toBe(true);
  }, 120000);
});
