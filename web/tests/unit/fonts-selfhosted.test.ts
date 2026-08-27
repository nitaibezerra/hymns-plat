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

const REQUIRED_FONT_DEPS = [
  "@fontsource/cormorant-garamond",
  "@fontsource/source-serif-4",
  "@fontsource/inter-tight",
];

const REQUIRED_FONT_IMPORTS = [
  "@fontsource/cormorant-garamond",
  "@fontsource/source-serif-4",
  "@fontsource/inter-tight",
];

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
  it("declares the three font families as dependencies", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(WEB_ROOT, "package.json"), "utf-8"),
    ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    for (const name of REQUIRED_FONT_DEPS) {
      expect(deps[name], `missing ${name} in package.json`).toBeDefined();
    }
  });

  it("imports the three font families from src/app.css", () => {
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
