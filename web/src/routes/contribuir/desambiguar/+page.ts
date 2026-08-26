/**
 * Sub-marco 5.F — Ciclo 5F.12.
 *
 * Load function da tela 3a (`/contribuir/desambiguar/?task=<uuid>`), porta de
 * `apps/users/views.py::upload_disambiguate_view`.
 *
 * O Django lia `upload_data` e `duplicates` da sessão e devolvia pra
 * `users:upload` quando faltava qualquer um dos dois. Aqui o estado está na
 * URL: o nome e a contagem de hinos saem de `ocrTask.resultData`, e as
 * duplicatas de `Query.ocrDuplicates`. Consequência boa: quando não há
 * duplicata dá pra **avançar** pra conferência em vez de recomeçar o envio.
 */

import { error, redirect } from "@sveltejs/kit";

import { isAuthError, isTransportError, loginRedirectTarget } from "../auth-guard";
import { fetchOcrDuplicates } from "../ocr-duplicates";
import { fetchOcrTask, parseOcrResultData } from "../ocr-task";

import type { OcrDuplicates } from "../ocr-duplicates";
import type { PageLoad } from "./$types";

export interface DesambiguarData {
  taskId: string;
  uploadName: string;
  hymnsCount: number;
  duplicates: OcrDuplicates;
  error: string | null;
}

export async function _loadDesambiguar(event: {
  fetch: typeof globalThis.fetch;
  url: URL;
}): Promise<DesambiguarData> {
  const taskId = event.url.searchParams.get("task");
  if (!taskId) throw redirect(302, "/contribuir/");

  const taskResult = await fetchOcrTask(event.fetch, taskId);

  if (taskResult.kind === "error") {
    if (!isTransportError(taskResult.message) && isAuthError(taskResult.message)) {
      throw redirect(302, loginRedirectTarget("/contribuir/desambiguar/"));
    }
    return {
      taskId,
      uploadName: "",
      hymnsCount: 0,
      duplicates: { exactMatch: null, similar: [], hasDuplicates: false, unavailable: true },
      error: taskResult.message,
    };
  }

  if (taskResult.kind === "missing") {
    throw error(404, "Tarefa de OCR não encontrada.");
  }

  const book = parseOcrResultData(taskResult.task.resultData);
  const duplicates = await fetchOcrDuplicates(event.fetch, taskId);

  // Nada pra desambiguar (ou o backend ainda não sabe responder): avança.
  if (!duplicates.hasDuplicates) {
    throw redirect(302, `/contribuir/conferir/?task=${taskId}`);
  }

  return {
    taskId,
    uploadName: book?.name ?? "",
    hymnsCount: book?.hymns.length ?? 0,
    duplicates,
    error: null,
  };
}

export const load: PageLoad = (event) => _loadDesambiguar(event);
