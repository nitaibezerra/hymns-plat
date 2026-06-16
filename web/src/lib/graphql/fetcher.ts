/**
 * Fetcher GraphQL minimalista usado por load functions SSR/CSR do SvelteKit.
 *
 * Separamos de `client.ts` (urql) porque:
 * 1. Load functions rodam em ambos os ambientes (SSR/CSR); urql tem
 *    state-management complexo que não combina com return-value puro.
 * 2. Aqui só queremos um POST + decode JSON. Sem cache, sem store.
 * 3. O `event.fetch` do SvelteKit é injetado, preservando cookies em SSR.
 */

export interface GraphqlError {
  message: string;
  path?: (string | number)[];
}

export interface GraphqlResponse<T> {
  data?: T;
  errors?: GraphqlError[];
}

export async function gqlFetch<TData, TVars extends Record<string, unknown> = Record<string, unknown>>(
  fetchFn: typeof fetch,
  url: string,
  query: string,
  variables?: TVars,
  options?: { csrfToken?: string | null },
): Promise<GraphqlResponse<TData>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options?.csrfToken) headers["X-CSRFToken"] = options.csrfToken;

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
