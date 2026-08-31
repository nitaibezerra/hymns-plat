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

import { readFileSync, readdirSync, statSync } from "node:fs";
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
  // Superfícies de card/modal/drawer. Adicionadas na Fase 1 da paridade
  // visual: eram consumidas em 19 lugares SEM fallback e nunca declaradas,
  // então 19 fundos renderizavam transparentes. Ver o teste de órfãos abaixo,
  // que é a forma geral desta regressão.
  "--color-surface",
  "--color-surface-soft",
  "--color-on-accent",
];

const SRC_DIR = path.resolve(__dirname, "../../src");
const COMPONENTS_CSS_PATH = path.resolve(
  __dirname,
  "../../src/lib/styles/components.css",
);

function declaracoesEm(conteudo: string): Set<string> {
  return new Set(conteudo.match(/--[a-z0-9-]+(?=\s*:)/g) ?? []);
}

function arquivosDeEstilo(dir: string, encontrados: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const caminho = path.join(dir, entrada);
    if (statSync(caminho).isDirectory()) {
      arquivosDeEstilo(caminho, encontrados);
    } else if (/\.(svelte|css)$/.test(entrada)) {
      encontrados.push(caminho);
    }
  }
  return encontrados;
}

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

  /**
   * A forma GERAL do bug que a Fase 1 consertou: `var(--token)` sem fallback
   * apontando para um token que ninguém declara. O CSS não erra — só resolve
   * para nada, e o elemento renderiza sem cor. Foi assim que 19 superfícies de
   * card/modal ficaram transparentes por um marco inteiro sem ninguém notar.
   *
   * Um token declarado no PRÓPRIO arquivo vale (componentes definem custom
   * properties locais); o que não pode é referência a lugar nenhum.
   */
  it("nenhum var(--token) sem fallback aponta para token não declarado", () => {
    const globais = new Set([
      ...declaracoesEm(readFileSync(APP_CSS_PATH, "utf-8")),
      ...declaracoesEm(readFileSync(COMPONENTS_CSS_PATH, "utf-8")),
    ]);

    const orfaos: string[] = [];
    for (const arquivo of arquivosDeEstilo(SRC_DIR)) {
      const conteudo = readFileSync(arquivo, "utf-8");
      const locais = declaracoesEm(conteudo);
      for (const uso of conteudo.match(/var\(--[a-z0-9-]+\)/g) ?? []) {
        const token = uso.slice(4, -1);
        if (globais.has(token) || locais.has(token)) continue;
        orfaos.push(`${path.relative(SRC_DIR, arquivo)}: ${token}`);
      }
    }

    expect(orfaos, `tokens usados e nunca declarados:\n${orfaos.join("\n")}`).toEqual([]);
  });
});
