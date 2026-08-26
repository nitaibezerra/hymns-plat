/**
 * Sub-marco 5.F — Ciclo 5F.14.
 *
 * Load function da tela 3b (`/contribuir/conferir/?task=<uuid>`), porta de
 * `apps/users/views.py::upload_preview_view`. A rota mudou de nome de
 * propósito (`preview/` → `conferir/`), acompanhando o rótulo CONFERIR do
 * stepper.
 *
 * Tudo o que o Django lia de `request.session["upload_data"]` sai de
 * `ocrTask.resultData` — nenhum estado do wizard depende de sessão.
 */

import { PREVIEW_HYMN_LIMIT } from "$lib/components/contribuir/ocr-result";
import { error, redirect } from "@sveltejs/kit";

import { isAuthError, isTransportError, loginRedirectTarget } from "../auth-guard";
import { fetchOcrTask, parseOcrResultData } from "../ocr-task";

import type { OcrHymn } from "$lib/components/contribuir/ocr-result";
import type { PageLoad } from "./$types";

export interface ConferirData {
  taskId: string;
  name: string;
  owner: string;
  totalHymns: number;
  previewHymns: OcrHymn[];
  error: string | null;
}

export async function _loadConferir(event: {
  fetch: typeof globalThis.fetch;
  url: URL;
}): Promise<ConferirData> {
  const taskId = event.url.searchParams.get("task");
  if (!taskId) throw redirect(302, "/contribuir/");

  const result = await fetchOcrTask(event.fetch, taskId);

  if (result.kind === "error") {
    if (!isTransportError(result.message) && isAuthError(result.message)) {
      throw redirect(302, loginRedirectTarget("/contribuir/conferir/"));
    }
    return {
      taskId,
      name: "",
      owner: "",
      totalHymns: 0,
      previewHymns: [],
      error: result.message,
    };
  }

  if (result.kind === "missing") {
    throw error(404, "Tarefa de OCR não encontrada.");
  }

  const book = parseOcrResultData(result.task.resultData);
  // Sem resultado ainda não há o que conferir — devolve pro passo 2, que sabe
  // esperar (o `resultData` é nulável enquanto o OCR roda).
  if (!book) {
    throw redirect(302, `/contribuir/processando/?task=${taskId}`);
  }

  return {
    taskId,
    name: book.name,
    owner: book.owner,
    totalHymns: book.hymns.length,
    previewHymns: book.hymns.slice(0, PREVIEW_HYMN_LIMIT),
    error: null,
  };
}

export const load: PageLoad = (event) => _loadConferir(event);
