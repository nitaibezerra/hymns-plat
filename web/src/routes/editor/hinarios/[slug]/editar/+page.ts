/**
 * Sub-marco 5.D — Ciclo 5D.3.
 *
 * Load function de `/editor/hinarios/[slug]/editar/`: resolve o guard de
 * editor e busca o hinário pra pré-popular o form.
 *
 * Quando o guard nega, NÃO buscamos o hinário — economiza um roundtrip e
 * evita expor dados de rascunho a quem não é editor.
 */

import { GRAPHQL_URL } from "$lib/config";
import { gqlFetch } from "$lib/graphql/fetcher";
import { HYMNBOOK_FORM_QUERY, requireEditor } from "$lib/graphql/operations/crud";

import type { PageLoad } from "./$types";

export interface HymnBookFormRecord {
  id: string;
  name: string;
  slug: string;
  introName: string;
  ownerName: string;
  description: string;
  coverImage: string | null;
  isPublished: boolean;
}

export interface EditarHymnBookData {
  hymnbook: HymnBookFormRecord | null;
  slug: string;
  forbidden: boolean;
  error: string | null;
}

export async function _loadEditarHymnBook(event: {
  fetch: typeof globalThis.fetch;
  params: { slug: string };
}): Promise<EditarHymnBookData> {
  const slug = event.params.slug;
  const guard = await requireEditor(event.fetch, `/editor/hinarios/${slug}/editar/`);
  if (guard.forbidden) {
    return { hymnbook: null, slug, forbidden: true, error: guard.error };
  }

  const response = await gqlFetch<{ hymnbook: HymnBookFormRecord | null }>(
    event.fetch,
    GRAPHQL_URL,
    HYMNBOOK_FORM_QUERY,
    { slug },
  );
  return {
    hymnbook: response.data?.hymnbook ?? null,
    slug,
    forbidden: false,
    error: response.errors?.[0]?.message ?? null,
  };
}

export const load: PageLoad = (event) => _loadEditarHymnBook(event);
