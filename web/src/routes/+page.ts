/**
 * Marco 3 — Ciclo 3.4.
 *
 * Load function da home. Roda tanto em SSR quanto em CSR. Recebe `event.fetch`
 * do SvelteKit (que preserva cookies e cache cross-request em SSR) e busca os
 * stats globais do backend GraphQL.
 */

import { GRAPHQL_URL } from "$lib/config";
import { gqlFetch } from "$lib/graphql/fetcher";
import { GLOBAL_STATS_QUERY } from "$lib/graphql/operations";

import type { PageLoad } from "./$types";

export interface GlobalStats {
  hymnbooks: number;
  hymns: number;
  audios: number;
  activeReviewers: number;
}

export interface HomeData {
  stats: GlobalStats | null;
  error: string | null;
}

export async function _loadHome(event: { fetch: typeof globalThis.fetch }): Promise<HomeData> {
  const response = await gqlFetch<{ globalStats: GlobalStats }>(event.fetch, GRAPHQL_URL, GLOBAL_STATS_QUERY);
  return {
    stats: response.data?.globalStats ?? null,
    error: response.errors?.[0]?.message ?? null,
  };
}

export const load: PageLoad = (event) => _loadHome(event);
