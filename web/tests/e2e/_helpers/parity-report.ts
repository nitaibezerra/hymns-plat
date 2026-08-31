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

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { type ImageDiffResult, diffPngBuffers, formatRatio } from "./image-diff";

/** Threshold de paridade por rota: 5% dos pixels. */
export const DEFAULT_MAX_DIFF_RATIO = 0.05;

/** Onde ficam as capturas e os PNGs de diff. */
export const DEFAULT_OUTPUT_DIR = "test-results/visual-parity";

/** Subdiretório com um JSON por rota medida (ver `recordMeasurement`). */
export const MEASUREMENTS_DIR = "medicoes";

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

// --------------------------------------------------------------------------- //
// Placar acumulado, em disco
// --------------------------------------------------------------------------- //
//
// Por que em disco e não num array de módulo: **o Playwright reinicia o worker
// depois de cada teste que falha**, pra garantir estado limpo. Com isso um
// array de módulo perde tudo que foi medido antes da primeira falha, e o
// `afterAll` imprime um placar parcial — foi exatamente o que aconteceu na
// primeira corrida real desta suíte ("7 de 8 rotas" numa tabela de 11). Numa
// suíte cujo PRODUTO é o placar, isso não é detalhe.
//
// Um arquivo por rota, sobrescrito a cada corrida; a primeira rota da tabela
// limpa o diretório antes de medir. Como a primeira rota roda uma única vez
// por corrida (falhe ela ou não), a limpeza acontece uma vez só.

/** Uma linha do placar: o que a tabela de `_plan/marco4-diff-notes.md` mostra. */
export type Measurement = {
  id: string;
  /** Fração de pixels divergentes (0–1). */
  ratio: number;
  /** Threshold aplicado (0–1). */
  maxDiffPixelRatio: number;
  withinThreshold: boolean;
  /** `min(tinta) / max(tinta)` entre as duas capturas — ver `contentBalance`. */
  contentBalance: number;
  /** Fração de pixels que não são fundo, por lado. */
  inkDjango: number;
  inkSvelte: number;
  /**
   * Diff por região (`header` / `corpo` / `rodape`), quando medido.
   *
   * `null` numa região significa "não apareceu na viewport" — o caso comum é o
   * rodapé, que fica abaixo dos 720px na maioria das rotas. Distinguir isso de
   * "0%" importa: reportar zero seria afirmar paridade de uma área que ninguém
   * olhou.
   */
  regioes?: Record<string, number | null>;
};

function measurementsDir(outputDir: string = DEFAULT_OUTPUT_DIR): string {
  return join(outputDir, MEASUREMENTS_DIR);
}

/** Apaga o placar da corrida anterior. Chamado pela PRIMEIRA rota da tabela. */
export function resetMeasurements(outputDir: string = DEFAULT_OUTPUT_DIR): void {
  rmSync(measurementsDir(outputDir), { recursive: true, force: true });
}

/** Grava (ou sobrescreve) a linha de uma rota. */
export function recordMeasurement(
  measurement: Measurement,
  outputDir: string = DEFAULT_OUTPUT_DIR,
): void {
  const dir = measurementsDir(outputDir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${measurement.id}.json`), JSON.stringify(measurement, null, 2));
}

/** Lê o placar da corrida atual, ordenado do maior diff pro menor. */
export function readMeasurements(outputDir: string = DEFAULT_OUTPUT_DIR): Measurement[] {
  const dir = measurementsDir(outputDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((nome) => nome.endsWith(".json"))
    .map((nome) => JSON.parse(readFileSync(join(dir, nome), "utf8")) as Measurement)
    .sort((a, b) => b.ratio - a.ratio);
}

