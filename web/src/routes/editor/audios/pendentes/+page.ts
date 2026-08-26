/**
 * Sub-marco 5.D — Ciclo 5D.14.
 *
 * Load function de `/editor/audios/pendentes/`: guard de editor + a fila de
 * `Query.pendingAudios`.
 *
 * O resolver de `pendingAudios` passou a LEVANTAR ERRO pra quem não é editor
 * no 5.A½ (antes vazava dados). Além do guard por `isEditor`, tratamos esse
 * erro aqui — se a sessão expirar entre as duas chamadas, a página mostra
 * "acesso negado" em vez de um 500 cru.
 */

import { GRAPHQL_URL } from "$lib/config";
import { gqlFetch } from "$lib/graphql/fetcher";
import {
  PENDING_AUDIOS_QUERY,
  isAuthOrPermissionError,
  requireEditor,
} from "$lib/graphql/operations/crud";

import type { PageLoad } from "./$types";

export interface PendingAudioHymn {
  id: string;
  number: number;
  title: string;
  hymnBook: { id: string; name: string; slug: string };
}

export interface PendingAudio {
  id: string;
  title: string;
  credits: string;
  source: string;
  format: string;
  fileSize: number | null;
  url: string;
  durationSeconds: number | null;
  createdAt: string;
  isApproved: boolean;
  uploadedBy: { id: string; username: string } | null;
  hymn: PendingAudioHymn;
}

export interface PendingAudiosData {
  audios: PendingAudio[];
  forbidden: boolean;
  error: string | null;
}

export async function _loadPendingAudios(event: {
  fetch: typeof globalThis.fetch;
}): Promise<PendingAudiosData> {
  const guard = await requireEditor(event.fetch, "/editor/audios/pendentes/");
  if (guard.forbidden) {
    return { audios: [], forbidden: true, error: guard.error };
  }

  const response = await gqlFetch<{ pendingAudios: PendingAudio[] | null }>(
    event.fetch,
    GRAPHQL_URL,
    PENDING_AUDIOS_QUERY,
  );

  const errorMessage = response.errors?.[0]?.message ?? null;
  if (errorMessage && !errorMessage.startsWith("HTTP ") && isAuthOrPermissionError(errorMessage)) {
    return { audios: [], forbidden: true, error: null };
  }

  return {
    audios: response.data?.pendingAudios ?? [],
    forbidden: false,
    error: errorMessage,
  };
}

export const load: PageLoad = (event) => _loadPendingAudios(event);
