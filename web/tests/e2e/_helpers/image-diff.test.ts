/**
 * Testes de sanidade do comparador de imagens.
 *
 * Estes testes são o antídoto contra a regressão do Sub-marco 4.I: a suíte de
 * paridade parecia comparar Django com SvelteKit, mas comparava SvelteKit
 * consigo mesmo e reportava 0% de diff pra sempre. Aqui a gente prova, com
 * PNGs sintéticos de diff conhecido, que o comparador de fato mede.
 *
 * Rodam sem servidor nenhum (não dependem de Django nem de SvelteKit), logo
 * não têm `test.skip` por `HINARIA_E2E_PLAYWRIGHT_READY`.
 */

import { expect, test } from "@playwright/test";

import { diffPngBuffers } from "./image-diff";
import { BLACK, WHITE, solidPng, splitPng } from "./png-fixtures";

test.describe("comparador de imagens (image-diff)", () => {
  test("PNGs idênticos dão ratio 0", () => {
    const a = solidPng(20, 10, WHITE);
    const b = solidPng(20, 10, WHITE);

    const result = diffPngBuffers(a, b);

    expect(result.ratio).toBe(0);
    expect(result.diffPixels).toBe(0);
    expect(result.totalPixels).toBe(200);
    expect(result.width).toBe(20);
    expect(result.height).toBe(10);
  });

  test("PNGs opostos dão ratio 1 — o comparador não pode cegar", () => {
    const a = solidPng(20, 10, WHITE);
    const b = solidPng(20, 10, BLACK);

    const result = diffPngBuffers(a, b);

    expect(result.diffPixels).toBe(200);
    expect(result.ratio).toBe(1);
  });

  test("conta apenas os pixels divergentes (metade da imagem = 0,5)", () => {
    const a = solidPng(20, 10, WHITE);
    const b = splitPng(20, 10, 10, WHITE, BLACK);

    const result = diffPngBuffers(a, b);

    expect(result.diffPixels).toBe(100);
    expect(result.ratio).toBeCloseTo(0.5, 5);
  });

  test("emite um PNG de diff não vazio quando há divergência", () => {
    const a = solidPng(20, 10, WHITE);
    const b = solidPng(20, 10, BLACK);

    const result = diffPngBuffers(a, b);

    expect(result.diffPng.byteLength).toBeGreaterThan(0);
    expect(result.diffPng.subarray(1, 4).toString("ascii")).toBe("PNG");
  });

  test("dimensões diferentes contam a área não sobreposta como divergente", () => {
    const a = solidPng(20, 10, WHITE);
    const b = solidPng(20, 20, WHITE);

    const result = diffPngBuffers(a, b);

    // Bounding box 20×20 = 400 pixels; as 10 linhas que só existem em `b`
    // (200 pixels) contam como divergência.
    expect(result.width).toBe(20);
    expect(result.height).toBe(20);
    expect(result.totalPixels).toBe(400);
    expect(result.diffPixels).toBe(200);
    expect(result.ratio).toBeCloseTo(0.5, 5);
  });
});
