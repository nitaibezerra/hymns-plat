/**
 * Sub-marco 5.F — Ciclo 5F.9.
 *
 * Load function da tela 2 (`/contribuir/processando/?task=<uuid>`), porta de
 * `apps/users/views.py::upload_processing_view`.
 *
 * A `task` id mora na URL — é o que faz o passo sobreviver a um reload sem
 * depender de `request.session` (o estado do wizard saiu da sessão Django e
 * virou estado de cliente).
 *
 * Diferença deliberada em relação ao Django: aqui a load function **não**
 * decide o próximo passo. Ela só entrega o snapshot inicial pro SSR já pintar
 * a barra; o ramo desambiguar/conferir é do polling no cliente (5F.11), pra
 * ter um único lugar decidindo.
 */

import { error, redirect } from "@sveltejs/kit";

import { isAuthError, isTransportError, loginRedirectTarget } from "../auth-guard";
import { fetchOcrTask } from "../ocr-task";

import type { OcrTaskSnapshot } from "$lib/ocr-polling";
import type { PageLoad } from "./$types";

export interface ProcessandoData {
  taskId: string;
  task: OcrTaskSnapshot | null;
  error: string | null;
}

export async function _loadProcessando(event: {
  fetch: typeof globalThis.fetch;
  url: URL;
}): Promise<ProcessandoData> {
  const taskId = event.url.searchParams.get("task");
  // Sem task não há o que processar — o Django faz `redirect("users:upload")`.
  if (!taskId) throw redirect(302, "/contribuir/");

  const result = await fetchOcrTask(event.fetch, taskId);

  if (result.kind === "error") {
    if (!isTransportError(result.message) && isAuthError(result.message)) {
      throw redirect(302, loginRedirectTarget("/contribuir/processando/"));
    }
    return { taskId, task: null, error: result.message };
  }

  if (result.kind === "missing") {
    throw error(404, "Tarefa de OCR não encontrada.");
  }

  return { taskId, task: result.task, error: null };
}

export const load: PageLoad = (event) => _loadProcessando(event);
