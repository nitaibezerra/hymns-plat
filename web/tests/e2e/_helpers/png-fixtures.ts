/**
 * Geradores de PNG sintético — usados só pelos testes de sanidade do
 * comparador (`image-diff.test.ts`). Não dependem de servidor nenhum, então
 * rodam mesmo com Django/SvelteKit fora do ar.
 */

import { PNG } from "pngjs";

export type Rgba = [number, number, number, number];

export const BLACK: Rgba = [0, 0, 0, 255];
export const WHITE: Rgba = [255, 255, 255, 255];

/** PNG de cor sólida `width`×`height`. */
export function solidPng(width: number, height: number, color: Rgba): Buffer {
  return buildPng(width, height, () => color);
}

/**
 * PNG dividido verticalmente: as primeiras `leftColumns` colunas em `left`,
 * o resto em `right`. Serve pra produzir um ratio de diff conhecido.
 */
export function splitPng(
  width: number,
  height: number,
  leftColumns: number,
  left: Rgba,
  right: Rgba,
): Buffer {
  return buildPng(width, height, (x) => (x < leftColumns ? left : right));
}

function buildPng(
  width: number,
  height: number,
  colorAt: (x: number, y: number) => Rgba,
): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (width * y + x) << 2;
      const [r, g, b, a] = colorAt(x, y);
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }
  return PNG.sync.write(png);
}
