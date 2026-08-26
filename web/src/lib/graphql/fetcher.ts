/**
 * Fetcher GraphQL minimalista usado por load functions SSR/CSR do SvelteKit.
 *
 * Separamos de `client.ts` (urql) porque:
 * 1. Load functions rodam em ambos os ambientes (SSR/CSR); urql tem
 *    state-management complexo que não combina com return-value puro.
 * 2. Aqui só queremos um POST + decode JSON. Sem cache, sem store.
 * 3. O `event.fetch` do SvelteKit é injetado, preservando cookies em SSR.
 *
 * Sobre cookies em SSR (Marco 4 — Frente 1): `credentials: 'include'` só
 * resolve no browser. Em SSR o código roda em Node, sem cookie jar, e o
 * `event.fetch` do SvelteKit só herda o cookie do visitante quando o destino
 * é o mesmo host da app — em produção o Django mora em outro host
 * (`api.` vs `app.`), então não herda nada. Sem o cookie de sessão,
 * `currentUser`, `isFavorited`, `notifications` e `isEditor` renderizam como
 * anônimo no primeiro paint. Daí a opção `cookie`: quem tem acesso à
 * requisição do visitante (server load / `hooks.server.ts`, via
 * `event.request.headers.get("cookie")`) repassa a string aqui e o Django
 * recebe a sessão. No browser não se passa nada — o navegador proíbe definir
 * o header `cookie` na mão e `credentials: 'include'` já faz o trabalho.
 */

export interface GraphqlError {
  message: string;
  path?: (string | number)[];
}

export interface GraphqlResponse<T> {
  data?: T;
  errors?: GraphqlError[];
}

export interface GqlFetchOptions {
  /** Token CSRF do cookie `csrftoken`. Obrigatório em mutations. */
  csrfToken?: string | null;
  /**
   * Header `cookie` cru da requisição do visitante, para repassar a sessão
   * Django em SSR. `null`/vazio = visitante sem cookies: não manda o header.
   */
  cookie?: string | null;
}

export async function gqlFetch<TData, TVars extends Record<string, unknown> = Record<string, unknown>>(
  fetchFn: typeof fetch,
  url: string,
  query: string,
  variables?: TVars,
  options?: GqlFetchOptions,
): Promise<GraphqlResponse<TData>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options?.csrfToken) headers["X-CSRFToken"] = options.csrfToken;
  if (options?.cookie) headers.cookie = options.cookie;

  const response = await fetchFn(url, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    return { errors: [{ message: `HTTP ${response.status}` }] };
  }
  return (await response.json()) as GraphqlResponse<TData>;
}
