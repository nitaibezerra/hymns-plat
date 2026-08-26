/**
 * Sub-marco 5.F — Ciclo 5F.16.
 *
 * Load function da tela 4 (`/contribuir/confirmar/`), porta de
 * `apps/users/views.py::upload_confirm_view` — o ramo "adicionar como nova
 * versão".
 *
 * O `request.session["version_info"]` do Django virou query string:
 * `?task=<uuid>&hinario=<slug>&versao=<nome>`. Faltando hinário ou nome, o
 * passo não tem sentido: voltamos pra desambiguação, que é quem produz esses
 * dois valores (o Django devolvia pro início porque a sessão era tudo ou nada).
 */

import { CONTRIBUIR_TARGET_HYMNBOOK_QUERY } from "$lib/graphql/operations/contribuir";
import { GRAPHQL_URL } from "$lib/config";
import { gqlFetch } from "$lib/graphql/fetcher";
import { error, redirect } from "@sveltejs/kit";

import { isAuthError, isTransportError, loginRedirectTarget } from "../auth-guard";
import { fetchOcrTask, parseOcrResultData } from "../ocr-task";

import type { PageLoad } from "./$types";

export interface ConfirmarTarget {
  name: string;
  slug: string;
  ownerName: string;
  hymnsTotal: number;
}

export interface ConfirmarData {
  taskId: string;
  versionName: string;
  target: ConfirmarTarget | null;
  pdfFilename: string;
  totalHymns: number;
  error: string | null;
}

interface RawTarget {
  id: string;
  name: string;
  slug: string;
  ownerName: string;
  stats?: { hymnsTotal?: number } | null;
}

export async function _loadConfirmar(event: {
  fetch: typeof globalThis.fetch;
  url: URL;
}): Promise<ConfirmarData> {
  const taskId = event.url.searchParams.get("task");
  if (!taskId) throw redirect(302, "/contribuir/");

  const hymnbookSlug = event.url.searchParams.get("hinario");
  const versionName = event.url.searchParams.get("versao");
  if (!hymnbookSlug || !versionName) {
    throw redirect(302, `/contribuir/desambiguar/?task=${taskId}`);
  }

  const taskResult = await fetchOcrTask(event.fetch, taskId);

  if (taskResult.kind === "error") {
    if (!isTransportError(taskResult.message) && isAuthError(taskResult.message)) {
      throw redirect(302, loginRedirectTarget("/contribuir/confirmar/"));
    }
    return {
      taskId,
      versionName,
      target: null,
      pdfFilename: "",
      totalHymns: 0,
      error: taskResult.message,
    };
  }

  if (taskResult.kind === "missing") {
    throw error(404, "Tarefa de OCR não encontrada.");
  }

  const book = parseOcrResultData(taskResult.task.resultData);

  const targetResponse = await gqlFetch<{ hymnbook: RawTarget | null }>(
    event.fetch,
    GRAPHQL_URL,
    CONTRIBUIR_TARGET_HYMNBOOK_QUERY,
    { slug: hymnbookSlug },
  );

  const targetError = targetResponse.errors?.[0]?.message ?? null;
  if (targetError) {
    if (!isTransportError(targetError) && isAuthError(targetError)) {
      throw redirect(302, loginRedirectTarget("/contribuir/confirmar/"));
    }
    return {
      taskId,
      versionName,
      target: null,
      pdfFilename: taskResult.task.pdfFilename,
      totalHymns: book?.hymns.length ?? 0,
      error: targetError,
    };
  }

  const raw = targetResponse.data?.hymnbook;
  if (!raw) throw error(404, "Hinário de destino não encontrado.");

  return {
    taskId,
    versionName,
    target: {
      name: raw.name,
      slug: raw.slug,
      ownerName: raw.ownerName,
      hymnsTotal: raw.stats?.hymnsTotal ?? 0,
    },
    pdfFilename: taskResult.task.pdfFilename,
    totalHymns: book?.hymns.length ?? 0,
    error: null,
  };
}

export const load: PageLoad = (event) => _loadConfirmar(event);
