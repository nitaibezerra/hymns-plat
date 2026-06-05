/**
 * Marco 4.G — Ciclo 4G.1.
 *
 * Load function da busca. Lê `?q=...` da URL e, quando há termo não-vazio,
 * dispara `Query.search(q, kind: ALL)` no GraphQL. Sem termo, devolve listas
 * vazias sem bater no backend (placeholder mode).
 *
 * `data.query` ecoa o termo (já trimado) pro componente pré-popular o input.
 */

import { GRAPHQL_URL } from "$lib/config";
import { gqlFetch } from "$lib/graphql/fetcher";
import { SEARCH_QUERY } from "$lib/graphql/operations";

import type { PageLoad } from "./$types";

export interface HymnSearchResult {
  id: string;
  number: number;
  title: string;
  reviewStatus: string;
}

export interface HymnbookSearchResult {
  id: string;
  name: string;
  slug: string;
  isPublished: boolean;
}

export interface SearchResults {
  hymns: HymnSearchResult[];
  hymnbooks: HymnbookSearchResult[];
}

export interface SearchData {
  query: string;
  results: SearchResults;
  error: string | null;
}

const EMPTY_RESULTS: SearchResults = { hymns: [], hymnbooks: [] };

export async function _loadSearch(event: {
  fetch: typeof globalThis.fetch;
  url: URL;
}): Promise<SearchData> {
  const raw = event.url.searchParams.get("q") ?? "";
  const query = raw.trim();

  if (query === "") {
    return { query: "", results: { hymns: [], hymnbooks: [] }, error: null };
  }

  const response = await gqlFetch<{ search: SearchResults }>(
    event.fetch,
    GRAPHQL_URL,
    SEARCH_QUERY,
    { q: query, kind: "ALL" },
  );

  return {
    query,
    results: response.data?.search ?? EMPTY_RESULTS,
    error: response.errors?.[0]?.message ?? null,
  };
}

export const load: PageLoad = (event) => _loadSearch(event);
