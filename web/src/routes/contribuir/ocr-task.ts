/**
 * Sub-marco 5.F — Ciclos 5F.9 e 5F.14.
 *
 * Camada de acesso à `OCRTask`, compartilhada pelas telas do wizard.
 *
 * `Query.ocrTask(id)` já existe no schema (Marco 5.A) e o resolver gateia por
 * dono-da-task-ou-editor. Task inexistente e task de outro usuário **voltam
 * as duas como `null`** — não dá pra distinguir 404 de 403 daqui, então o
 * wizard trata como "não encontrada" com mensagem em PT-BR.
 *
 * `resultData` é `JSON` nulável e vem no formato produzido por
 * `apps/hymns/services/ocr.py::run_ocr`:
 *
 *     {"hymn_book": {"name", "owner", "intro_name", "hymns": [...]}}
 *
 * Os hinos vêm de `_hymn_to_dict`, que **remove** campos `None`/vazios — por
 * isso todo campo opcional é lido com fallback aqui.
 */

import { GRAPHQL_URL } from "$lib/config";
import { gqlFetch } from "$lib/graphql/fetcher";
import { OCR_TASK_QUERY } from "$lib/graphql/operations/contribuir";

import type { OcrFetchResult, OcrTaskSnapshot } from "$lib/ocr-polling";

export interface OcrHymn {
  number: number | null;
  title: string;
  text: string;
  ocrAvgConfidence: number | null;
}

export interface OcrHymnBook {
  name: string;
  owner: string;
  introName: string;
  hymns: OcrHymn[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

/**
 * Normaliza o `resultData` cru em algo tipado. Devolve `null` quando o
 * resultado ainda não existe (task `pending`/`processing`) ou quando não tem
 * a forma esperada — a tela decide o que fazer com o nulo.
 */
export function parseOcrResultData(raw: unknown): OcrHymnBook | null {
  const root = asRecord(raw);
  const book = root && asRecord(root.hymn_book);
  if (!book) return null;

  const rawHymns = Array.isArray(book.hymns) ? book.hymns : [];
  const hymns: OcrHymn[] = rawHymns.flatMap((entry) => {
    const hymn = asRecord(entry);
    if (!hymn) return [];
    return [
      {
        number: asNumberOrNull(hymn.number),
        title: asText(hymn.title),
        text: asText(hymn.text),
        ocrAvgConfidence: asNumberOrNull(hymn.ocr_avg_confidence),
      },
    ];
  });

  return {
    name: asText(book.name),
    owner: asText(book.owner),
    introName: asText(book.intro_name),
    hymns,
  };
}

export async function fetchOcrTask(
  fetchFn: typeof globalThis.fetch,
  taskId: string,
): Promise<OcrFetchResult> {
  let response;
  try {
    response = await gqlFetch<{ ocrTask: OcrTaskSnapshot | null }>(
      fetchFn,
      GRAPHQL_URL,
      OCR_TASK_QUERY,
      { id: taskId },
    );
  } catch {
    return { kind: "error", message: "Erro de rede ao consultar o progresso do OCR." };
  }

  const errorMessage = response.errors?.[0]?.message;
  if (errorMessage) return { kind: "error", message: errorMessage };

  const task = response.data?.ocrTask;
  if (!task) return { kind: "missing" };

  return { kind: "task", task };
}

export type { OcrFetchResult, OcrTaskSnapshot };
