/**
 * Marco 4.B — Ciclo 4B.3.
 *
 * Tokens de design portados de `static/css/design-tokens.css` (monolito) pra
 * `web/src/app.css` (shell headless). Reduzimos pro conjunto mínimo que os
 * componentes do shell consomem — paleta "Luz do Firmamento" preservada nos
 * seus papéis (background, texto, acento, borda, raios).
 *
 * Garante também que existe o override `:root[data-theme="dark"]` — o
 * ThemeToggle do ciclo 4B.5 alterna `data-theme` no `<html>`, e o CSS lê
 * isso pra trocar a paleta sem flash. (O monolito usa `html.theme-dark`,
 * o shell adota o atributo padrão `data-theme` por ser mais previsível em
 * SvelteKit.)
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const APP_CSS_PATH = path.resolve(__dirname, "../../src/app.css");

const REQUIRED_TOKENS = [
  "--color-bg",
  "--color-bg-elevated",
  "--color-text",
  "--color-text-muted",
  "--color-accent",
  "--color-border",
  "--radius-md",
  "--radius-lg",
];

describe("design tokens in src/app.css", () => {
  it("declares the minimum :root token set", () => {
    const css = readFileSync(APP_CSS_PATH, "utf-8");
    const rootBlock = css.match(/:root\s*{[^}]*}/s);
    expect(rootBlock, ":root block missing in app.css").not.toBeNull();
    for (const token of REQUIRED_TOKENS) {
      expect(rootBlock?.[0], `:root missing ${token}`).toMatch(
        new RegExp(`${token}\\s*:`),
      );
    }
  });

  it("declares a dark theme override block with the same tokens", () => {
    const css = readFileSync(APP_CSS_PATH, "utf-8");
    const darkBlock = css.match(/:root\[data-theme=["']dark["']\]\s*{[^}]*}/s);
    expect(darkBlock, "dark theme block missing in app.css").not.toBeNull();
    for (const token of ["--color-bg", "--color-text", "--color-accent"]) {
      expect(darkBlock?.[0], `dark theme missing override for ${token}`).toMatch(
        new RegExp(`${token}\\s*:`),
      );
    }
  });
});
