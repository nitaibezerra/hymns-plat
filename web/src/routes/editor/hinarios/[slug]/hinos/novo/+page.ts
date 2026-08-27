/**
 * Sub-marco 5.D — Ciclo 5D.8.
 *
 * Load function de `/editor/hinarios/[slug]/hinos/novo/`: guard de editor +
 * contexto do hinário (nome pro cabeçalho e números usados pra sugerir
 * `max + 1`, igual ao `hymn_create_view` do Django).
 */

import { GRAPHQL_URL } from "$lib/config";
import { gqlFetch } from "$lib/graphql/fetcher";
import {
  HYMNBOOK_HYMN_NUMBERS_QUERY,
  requireEditor,
  suggestNextNumber,
} from "$lib/graphql/operations/crud";

import type { PageLoad } from "./$types";

export interface HymnBookRefRecord {
  id: string;
  name: string;
  slug: string;
}

export interface NovoHymnData {
  hymnbook: HymnBookRefRecord | null;
  slug: string;
  suggestedNumber: number;
  forbidden: boolean;
  error: string | null;
}

interface HymnbookWithNumbers extends HymnBookRefRecord {
  hymns: { id: string; number: number }[];
}

export async function _loadNovoHymn(event: {
  fetch: typeof globalThis.fetch;
  params: { slug: string };
}): Promise<NovoHymnData> {
  const slug = event.params.slug;
  const guard = await requireEditor(event.fetch, `/editor/hinarios/${slug}/hinos/novo/`);
  if (guard.forbidden) {
    return { hymnbook: null, slug, suggestedNumber: 1, forbidden: true, error: guard.error };
  }

  const response = await gqlFetch<{ hymnbook: HymnbookWithNumbers | null }>(
    event.fetch,
    GRAPHQL_URL,
    HYMNBOOK_HYMN_NUMBERS_QUERY,
    { slug },
  );
  const hymnbook = response.data?.hymnbook ?? null;
  return {
    hymnbook: hymnbook ? { id: hymnbook.id, name: hymnbook.name, slug: hymnbook.slug } : null,
    slug,
    suggestedNumber: suggestNextNumber((hymnbook?.hymns ?? []).map((h) => h.number)),
    forbidden: false,
    error: response.errors?.[0]?.message ?? null,
  };
}

export const load: PageLoad = (event) => _loadNovoHymn(event);
