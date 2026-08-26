/**
 * Marco 4.E — Ciclo 4E.1.
 *
 * Load function do detalhe de hino. Roda em SSR + CSR; `event.fetch`
 * preserva cookies de sessão pro resolver `Query.hymn` aplicar gating de
 * visibilidade (rascunhos só pra editor/admin) e pra `siblingsWithSameNumber`
 * já considerar `visible_to(user)`.
 */

import { GRAPHQL_URL } from "$lib/config";
import { gqlFetch } from "$lib/graphql/fetcher";
import { HYMN_DETAIL_QUERY } from "$lib/graphql/operations";

import type { PageLoad } from "./$types";

export interface HymnRef {
  id: string;
  number: number;
  title: string;
}

export interface HymnAudio {
  id: string;
  url: string;
  waveformPeaks: number[];
  durationSeconds: number | null;
  uploadedBy: { id: string; username: string } | null;
}

export interface HymnDetail {
  id: string;
  number: number;
  title: string;
  /** Letra do hino. `HymnType.body` é `String!` no schema, mas mantemos o
   * `null` tolerado porque o `HymnBody` já lida com vazio. */
  body: string | null;
  reviewStatus: "NOT_REVIEWED" | "IN_REVIEW" | "REVIEWED";
  previousInBook: HymnRef | null;
  nextInBook: HymnRef | null;
  siblingsWithSameNumber: HymnRef[];
  audios: HymnAudio[];
}

export interface HymnDetailData {
  hymn: HymnDetail | null;
  error: string | null;
}

export async function _loadHymn(event: {
  fetch: typeof globalThis.fetch;
  params: { pk: string };
}): Promise<HymnDetailData> {
  const response = await gqlFetch<{ hymn: HymnDetail | null }>(
    event.fetch,
    GRAPHQL_URL,
    HYMN_DETAIL_QUERY,
    { pk: event.params.pk },
  );
  return {
    hymn: response.data?.hymn ?? null,
    error: response.errors?.[0]?.message ?? null,
  };
}

export const load: PageLoad = (event) => _loadHymn(event);
