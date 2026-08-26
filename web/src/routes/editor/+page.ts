/**
 * Marco 5.B — Ciclo 5B.2.
 *
 * Load do dashboard editorial (`/editor/`). Um POST traz as stats agregadas
 * e a fila de hinários — a tela não tem estado útil pela metade.
 *
 * Sobre erro: `editorDashboardStats` e `editorHymnbooks` LEVANTAM erro pra
 * quem não é editor desde o 5.A½ (antes vazavam dados). O guard do
 * `+layout.ts` já barra o não-editor antes daqui, então um erro de permissão
 * nesta altura significa sessão que morreu no meio do caminho: refazemos o
 * mesmo redirect, reusando `isEditorAccessError` do layout em vez de
 * reescrever a classificação. Erro técnico (5xx, rede) é outra história —
 * vira `data.error` e a página mostra um aviso, sem expulsar o editor.
 */

import { GRAPHQL_URL } from "$lib/config";
import { parseSort, toSortInputs, type SortPair } from "$lib/editor-sort";
import { gqlFetch } from "$lib/graphql/fetcher";
import { EDITOR_DASHBOARD_QUERY } from "$lib/graphql/operations/editor-dashboard";
import { redirect } from "@sveltejs/kit";

import { editorLoginRedirect, isEditorAccessError } from "./+layout";

import type { PageLoad } from "./$types";

export interface EditorReviewProgress {
  reviewPct: number;
  stylePct: number;
  repsPct: number;
  audioPct: number;
}

export interface EditorHymnbookStats {
  hymnsTotal: number;
  hymnsReviewed: number;
  audiosApproved: number;
}

export interface EditorHymnbook {
  id: string;
  name: string;
  slug: string;
  priority: string;
  isFeatured: boolean;
  isPublished: boolean;
  ownerName: string;
  createdAt: string;
  reviewProgress: EditorReviewProgress;
  stats: EditorHymnbookStats;
}

export interface EditorResumeHymn {
  id: string;
  number: number;
  title: string;
  hymnBook: { name: string; slug: string };
}

export interface EditorDashboardStats {
  totalHinarios: number;
  pendingHymns: number;
  recentReviewed7d: number;
  p1Count: number;
  pendingAudiosCount: number;
  resumeHymn: EditorResumeHymn | null;
}

export interface EditorDashboardData {
  stats: EditorDashboardStats;
  hymnbooks: EditorHymnbook[];
  /** Pares `[métrica, direção]` já parseados da URL — a ORDEM é a prioridade. */
  sort: SortPair[];
  priority: string;
  error: string | null;
}

/** Stats neutras pra quando o backend falha — a tela renderiza zerada. */
const EMPTY_STATS: EditorDashboardStats = {
  totalHinarios: 0,
  pendingHymns: 0,
  recentReviewed7d: 0,
  p1Count: 0,
  pendingAudiosCount: 0,
  resumeHymn: null,
};

export async function _loadEditorDashboard(event: {
  fetch: typeof globalThis.fetch;
  url: URL;
}): Promise<EditorDashboardData> {
  const priority = "all";
  // A URL é a fonte da verdade do sort: `parseSort` é defensiva e devolve
  // [] pra querystring editada à mão, então a tela cai nos defaults em vez
  // de estourar (mesmo contrato da view Django).
  const sort = parseSort(event.url.searchParams.get("sort"));

  const response = await gqlFetch<{
    editorDashboardStats: EditorDashboardStats | null;
    editorHymnbooks: EditorHymnbook[] | null;
  }>(event.fetch, GRAPHQL_URL, EDITOR_DASHBOARD_QUERY, {
    sort: toSortInputs(sort),
    priority,
  });

  const errorMessage = response.errors?.[0]?.message;
  if (errorMessage && !errorMessage.startsWith("HTTP ") && isEditorAccessError(errorMessage)) {
    throw redirect(302, editorLoginRedirect("/editor/"));
  }

  return {
    stats: response.data?.editorDashboardStats ?? EMPTY_STATS,
    hymnbooks: response.data?.editorHymnbooks ?? [],
    sort,
    priority,
    error: errorMessage ?? null,
  };
}

export const load: PageLoad = (event) => _loadEditorDashboard(event);
