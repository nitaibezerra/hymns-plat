/**
 * Comparador de imagens pixel-a-pixel pra suíte de paridade visual.
 *
 * Existe porque `expect(shot).toMatchSnapshot()` é snapshot-file-based por
 * construção: a baseline vem do disco, então não dá pra usá-lo pra comparar
 * duas capturas feitas ao vivo na mesma corrida. Foi exatamente esse
 * mal-entendido que fez a suíte do Sub-marco 4.I comparar SvelteKit consigo
 * mesmo e reportar 0% de diff pra sempre.
 *
 * Aqui a comparação é direta: dois buffers PNG entram, um número sai.
 *
 * **Tolerâncias embutidas** (ver `_plan/marco4-diff-notes.md`):
 *
 * - `includeAA: false` (default do pixelmatch) faz a detecção de
 *   anti-aliasing ficar ATIVA — pixels identificados como borda
 *   anti-aliasada não entram na contagem. Cobre a diferença legítima entre
 *   o Tailwind Play CDN (Django) e o build do Tailwind 4 (SvelteKit), e o
 *   sub-pixel de fonte self-hosted vs Google Fonts.
 * - `pixelThreshold` (distância de cor por pixel, 0–1) sobe um pouco acima
 *   do default do pixelmatch pelo mesmo motivo.
 *
 * Dimensões diferentes NÃO são erro: a comparação roda na área sobreposta e
 * a área que só existe numa das capturas conta inteira como divergência —
 * assim "a página do SvelteKit é mais curta" aparece no número em vez de
 * explodir o teste.
 */

import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

/** Distância de cor por pixel tolerada (0–1); acima disso conta como diff. */
export const DEFAULT_PIXEL_THRESHOLD = 0.15;

export type ImageDiffOptions = {
  /** Distância de cor por pixel tolerada (0–1). */
  pixelThreshold?: number;
  /** `true` desliga a tolerância a anti-aliasing (usado só em teste). */
  includeAA?: boolean;
};

export type ImageDiffResult = {
  /** Pixels divergentes (inclui a área não sobreposta). */
  diffPixels: number;
  /** Pixels do bounding box das duas imagens. */
  totalPixels: number;
  /** `diffPixels / totalPixels` — 0 = idênticas, 1 = tudo diferente. */
  ratio: number;
  /** Largura do bounding box. */
  width: number;
  /** Altura do bounding box. */
  height: number;
  /** PNG do bounding box com as divergências pintadas. */
  diffPng: Buffer;
};

export function diffPngBuffers(
  a: Buffer,
  b: Buffer,
  options: ImageDiffOptions = {},
): ImageDiffResult {
  const imgA = PNG.sync.read(a);
  const imgB = PNG.sync.read(b);

  const width = Math.max(imgA.width, imgB.width);
  const height = Math.max(imgA.height, imgB.height);
  const overlapWidth = Math.min(imgA.width, imgB.width);
  const overlapHeight = Math.min(imgA.height, imgB.height);

  const cropA = cropToRgba(imgA, overlapWidth, overlapHeight);
  const cropB = cropToRgba(imgB, overlapWidth, overlapHeight);
  const overlapDiff = new Uint8Array(overlapWidth * overlapHeight * 4);

  const overlapDiffPixels =
    overlapWidth > 0 && overlapHeight > 0
      ? pixelmatch(cropA, cropB, overlapDiff, overlapWidth, overlapHeight, {
          threshold: options.pixelThreshold ?? DEFAULT_PIXEL_THRESHOLD,
          includeAA: options.includeAA ?? false,
          diffColor: [255, 0, 128],
          alpha: 0.2,
        })
      : 0;

  const outsideOverlap = width * height - overlapWidth * overlapHeight;
  const diffPixels = overlapDiffPixels + outsideOverlap;
  const totalPixels = width * height;

  return {
    diffPixels,
    totalPixels,
    ratio: totalPixels === 0 ? 0 : diffPixels / totalPixels,
    width,
    height,
    diffPng: renderDiffPng(width, height, overlapWidth, overlapHeight, overlapDiff),
  };
}

/** Formata o ratio como percentual legível em PT-BR (ex.: `4,73%`). */
export function formatRatio(ratio: number): string {
  return `${(ratio * 100).toFixed(2).replace(".", ",")}%`;
}

/** Recorta a região `width`×`height` do canto superior esquerdo, em RGBA. */
function cropToRgba(img: PNG, width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const srcStart = y * img.width * 4;
    const src = img.data.subarray(srcStart, srcStart + width * 4);
    out.set(src, y * width * 4);
  }
  return out;
}

/**
 * Monta o PNG de inspeção: a área sobreposta recebe o diff do pixelmatch; a
 * área que só existe numa das capturas fica em magenta chapado, deixando
 * óbvio que houve diferença de altura/largura.
 */
function renderDiffPng(
  width: number,
  height: number,
  overlapWidth: number,
  overlapHeight: number,
  overlapDiff: Uint8Array,
): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dst = (width * y + x) << 2;
      if (x < overlapWidth && y < overlapHeight) {
        const src = (overlapWidth * y + x) << 2;
        png.data[dst] = overlapDiff[src];
        png.data[dst + 1] = overlapDiff[src + 1];
        png.data[dst + 2] = overlapDiff[src + 2];
        png.data[dst + 3] = overlapDiff[src + 3];
      } else {
        png.data[dst] = 255;
        png.data[dst + 1] = 0;
        png.data[dst + 2] = 128;
        png.data[dst + 3] = 255;
      }
    }
  }
  return PNG.sync.write(png);
}
