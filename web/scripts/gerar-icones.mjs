#!/usr/bin/env node
/**
 * Gera os ícones PWA da Hinária a partir de um monograma tipográfico.
 *
 * O glifo "h" (Cormorant Garamond 600, o mesmo peso da brand no Header) já vem
 * CONVERTIDO EM PATH — não há dependência de fonte instalada, então o render é
 * idêntico em qualquer máquina. Ver `_plan/marco6-decisoes.md`, seção 6, para
 * como o path foi extraído e por que a variante escolhida é tinta-papel sobre
 * firmamento.
 *
 * Uso:
 *   pnpm gerar-icones                      # escreve em web/static/
 *   HINARIA_STATIC_DIR=/tmp/x pnpm gerar-icones   # em outro lugar (conferência)
 *   MAGICK_BIN=/usr/local/bin/magick pnpm gerar-icones
 *
 * Requer ImageMagick (`magick`) com delegate RSVG. Saída em `web/static/`:
 *   - icone-mestre.svg            (mestre vetorial, variante "any")
 *   - icons/icon-192.png          (192×192, purpose "any")
 *   - icons/icon-512.png          (512×512, purpose "any")
 *   - icons/icon-maskable-512.png (512×512, safe zone 80%, purpose "maskable")
 *   - favicon.png                 (48×48, glifo maior e sem filete)
 *   - apple-touch-icon.png        (180×180, iOS ignora ícone de manifest)
 *
 * Só gera quando executado direto (`node scripts/gerar-icones.mjs`); importar o
 * módulo não escreve nada — `src/icones-pwa.test.ts` usa `svgIcone()` pra
 * conferir que o mestre versionado ainda é o que este código produz.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = process.env.HINARIA_STATIC_DIR ?? resolve(__dirname, "..", "static");
const MAGICK = process.env.MAGICK_BIN ?? "/opt/homebrew/bin/magick";

/* Paleta canônica — `static/css/design-tokens.css`. */
const FIRMAMENTO = "#1D3B6A";
const PAPEL = "#F6EFE2";
const OURO = "#B8893A";

const C = 512; // lado do viewBox

/* Monograma "h" da Cormorant Garamond 600, contorno em coordenadas de fonte
   (upem 1000) já com o Y invertido para o sistema do SVG. bbox: x 1.5…490,
   y -725…0 — ou seja 488.5 × 725 unidades. */
const GLIFO_H =
  "M23.0 0.0Q20.0 0.0 20.0 -6.0Q20.0 -12.0 23.0 -12.0Q56.0 -12.0 68.0 -26.0Q80.0 -40.0 80.0 -81.0V-592.0Q80.0 -627.0 73.5 -642.5Q67.0 -658.0 50.0 -658.0Q35.0 -658.0 9.0 -646.0Q6.0 -645.0 3.0 -650.5Q0.0 -656.0 3.0 -658.0L142.0 -724.0Q144.0 -725.0 145.0 -725.0H146.0Q151.0 -725.0 155.5 -721.0Q160.0 -717.0 160.0 -714.0V-315.0Q188.0 -348.0 219.0 -368.0Q263.0 -397.0 313.0 -397.0Q368.0 -397.0 398.5 -363.5Q429.0 -330.0 429.0 -274.0V-81.0Q429.0 -40.0 440.5 -26.0Q452.0 -12.0 486.0 -12.0Q490.0 -12.0 490.0 -6.0Q490.0 0.0 486.0 0.0Q467.0 0.0 442.5 -1.0Q418.0 -2.0 389.0 -2.0Q361.0 -2.0 336.0 -1.0Q311.0 0.0 292.0 0.0Q289.0 0.0 289.0 -6.0Q289.0 -12.0 292.0 -12.0Q325.0 -12.0 337.0 -26.0Q349.0 -40.0 349.0 -81.0V-230.0Q349.0 -340.0 263.0 -340.0Q231.0 -340.0 197.0 -322.0Q176.0 -311.0 160.0 -295.0V-81.0Q160.0 -40.0 171.5 -26.0Q183.0 -12.0 217.0 -12.0Q221.0 -12.0 221.0 -6.0Q221.0 0.0 217.0 0.0Q198.0 0.0 173.5 -1.0Q149.0 -2.0 120.0 -2.0Q92.0 -2.0 67.0 -1.0Q42.0 0.0 23.0 0.0Z";
const GLIFO_X0 = 1.5;
const GLIFO_LARG = 488.5;
const GLIFO_ALT = 725;

/**
 * @param {number} v
 * @returns {number}
 */
const n = (v) => Number(v.toFixed(2));

/**
 * @typedef {object} Geometria
 * @property {number} alturaGlifo fração do lado ocupada pela altura do "h"
 * @property {number} [filete]     espessura do filete dourado em frações do lado (0 = sem filete)
 * @property {number} [fileteLarg] largura do filete em frações do lado
 * @property {number} [vao]        respiro entre a base do "h" e o filete, em frações do lado
 * @property {boolean} [invertido] true = papel de fundo, tinta firmamento
 */

/**
 * Monta o SVG do ícone.
 *
 * @param {Geometria} geometria
 * @returns {string}
 */
export function svgIcone({
  alturaGlifo,
  filete = 0.0215,
  fileteLarg = 0.41,
  vao = 0.05,
  invertido = false,
}) {
  const fundo = invertido ? PAPEL : FIRMAMENTO;
  const tinta = invertido ? FIRMAMENTO : PAPEL;

  const hGlifo = alturaGlifo * C;
  const escala = hGlifo / GLIFO_ALT;
  const wGlifo = GLIFO_LARG * escala;

  const espFilete = filete * C;
  const wFilete = fileteLarg * C;
  const vaoPx = filete > 0 ? vao * C : 0;

  const alturaTotal = hGlifo + vaoPx + espFilete;
  const topo = (C - alturaTotal) / 2;

  // Glifo: leva a bbox para (X, topo). translate compensa x0 e a baseline.
  const tx = (C - wGlifo) / 2 - GLIFO_X0 * escala;
  const ty = topo + hGlifo;

  const fileteSvg =
    filete > 0
      ? `\n  <rect x="${n((C - wFilete) / 2)}" y="${n(topo + hGlifo + vaoPx)}" ` +
        `width="${n(wFilete)}" height="${n(espFilete)}" fill="${OURO}"/>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${C}" height="${C}" viewBox="0 0 ${C} ${C}" role="img" aria-label="Hinária">
  <title>Hinária</title>
  <rect width="${C}" height="${C}" fill="${fundo}"/>
  <path transform="translate(${n(tx)} ${n(ty)}) scale(${n(escala)})" d="${GLIFO_H}" fill="${tinta}"/>${fileteSvg}
</svg>
`;
}

/* Geometrias. "any" ocupa 52% do lado; "maskable" encolhe para 40% e estreita o
   filete, de forma que a composição inteira caiba no círculo de raio 40% do
   lado (safe zone de 80%). O favicon usa o glifo maior e abre mão do filete: em
   16px o ouro sobre azul vira uma linha suja. */

/** @type {Geometria} */
export const GEO_ANY = { alturaGlifo: 0.52 };
/** @type {Required<Pick<Geometria, "alturaGlifo" | "filete" | "fileteLarg" | "vao">>} */
export const GEO_MASKABLE = { alturaGlifo: 0.4, filete: 0.0166, fileteLarg: 0.315, vao: 0.039 };
/** @type {Required<Pick<Geometria, "alturaGlifo" | "filete">>} */
export const GEO_FAVICON = { alturaGlifo: 0.7, filete: 0 };

/**
 * Rasteriza um SVG em PNG via ImageMagick.
 *
 * @param {string} svg conteúdo do SVG
 * @param {string} destino caminho relativo a `STATIC_DIR`
 * @param {number} tamanho lado do PNG em px
 */
function png(svg, destino, tamanho) {
  // O SVG temporário vai pro tmp do sistema, não pra `static/`: `static/` é
  // servido pelo SvelteKit e um arquivo órfão ali viraria asset público.
  const svgTmp = resolve(tmpdir(), `hinaria-icone-${tamanho}-${process.pid}-${Date.now()}.svg`);
  writeFileSync(svgTmp, svg);
  try {
    execFileSync(MAGICK, [
      "-background", "none",
      "-density", "600",
      svgTmp,
      "-resize", `${tamanho}x${tamanho}`,
      "-strip",
      // 8 bits e truecolor sem alpha: o build Q16 do ImageMagick grava PNG de
      // 16 bits por padrão, o que dobra o peso sem ganho nenhum num ícone chapado.
      "-depth", "8",
      "-define", "png:color-type=2",
      resolve(STATIC_DIR, destino),
    ]);
  } finally {
    rmSync(svgTmp, { force: true });
  }
  console.log(`  ok  ${destino} (${tamanho}px)`);
}

/** Escreve o mestre e os cinco rasters em `STATIC_DIR`. */
export function gerarIcones() {
  mkdirSync(resolve(STATIC_DIR, "icons"), { recursive: true });

  const mestre = svgIcone(GEO_ANY);
  writeFileSync(resolve(STATIC_DIR, "icone-mestre.svg"), mestre);
  console.log("  ok  icone-mestre.svg");

  png(mestre, "icons/icon-192.png", 192);
  png(mestre, "icons/icon-512.png", 512);
  png(svgIcone(GEO_MASKABLE), "icons/icon-maskable-512.png", 512);
  png(svgIcone(GEO_FAVICON), "favicon.png", 48);
  png(svgIcone(GEO_FAVICON), "apple-touch-icon.png", 180);

  console.log("Pronto.");
}

// Só gera quando chamado direto; `import` deste módulo não tem efeito nenhum.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  gerarIcones();
}
