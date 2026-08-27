/**
 * Helpers de auth no cliente. Em vez de uma action SvelteKit que precisa
 * proxar a sessão pelo server, fazemos o login direto do browser pra
 * `/graphql/` — o cookie de sessão volta no Set-Cookie e fica salvo no
 * mesmo eTLD+1.
 *
 * Resultado é discriminado por `__typename` (vinda do schema GraphQL).
 */

import { GRAPHQL_URL } from "$lib/config";
import { getCsrfTokenFromCookie } from "$lib/graphql/client";
import { gqlFetch } from "$lib/graphql/fetcher";
import { LOGIN_MUTATION } from "$lib/graphql/operations";

export interface LoginUser {
  id: string;
  username: string;
  email: string | null;
}

export type LoginResult =
  | { ok: true; user: LoginUser }
  | { ok: false; message: string };

export async function loginWithPassword(
  fetchFn: typeof fetch,
  username: string,
  password: string,
): Promise<LoginResult> {
  const response = await gqlFetch<{
    login: { __typename: "LoginSuccess"; user: LoginUser } | { __typename: "LoginError"; message: string };
  }>(fetchFn, GRAPHQL_URL, LOGIN_MUTATION, { username, password }, { csrfToken: getCsrfTokenFromCookie() });

  if (response.errors?.length) {
    return { ok: false, message: response.errors[0].message };
  }
  const payload = response.data?.login;
  if (!payload) {
    return { ok: false, message: "Resposta inválida do servidor." };
  }
  if (payload.__typename === "LoginSuccess") {
    return { ok: true, user: payload.user };
  }
  return { ok: false, message: payload.message };
}
