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
import { parseOcrResultData } from "$lib/components/contribuir/ocr-result";

import type { OcrFetchResult, OcrTaskSnapshot } from "$lib/ocr-polling";
import type { OcrHymn, OcrHymnBook } from "$lib/components/contribuir/ocr-result";

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

export { parseOcrResultData };
export type { OcrFetchResult, OcrTaskSnapshot, OcrHymn, OcrHymnBook };
