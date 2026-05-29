/**
 * Cliente urql para o backend Django/GraphQL.
 *
 * Auth = session cookie do Django (decisão fixada no plano headless).
 * Por isso `credentials: 'include'` é obrigatório. Em mutations, o header
 * `X-CSRFToken` é preenchido a partir do cookie `csrftoken` lido por
 * `getCsrfTokenFromCookie()`.
 *
 * URL é resolvida em tempo de criação:
 * - Dev: `http://localhost:8000/graphql/` (Django local).
 * - Prod: `import.meta.env.VITE_GRAPHQL_URL`, ex. `https://api.hinaria.com.br/graphql/`.
 *
 * Em SSR (load functions do SvelteKit), o cookie precisa ser propagado via
 * `event.fetch` — isso é tratado no `+page.ts`, não aqui.
 */

import { Client, cacheExchange, fetchExchange } from "@urql/svelte";

export interface ClientOptions {
  url: string;
  fetch?: typeof fetch;
}

export function createGraphqlClient(options: ClientOptions): Client {
  return new Client({
    url: options.url,
    exchanges: [cacheExchange, fetchExchange],
    fetch: options.fetch,
    fetchOptions: () => buildFetchOptions(getCsrfTokenFromCookie()),
  });
}

export function buildFetchOptions(csrfToken: string | null): RequestInit {
  return {
    credentials: "include",
    headers: csrfToken ? { "X-CSRFToken": csrfToken } : {},
  };
}

/**
 * Extrai o valor do cookie `csrftoken`. Aceita uma string de cookie explícita
 * (útil pra teste) ou lê de `document.cookie` quando não recebe argumento.
 */
export function getCsrfTokenFromCookie(cookieString?: string): string | null {
  const source = cookieString ?? (typeof document !== "undefined" ? document.cookie : "");
  if (!source) return null;
  for (const part of source.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "csrftoken") {
      return rest.join("=") || null;
    }
  }
  return null;
}
