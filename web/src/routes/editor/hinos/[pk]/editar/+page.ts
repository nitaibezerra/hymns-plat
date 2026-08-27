/**
 * Sub-marco 5.D — Ciclo 5D.10.
 *
 * Load function de `/editor/hinos/[pk]/editar/`: guard de editor + o hino
 * pra pré-popular o form.
 */

import { GRAPHQL_URL } from "$lib/config";
import { gqlFetch } from "$lib/graphql/fetcher";
import { HYMN_FORM_QUERY, requireEditor } from "$lib/graphql/operations/crud";

import type { PageLoad } from "./$types";

export interface HymnFormRecord {
  id: string;
  number: number;
  title: string;
  /** Letra. `HymnType.body` é o próprio `hymn.text` no resolver. */
  body: string;
  style: string;
  repetitions: string;
  extraInstructions: string;
  offeredTo: string;
  section: string;
  hymnBook: { id: string; name: string; slug: string };
}

export interface EditarHymnData {
  hymn: HymnFormRecord | null;
  pk: string;
  forbidden: boolean;
  error: string | null;
}

export async function _loadEditarHymn(event: {
  fetch: typeof globalThis.fetch;
  params: { pk: string };
}): Promise<EditarHymnData> {
  const pk = event.params.pk;
  const guard = await requireEditor(event.fetch, `/editor/hinos/${pk}/editar/`);
  if (guard.forbidden) {
    return { hymn: null, pk, forbidden: true, error: guard.error };
  }

  const response = await gqlFetch<{ hymn: HymnFormRecord | null }>(
    event.fetch,
    GRAPHQL_URL,
    HYMN_FORM_QUERY,
    { pk },
  );
  return {
    hymn: response.data?.hymn ?? null,
    pk,
    forbidden: false,
    error: response.errors?.[0]?.message ?? null,
  };
}

export const load: PageLoad = (event) => _loadEditarHymn(event);
