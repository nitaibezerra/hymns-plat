/**
 * Sub-marco 5.F — Ciclo 5F.8.
 *
 * O upload multipart do PDF **não** migra pra GraphQL (decisão fixa do
 * Marco 5, "Endpoints REST mantidos"). A SPA faz `fetch` com `FormData`
 * contra o POST de `/contribuir/` — `apps/users/views.py::upload_view`,
 * que valida com `HymnBookPdfUploadForm`, grava o PDF num tempfile, cria a
 * `OCRTask` e responde com redirect pra `processando/?task=<uuid>`.
 *
 * Como a view responde com redirect (não com JSON), o `taskId` é lido do
 * `?task=` da URL final — o browser segue o 302 e expõe `response.url`
 * mesmo em resposta CORS. Se um dia a view passar a devolver JSON, o
 * fallback abaixo já cobre `{"task": ...}` / `{"task_id": ...}`.
 */

import { GRAPHQL_URL } from "$lib/config";
import { getCsrfTokenFromCookie } from "$lib/graphql/client";

import type { UploadPayload } from "$lib/components/contribuir/ContribuirForm.svelte";

export type UploadPdfResult = { ok: true; taskId: string } | { ok: false; message: string };

/**
 * Endpoint REST de upload, no mesmo host do GraphQL — Django serve as duas
 * coisas (`config/urls.py` inclui `apps.api.urls` e `apps.users.urls` na
 * raiz), então basta trocar o path.
 */
export function contribuirUploadUrl(): string {
  return new URL("/contribuir/", GRAPHQL_URL).toString();
}

export function extractTaskId(url: string): string | null {
  try {
    return new URL(url).searchParams.get("task");
  } catch {
    return null;
  }
}

function buildFormData(payload: UploadPayload): FormData {
  // Nomes idênticos aos campos de `HymnBookPdfUploadForm`.
  const body = new FormData();
  body.set("name", payload.name);
  body.set("owner_name", payload.ownerName);
  body.set("pdf_file", payload.pdfFile);
  if (payload.coverImage) body.set("cover_image", payload.coverImage);
  return body;
}

async function taskIdFromJsonBody(response: Response): Promise<string | null> {
  try {
    const clone = response.clone();
    const data = (await clone.json()) as Record<string, unknown> | null;
    if (!data) return null;
    for (const key of ["task", "task_id", "taskId", "id"]) {
      const value = data[key];
      if (typeof value === "string" && value) return value;
    }
    return null;
  } catch {
    return null;
  }
}

export async function uploadPdfForOcr(
  fetchFn: typeof globalThis.fetch,
  payload: UploadPayload,
): Promise<UploadPdfResult> {
  const csrfToken = getCsrfTokenFromCookie();
  // Nada de `Content-Type` manual: o browser precisa gerar o boundary do
  // multipart. Definir na mão quebra o parser do Django.
  const headers: Record<string, string> = {};
  if (csrfToken) headers["X-CSRFToken"] = csrfToken;

  let response: Response;
  try {
    response = await fetchFn(contribuirUploadUrl(), {
      method: "POST",
      credentials: "include",
      headers,
      body: buildFormData(payload),
    });
  } catch {
    return { ok: false, message: "Erro de rede ao enviar o PDF. Verifique sua conexão e tente novamente." };
  }

  if (!response.ok) {
    return {
      ok: false,
      message: `Não foi possível enviar o PDF (HTTP ${response.status}). Tente novamente em alguns instantes.`,
    };
  }

  const taskId = extractTaskId(response.url) ?? (await taskIdFromJsonBody(response));
  if (!taskId) {
    return {
      ok: false,
      message: "O servidor recusou o envio. Verifique o nome, o dono e o arquivo PDF e tente novamente.",
    };
  }

  return { ok: true, taskId };
}
