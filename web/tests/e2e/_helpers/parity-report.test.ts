/**
 * Testes de sanidade da assertiva de paridade: ela precisa (a) falhar quando o
 * diff passa do threshold, (b) dizer o percentual medido em texto legível e
 * (c) gravar os artefatos de inspeção em `test-results/` — que o
 * `web/.gitignore` já cobre, então nada disso é commitado.
 *
 * Rodam sem servidor nenhum.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { formatRatio } from "./image-diff";
import { DEFAULT_MAX_DIFF_RATIO, assertVisualParity } from "./parity-report";
import { BLACK, WHITE, solidPng, splitPng } from "./png-fixtures";

function scratchDir(): string {
  return mkdtempSync(join(tmpdir(), "hinaria-parity-"));
}

test.describe("assertiva de paridade (parity-report)", () => {
  test("threshold default é 5%", () => {
    expect(DEFAULT_MAX_DIFF_RATIO).toBe(0.05);
  });

  test("formata o ratio como percentual PT-BR", () => {
    expect(formatRatio(0)).toBe("0,00%");
    expect(formatRatio(0.0473)).toBe("4,73%");
    expect(formatRatio(1)).toBe("100,00%");
  });

  test("passa e devolve o ratio medido quando o diff está dentro do threshold", () => {
    // 2 colunas de 100 divergentes = 2% < 5%.
    const django = solidPng(100, 100, WHITE);
    const svelte = splitPng(100, 100, 98, WHITE, BLACK);

    const outcome = assertVisualParity({
      id: "dentro-do-threshold",
      djangoShot: django,
      svelteShot: svelte,
      outputDir: scratchDir(),
    });

    expect(outcome.withinThreshold).toBe(true);
    expect(outcome.ratio).toBeGreaterThan(0);
    expect(outcome.ratio).toBeLessThan(DEFAULT_MAX_DIFF_RATIO);
    expect(outcome.maxDiffPixelRatio).toBe(DEFAULT_MAX_DIFF_RATIO);
  });

  test("falha com o percentual medido na mensagem quando passa do threshold", () => {
    const django = solidPng(100, 100, WHITE);
    const svelte = solidPng(100, 100, BLACK);

    let raised: Error | undefined;
    try {
      assertVisualParity({
        id: "acima-do-threshold",
        djangoShot: django,
        svelteShot: svelte,
        outputDir: scratchDir(),
      });
    } catch (error) {
      raised = error as Error;
    }

    expect(raised, "esperava falha por diff acima do threshold").toBeDefined();
    expect(raised?.message).toContain("acima-do-threshold");
    expect(raised?.message).toContain("100,00%");
    expect(raised?.message).toContain("5,00%");
  });

  test("respeita override de threshold por rota", () => {
    const django = solidPng(100, 100, WHITE);
    const svelte = solidPng(100, 100, BLACK);

    const outcome = assertVisualParity({
      id: "override",
      djangoShot: django,
      svelteShot: svelte,
      maxDiffPixelRatio: 1,
      outputDir: scratchDir(),
    });

    expect(outcome.withinThreshold).toBe(true);
    expect(outcome.maxDiffPixelRatio).toBe(1);
  });

  test("grava as duas capturas e o diff pra inspeção", () => {
    const dir = scratchDir();
    const outcome = assertVisualParity({
      id: "artefatos",
      djangoShot: solidPng(40, 40, WHITE),
      svelteShot: splitPng(40, 40, 39, WHITE, BLACK),
      outputDir: dir,
    });

    for (const path of Object.values(outcome.artifacts)) {
      expect(path.startsWith(dir), `artefato fora de ${dir}: ${path}`).toBe(true);
      expect(readFileSync(path).subarray(1, 4).toString("ascii")).toBe("PNG");
    }
  });
});
