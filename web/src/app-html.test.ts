/**
 * Frente B, B3 — o `<head>` do shell tem que bater com o que existe em
 * `static/`.
 *
 * O comentário `TODO(Marco 6)` que morava no topo do `app.html` dizia que o
 * favicon e os ícones do manifest "ainda não existem". Eles existem desde o
 * PR dos ícones PWA — o aviso passou a mentir, e comentário que mente é pior
 * que comentário nenhum. Os testes abaixo prendem cada tag ao arquivo real,
 * de forma que a próxima divergência apareça aqui em vez de ficar registrada
 * numa prosa desatualizada.
 *
 * (Mora em `src/` e não em `tests/unit/` porque `web/tests/**` está fora do
 * escopo desta frente; o `include` do vitest cobre os dois.)
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const WEB_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP_HTML = readFileSync(resolve(WEB_DIR, "src/app.html"), "utf8");

function existeEmStatic(caminho: string): boolean {
  try {
    readFileSync(resolve(WEB_DIR, "static", caminho));
    return true;
  } catch {
    return false;
  }
}

describe("app.html — ícones (B3)", () => {
  it("não sobrou aviso dizendo que os ícones ainda não existem", () => {
    expect(APP_HTML).not.toMatch(/TODO\(Marco 6\)/);
    expect(APP_HTML).not.toMatch(/ainda não existem/i);
  });

  it("declara o apple-touch-icon explicitamente", () => {
    // O iOS acha `/apple-touch-icon.png` por convenção mesmo sem a tag; a tag
    // torna a dependência visível pra quem lê o `<head>`.
    expect(APP_HTML).toContain(
      '<link rel="apple-touch-icon" href="%sveltekit.assets%/apple-touch-icon.png" />',
    );
    expect(existeEmStatic("apple-touch-icon.png")).toBe(true);
  });

  it("mantém favicon e manifest, e os dois arquivos existem", () => {
    expect(APP_HTML).toContain('<link rel="icon" href="%sveltekit.assets%/favicon.png" />');
    expect(APP_HTML).toContain('<link rel="manifest" href="%sveltekit.assets%/manifest.webmanifest" />');
    expect(existeEmStatic("favicon.png")).toBe(true);
    expect(existeEmStatic("manifest.webmanifest")).toBe(true);
  });
});

describe("app.html — theme-color (B3)", () => {
  it("tem um theme-color por esquema, com os valores de `--color-bg`", () => {
    const claro = APP_HTML.match(
      /<meta\s+name="theme-color"\s+media="\(prefers-color-scheme: light\)"\s+content="([^"]+)"/,
    );
    const escuro = APP_HTML.match(
      /<meta\s+name="theme-color"\s+media="\(prefers-color-scheme: dark\)"\s+content="([^"]+)"/,
    );

    expect(claro?.[1]).toBe("#F6EFE2");
    expect(escuro?.[1]).toBe("#0E1320");
  });

  it("nenhum theme-color sem `media` — um sozinho venceria os dois", () => {
    const todos = APP_HTML.match(/<meta\s+name="theme-color"[\s\S]*?\/>/g) ?? [];
    expect(todos).toHaveLength(2);
    for (const tag of todos) {
      expect(tag).toMatch(/prefers-color-scheme/);
    }
  });
});
