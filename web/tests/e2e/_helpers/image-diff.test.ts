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

import { contentBalance, diffPngBuffers, inkRatio } from "./image-diff";
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

  test("inkRatio mede quanto da imagem não é fundo", () => {
    expect(inkRatio(solidPng(100, 100, WHITE))).toBe(0);
    // 20 das 100 colunas em preto sobre fundo branco.
    expect(inkRatio(splitPng(100, 100, 80, WHITE, BLACK))).toBeCloseTo(0.2, 2);
  });

  test("contentBalance acusa quando um lado tem muito menos conteúdo", () => {
    const cheia = splitPng(100, 100, 50, BLACK, WHITE);
    const quaseVazia = splitPng(100, 100, 2, BLACK, WHITE);

    // Mesma quantidade de conteúdo nos dois lados: equilíbrio 1.
    expect(contentBalance(cheia, cheia)).toBeCloseTo(1, 2);
    // Um lado com 2% de tinta contra outro com 50%: equilíbrio baixo.
    expect(contentBalance(cheia, quaseVazia)).toBeLessThan(0.1);
    // Simétrico — a ordem dos argumentos não muda o veredito.
    expect(contentBalance(quaseVazia, cheia)).toBeCloseTo(
      contentBalance(cheia, quaseVazia),
      5,
    );
  });

  test("contentBalance vale 1 quando os dois lados estão vazios", () => {
    const vazia = solidPng(50, 50, WHITE);
    expect(contentBalance(vazia, vazia)).toBe(1);
  });
});
