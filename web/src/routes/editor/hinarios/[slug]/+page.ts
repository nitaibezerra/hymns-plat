/**
 * Marco 5.B — Ciclo 5B.8.
 *
 * Load do detalhe do hinário na visão do editor.
 *
 * Usa a query pública `hymnbook(slug:)` de propósito: ela filtra por
 * `visible_to(user)`, então o editor vê o próprio rascunho não publicado
 * sem precisar de uma query paralela só pro workspace.
 *
 * Três desfechos de falha, deliberadamente distintos — confundi-los faria o
 * editor caçar o problema no lugar errado:
 *   - sem permissão  → 302 pro login preservando o destino;
 *   - slug inexistente (ou invisível pra este usuário) → 404;
 *   - backend com problema técnico → 503, não 404.
 */

import { GRAPHQL_URL } from "$lib/config";
import { gqlFetch } from "$lib/graphql/fetcher";
import { EDITOR_HYMNBOOK_DETAIL_QUERY } from "$lib/graphql/operations/editor-dashboard";
import { error, redirect } from "@sveltejs/kit";

import { editorLoginRedirect, isEditorAccessError } from "../../+layout";

import type { PageLoad } from "./$types";
import type { EditorHymnbookStats, EditorReviewProgress } from "../../+page";

export interface EditorHymnRow {
  id: string;
  number: number;
  title: string;
  reviewStatus: string;
}

export interface EditorNextPendingHymn {
  id: string;
  number: number;
  title: string;
}

export interface EditorHymnbookDetail {
  id: string;
  name: string;
  slug: string;
  ownerName: string;
  priority: string;
  isPublished: boolean;
  reviewProgress: EditorReviewProgress;
  stats: EditorHymnbookStats;
  nextPendingHymn: EditorNextPendingHymn | null;
  hymns: EditorHymnRow[];
}

export interface EditorHymnbookDetailData {
  hymnbook: EditorHymnbookDetail;
  error: string | null;
}

export async function _loadEditorHymnbookDetail(event: {
  fetch: typeof globalThis.fetch;
  params: { slug: string };
}): Promise<EditorHymnbookDetailData> {
  const { slug } = event.params;

  const response = await gqlFetch<{ hymnbook: EditorHymnbookDetail | null }>(
    event.fetch,
    GRAPHQL_URL,
    EDITOR_HYMNBOOK_DETAIL_QUERY,
    { slug },
  );

  const errorMessage = response.errors?.[0]?.message;
  if (errorMessage) {
    if (!errorMessage.startsWith("HTTP ") && isEditorAccessError(errorMessage)) {
      throw redirect(302, editorLoginRedirect(`/editor/hinarios/${slug}/`));
    }
    throw error(503, "Não foi possível carregar o hinário agora. Tente novamente em instantes.");
  }

  const hymnbook = response.data?.hymnbook ?? null;
  if (!hymnbook) {
    throw error(404, "Hinário não encontrado.");
  }

  return { hymnbook, error: null };
}

export const load: PageLoad = (event) => _loadEditorHymnbookDetail(event);
