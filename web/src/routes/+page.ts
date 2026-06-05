/**
 * Marco 3 — Ciclo 3.4 + Marco 4.C — Ciclo 4C.1.
 *
 * Load function da home. Roda tanto em SSR quanto em CSR. Recebe `event.fetch`
 * do SvelteKit (que preserva cookies e cache cross-request em SSR) e busca
 * em paralelo:
 *
 *   - `globalStats` — números do hero ("X hinários, Y hinos...").
 *   - `hourlyFeatured` — até 6 hinários sorteados na hora cheia, usados como
 *     featured no grid principal da home.
 *
 * Erro na query de stats vira `error`. Erro na query de featured é engolido
 * silenciosamente (`featured = []`) — destaque é decorativo, não bloqueia a
 * home se o backend falhar nessa query específica.
 */

import { GRAPHQL_URL } from "$lib/config";
import { gqlFetch } from "$lib/graphql/fetcher";
import { GLOBAL_STATS_QUERY, HOURLY_FEATURED_QUERY } from "$lib/graphql/operations";

import type { PageLoad } from "./$types";

export interface GlobalStats {
  hymnbooks: number;
  hymns: number;
  audios: number;
  activeReviewers: number;
}

export interface HymnBookStats {
  hymnsTotal: number;
  hymnsReviewed: number;
  audiosApproved: number;
}

export interface FeaturedHymnBook {
  id: string;
  name: string;
  slug: string;
  isPublished: boolean;
  stats: HymnBookStats;
}

export interface HomeData {
  stats: GlobalStats | null;
  featured: FeaturedHymnBook[];
  error: string | null;
}

export async function _loadHome(event: { fetch: typeof globalThis.fetch }): Promise<HomeData> {
  const [statsResp, featuredResp] = await Promise.all([
    gqlFetch<{ globalStats: GlobalStats }>(event.fetch, GRAPHQL_URL, GLOBAL_STATS_QUERY),
    gqlFetch<{ hourlyFeatured: FeaturedHymnBook[] }>(event.fetch, GRAPHQL_URL, HOURLY_FEATURED_QUERY),
  ]);

  const featured = featuredResp.errors?.length ? [] : (featuredResp.data?.hourlyFeatured ?? []);

  return {
    stats: statsResp.data?.globalStats ?? null,
    featured,
    error: statsResp.errors?.[0]?.message ?? null,
  };
}

export const load: PageLoad = (event) => _loadHome(event);
