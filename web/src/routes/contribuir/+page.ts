/**
 * Sub-marco 5.F — Ciclo 5F.5.
 *
 * Load function da tela 1 do wizard de contribuição (`/contribuir/`),
 * porta de `apps/users/views.py::upload_view`, que é `@login_required`.
 *
 * A SPA não tem acesso à sessão Django; o gate é feito consultando
 * `Query.currentUser` (mesmo padrão do 4.H.9 em `/notificacoes/`).
 * Anônimo → redirect pra `/login?next=/contribuir/`.
 *
 * Erro HTTP (backend fora do ar) NÃO redireciona — vira `data.error` pra a
 * página mostrar mensagem, porque mandar pro login não resolveria nada.
 */

import { GRAPHQL_URL } from "$lib/config";
import { gqlFetch } from "$lib/graphql/fetcher";
import { CURRENT_USER_QUERY } from "$lib/graphql/operations";
import { redirect } from "@sveltejs/kit";

import { isAuthError, isTransportError, loginRedirectTarget } from "./auth-guard";

import type { PageLoad } from "./$types";

export interface ContribuirUser {
  id: string;
  username: string;
}

export interface ContribuirData {
  currentUser: ContribuirUser | null;
  error: string | null;
}

export async function _loadContribuir(event: {
  fetch: typeof globalThis.fetch;
}): Promise<ContribuirData> {
  const response = await gqlFetch<{ currentUser: ContribuirUser | null }>(
    event.fetch,
    GRAPHQL_URL,
    CURRENT_USER_QUERY,
  );

  const errorMessage = response.errors?.[0]?.message ?? null;
  if (errorMessage && isTransportError(errorMessage)) {
    return { currentUser: null, error: errorMessage };
  }

  const currentUser = response.data?.currentUser ?? null;
  if (!currentUser || (errorMessage && isAuthError(errorMessage))) {
    throw redirect(302, loginRedirectTarget("/contribuir/"));
  }

  return { currentUser, error: errorMessage };
}

export const load: PageLoad = (event) => _loadContribuir(event);
