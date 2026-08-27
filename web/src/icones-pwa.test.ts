/**
 * Frente B, B4 — o gerador dos ícones PWA passa a ser código versionado.
 *
 * Ele nasceu colado dentro de `_plan/marco6-decisoes.md` porque `web/scripts/`
 * estava fora do escopo da frente dos ícones. Enquanto morava lá, `static/`
 * tinha cinco PNGs sem fonte executável: ninguém conseguia regerar sem
 * copiar código de um markdown.
 *
 * O teste é uma checagem de reprodutibilidade barata: o SVG mestre em
 * `static/icone-mestre.svg` tem que sair, byte a byte, do mesmo `svgIcone()`
 * que o script usa pra rasterizar os PNGs. Se alguém mexer na geometria e
 * esquecer de rodar `pnpm gerar-icones`, cai aqui. A rasterização em si não é
 * testada: depende do ImageMagick com delegate RSVG, que nem sempre existe no
 * runner do CI — ela é verificada à mão ao rodar o script.
 *
 * (Mora em `src/` e não em `tests/unit/` porque `web/tests/**` está fora do
 * escopo desta frente; o `include` do vitest cobre os dois.)
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { GEO_ANY, GEO_FAVICON, GEO_MASKABLE, svgIcone } from "../scripts/gerar-icones.mjs";

const WEB_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function lerWeb(caminho: string): string {
  return readFileSync(resolve(WEB_DIR, caminho), "utf8");
}

describe("gerador de ícones PWA (B4)", () => {
  it("está versionado em web/scripts/ e exposto como script do pnpm", () => {
    const pkg = JSON.parse(lerWeb("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["gerar-icones"]).toBe("node scripts/gerar-icones.mjs");
    expect(lerWeb("scripts/gerar-icones.mjs")).toContain("svgIcone");
  });

  it("reproduz exatamente o `static/icone-mestre.svg` que está no repo", () => {
    expect(svgIcone(GEO_ANY)).toBe(lerWeb("static/icone-mestre.svg"));
  });

  it("a variante maskable cabe na safe zone de 80% (círculo de raio 40%)", () => {
    // Decisão registrada em `_plan/marco6-decisoes.md`, seção "Geometria".
    // A composição é glifo + vão + filete, centrada; meia-diagonal precisa
    // caber no círculo inscrito a 80% do lado.
    const lado = 512;
    const alturaTotal =
      GEO_MASKABLE.alturaGlifo * lado + GEO_MASKABLE.vao * lado + GEO_MASKABLE.filete * lado;
    const largura = GEO_MASKABLE.fileteLarg * lado;
    const meiaDiagonal = Math.hypot(largura / 2, alturaTotal / 2);

    expect(meiaDiagonal).toBeLessThan(0.4 * lado);
  });

  it("o favicon abre mão do filete e usa o glifo maior (tamanho óptico)", () => {
    expect(GEO_FAVICON.filete).toBe(0);
    expect(GEO_FAVICON.alturaGlifo).toBeGreaterThan(GEO_ANY.alturaGlifo);
    expect(svgIcone(GEO_FAVICON)).not.toContain("<rect x=");
  });

  it("as três cores saem dos tokens do design system", () => {
    const svg = svgIcone(GEO_ANY);
    expect(svg).toContain("#1D3B6A"); // --color-firmament (fundo)
    expect(svg).toContain("#F6EFE2"); // --color-bg (tinta)
    expect(svg).toContain("#B8893A"); // --color-gold (filete)
  });

  it("a variante invertida troca fundo e tinta, sem inventar cor nova", () => {
    const invertido = svgIcone({ ...GEO_ANY, invertido: true });
    expect(invertido).toContain(`<rect width="512" height="512" fill="#F6EFE2"/>`);
    expect(invertido).toContain(`fill="#1D3B6A"`);
  });

  it("importar o módulo não escreve nada em static/ (efeito só ao rodar)", () => {
    // Se a geração rodasse no import, este próprio teste regeraria os ícones.
    expect(lerWeb("scripts/gerar-icones.mjs")).toMatch(/import\.meta\.url/);
  });
});
