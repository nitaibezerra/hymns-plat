/**
 * Marco 3 — Ciclo 3.5.
 *
 * Lista de hinários. Visibilidade já é gateada no resolver
 * `Query.hymnbooks` (apps/api/schema.py) por `HymnBook.objects.visible_to(user)`.
 */

import { GRAPHQL_URL } from "$lib/config";
import { gqlFetch } from "$lib/graphql/fetcher";
import { HYMNBOOKS_QUERY } from "$lib/graphql/operations";

import type { PageLoad } from "./$types";

export interface HymnBookSummary {
  id: string;
  name: string;
  slug: string;
  isPublished: boolean;
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
