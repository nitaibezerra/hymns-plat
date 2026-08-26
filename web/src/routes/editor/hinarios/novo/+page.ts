/**
 * Sub-marco 5.D — Ciclo 5D.1.
 *
 * Load function de `/editor/hinarios/novo/`. Só resolve o guard de editor:
 * o form em si não precisa de dados do servidor.
 *
 * O guard usa `currentUser.isEditor` (contrato do 5.A½) — NÃO inferimos
 * editor de "está logado", que era a inferência provisória do Marco 4.
 */

import { requireEditor } from "$lib/graphql/operations/crud";

import type { PageLoad } from "./$types";

export interface NovoHymnBookData {
  forbidden: boolean;
  error: string | null;
}

export async function _loadNovoHymnBook(event: {
  fetch: typeof globalThis.fetch;
}): Promise<NovoHymnBookData> {
  const guard = await requireEditor(event.fetch, "/editor/hinarios/novo/");
  return { forbidden: guard.forbidden, error: guard.error };
}

export const load: PageLoad = (event) => _loadNovoHymnBook(event);
