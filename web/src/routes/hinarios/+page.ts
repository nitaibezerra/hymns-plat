/**
 * Marco 3 — Ciclo 3.5 + Marco 4.C — Ciclos 4C.4/4C.5.
 *
 * Lista de hinários. Visibilidade já é gateada no resolver
 * `Query.hymnbooks` (apps/api/schema.py) por `HymnBook.objects.visible_to(user)`,
 * então hinários não publicados só aparecem para editores/admins (auth via
 * cookie de sessão Django, preservado por `event.fetch` em SSR).
 *
 * O resultado vem com `stats` (hymnsTotal, hymnsReviewed, audiosApproved)
 * para alimentar o `HymnbookCard`.
 */

import { GRAPHQL_URL } from "$lib/config";
import { gqlFetch } from "$lib/graphql/fetcher";
import { HYMNBOOKS_QUERY } from "$lib/graphql/operations";

import type { PageLoad } from "./$types";

export interface HymnBookSummaryStats {
  hymnsTotal: number;
  hymnsReviewed: number;
  audiosApproved: number;
}

export interface HymnBookSummary {
  id: string;
  name: string;
  slug: string;
  isPublished: boolean;
  stats: HymnBookSummaryStats;
}

export interface HymnbooksData {
  hymnbooks: HymnBookSummary[];
  error: string | null;
}

export async function _loadHymnbooks(event: { fetch: typeof globalThis.fetch }): Promise<HymnbooksData> {
  const response = await gqlFetch<{ hymnbooks: HymnBookSummary[] }>(event.fetch, GRAPHQL_URL, HYMNBOOKS_QUERY);
  return {
    hymnbooks: response.data?.hymnbooks ?? [],
    error: response.errors?.[0]?.message ?? null,
  };
}

export const load: PageLoad = (event) => _loadHymnbooks(event);
