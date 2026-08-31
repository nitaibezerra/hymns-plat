/**
 * Marco 4.B — Ciclo 4B.2.
 *
 * Fontes do shell são self-hosted via @fontsource/*. O monolito Django carrega
 * fontes do Google Fonts CDN (`https://fonts.googleapis.com/css2?…`); o shell
 * headless NÃO pode fazer isso — Cloudflare Pages tem CSP estrito e a
 * preferência arquitetural é zero requisições externas pra fontes.
 *
 * Este teste cobre duas garantias:
 *
 *   1. As três fontes principais (Cormorant Garamond, Source Serif 4,
 *      Inter Tight) estão como dependências @fontsource e importadas em
 *      `src/app.css`.
 *
 *   2. Nenhum arquivo do projeto (excluindo `node_modules/`, `.svelte-kit/`,
 *      `build/`, `tests/` e este próprio teste) referencia
 *      `fonts.googleapis.com` ou `fonts.gstatic.com`.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const WEB_ROOT = path.resolve(__dirname, "../../");

/* QUATRO famílias, não três. `templates/base.html` do monolito carrega
   Cormorant Garamond, Source Serif 4, Inter Tight E JetBrains Mono; a migração
   para self-hosting portou as três primeiras e esqueceu a mono. `--font-mono`
   ficou declarada apontando para uma fonte que nunca era baixada, então todo
   eyebrow, badge e `.label-mono` do app renderizava no monospace do sistema —
   e nenhum teste reclamou, porque a lista aqui também tinha só três.
   Corrigido na Fase 1 da paridade visual (2026-08-31). */
const FAMILIAS_OBRIGATORIAS = [
  "@fontsource/cormorant-garamond",
  "@fontsource/source-serif-4",
  "@fontsource/inter-tight",
  "@fontsource/jetbrains-mono",
];

const REQUIRED_FONT_DEPS = FAMILIAS_OBRIGATORIAS;
const REQUIRED_FONT_IMPORTS = FAMILIAS_OBRIGATORIAS;

const FORBIDDEN_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

const SKIP_DIRS = new Set([
  "node_modules",
  ".svelte-kit",
  ".git",
  "build",
  "dist",
  "tests",
  "src/lib/graphql/generated.ts",
]);

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      walk(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

describe("fonts self-hosted via @fontsource", () => {
  it("declares the four font families as dependencies", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(WEB_ROOT, "package.json"), "utf-8"),
    ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    for (const name of REQUIRED_FONT_DEPS) {
      expect(deps[name], `missing ${name} in package.json`).toBeDefined();
    }
  });

  it("imports the four font families from src/app.css", () => {
    const appCss = readFileSync(path.join(WEB_ROOT, "src/app.css"), "utf-8");
    for (const name of REQUIRED_FONT_IMPORTS) {
      expect(appCss, `app.css missing import for ${name}`).toMatch(
        new RegExp(`@import\\s+["']${name}`),
      );
    }
  });

  it("does not reference any Google Fonts CDN host in source files", () => {
    const files = walk(WEB_ROOT).filter((file) => {
      const rel = path.relative(WEB_ROOT, file);
      // Skip the lockfile (it can reference upstream metadata),
      // and skip this test itself (it contains the strings as data).
      if (rel.endsWith("pnpm-lock.yaml")) return false;
      if (rel === path.join("tests", "unit", "fonts-selfhosted.test.ts")) return false;
      return /\.(svelte|ts|tsx|js|jsx|css|html|json|md)$/.test(rel);
    });

    const offenders: { file: string; host: string }[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      for (const host of FORBIDDEN_HOSTS) {
        if (content.includes(host)) offenders.push({ file: path.relative(WEB_ROOT, file), host });
      }
    }
    expect(offenders, `Google Fonts CDN found: ${JSON.stringify(offenders)}`).toEqual([]);
  });
});
