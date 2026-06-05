/**
 * Marco 4.B — Ciclo 4B.7.
 *
 * Load function global do shell. Roda em SSR + CSR; preserva cookies via
 * `event.fetch` (a sessão Django mora num cookie do mesmo eTLD+1).
 *
 * Busca o `currentUser` do GraphQL e propaga `{ currentUser }` para todas
 * as páginas. Erros são engolidos (currentUser = null) porque a UI deve
 * funcionar como anônima quando o backend está com problemas — não faz
 * sentido derrubar o shell inteiro por causa do header.
 */

import { GRAPHQL_URL } from "$lib/config";
import { gqlFetch } from "$lib/graphql/fetcher";
import { CURRENT_USER_QUERY } from "$lib/graphql/operations";

import type { LayoutLoad } from "./$types";

export interface LayoutUser {
  id: string;
  username: string;
  email: string;
}

export interface LayoutData {
  currentUser: LayoutUser | null;
}

export async function _loadLayout(event: { fetch: typeof globalThis.fetch }): Promise<LayoutData> {
  try {
    const response = await gqlFetch<{ currentUser: LayoutUser | null }>(
      event.fetch,
      GRAPHQL_URL,
      CURRENT_USER_QUERY,
    );
    if (response.errors?.length) {
      return { currentUser: null };
    }
    return { currentUser: response.data?.currentUser ?? null };
  } catch {
    return { currentUser: null };
  }
}

export const load: LayoutLoad = (event) => _loadLayout(event);
