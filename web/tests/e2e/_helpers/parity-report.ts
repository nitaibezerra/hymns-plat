/**
 * Assertiva de paridade visual: compara as duas capturas, grava os artefatos
 * de inspeção e falha com o percentual medido na mensagem.
 *
 * O ponto central é que o número medido aparece SEMPRE — passando ou
 * falhando. Uma suíte de paridade que só diz "verde" não prova paridade
 * nenhuma (foi o que aconteceu no Sub-marco 4.I); o que prova é o ratio.
 *
 * Artefatos vão pra `test-results/visual-parity/` — diretório já coberto pelo
 * `web/.gitignore`, portanto nada disso entra no repo.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { type ImageDiffResult, diffPngBuffers, formatRatio } from "./image-diff";

/** Threshold de paridade por rota: 5% dos pixels. */
export const DEFAULT_MAX_DIFF_RATIO = 0.05;

/** Onde ficam as capturas e os PNGs de diff. */
export const DEFAULT_OUTPUT_DIR = "test-results/visual-parity";

export type ParityAssertion = {
  /** Identificador da rota (vira nome de arquivo). */
  id: string;
  /** Captura do monolito Django — a referência. */
  djangoShot: Buffer;
  /** Captura do shell SvelteKit — o candidato. */
  svelteShot: Buffer;
  /** Override do threshold pra rotas com diferença aceita e documentada. */
  maxDiffPixelRatio?: number;
  /** Override do diretório de artefatos (usado nos testes do helper). */
  outputDir?: string;
  /**
   * Chamado com o resultado medido SEMPRE — passando ou reprovando. É o que
   * garante que o percentual apareça no output mesmo quando o teste falha.
   */
  report?: (outcome: ParityOutcome) => void;
};

export type ParityOutcome = ImageDiffResult & {
  id: string;
  maxDiffPixelRatio: number;
  withinThreshold: boolean;
  artifacts: { django: string; svelte: string; diff: string };
};

/**
 * Mede a paridade e lança se passar do threshold.
 *
 * @returns o resultado medido quando está dentro do threshold.
 */
export function assertVisualParity(assertion: ParityAssertion): ParityOutcome {
  const maxDiffPixelRatio = assertion.maxDiffPixelRatio ?? DEFAULT_MAX_DIFF_RATIO;
  const outputDir = assertion.outputDir ?? DEFAULT_OUTPUT_DIR;
  const diff = diffPngBuffers(assertion.djangoShot, assertion.svelteShot);

  mkdirSync(outputDir, { recursive: true });
  const artifacts = {
    django: join(outputDir, `${assertion.id}-django.png`),
    svelte: join(outputDir, `${assertion.id}-svelte.png`),
    diff: join(outputDir, `${assertion.id}-diff.png`),
  };
  writeFileSync(artifacts.django, assertion.djangoShot);
  writeFileSync(artifacts.svelte, assertion.svelteShot);
  writeFileSync(artifacts.diff, diff.diffPng);

  const outcome: ParityOutcome = {
    ...diff,
    id: assertion.id,
    maxDiffPixelRatio,
    withinThreshold: diff.ratio <= maxDiffPixelRatio,
    artifacts,
  };

  assertion.report?.(outcome);

  if (!outcome.withinThreshold) {
    throw new Error(describeFailure(outcome));
  }
  return outcome;
}

/** Linha de uma linha por rota, pro output do runner. */
export function formatParityLine(outcome: ParityOutcome): string {
  const veredito = outcome.withinThreshold ? "OK" : "ACIMA DO THRESHOLD";
  return (
    `[paridade] ${outcome.id}: diff ${formatRatio(outcome.ratio)} ` +
    `(${outcome.diffPixels}/${outcome.totalPixels} px, ` +
    `${outcome.width}×${outcome.height}) ` +
    `— limite ${formatRatio(outcome.maxDiffPixelRatio)} — ${veredito}`
  );
}

function describeFailure(outcome: ParityOutcome): string {
  return [
    `Paridade visual reprovada na rota "${outcome.id}".`,
    `  Diff medido:  ${formatRatio(outcome.ratio)} ` +
      `(${outcome.diffPixels} de ${outcome.totalPixels} pixels)`,
    `  Threshold:    ${formatRatio(outcome.maxDiffPixelRatio)}`,
    `  Bounding box: ${outcome.width}×${outcome.height}`,
    `  Django:       ${outcome.artifacts.django}`,
    `  SvelteKit:    ${outcome.artifacts.svelte}`,
    `  Diff:         ${outcome.artifacts.diff}`,
  ].join("\n");
}
