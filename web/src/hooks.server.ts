/**
 * Hooks de servidor. Só existe um: `handleFetch`, que repassa a sessão do
 * visitante pro Django quando o SSR fala com o GraphQL.
 *
 * ## O problema
 *
 * As load functions deste app são **universais** (`+page.ts` / `+layout.ts`):
 * no primeiro paint elas rodam em Node e chamam o Django via `event.fetch`.
 * O SvelteKit repassa o cookie do visitante nesse caminho, mas só quando o
 * destino é o mesmo hostname da app — a regra está em
 * `@sveltejs/kit/src/runtime/server/fetch.js`, no bloco comentado
 * "Allow cookie passthrough":
 *
 *     `.${url.hostname}`.endsWith(`.${event.url.hostname}`)
 *
 * Em dev isso é verdade por acidente (app em `localhost:5173`, Django em
 * `localhost:9000` — mesmo hostname, portas diferentes, e cookie não olha
 * porta), e é por isso que o bug passa despercebido na máquina. Em produção
 * a topologia é `app.hinaria.com.br` → `api.hinaria.com.br`: hostnames
 * irmãos, nenhum sufixo do outro, **nada é repassado**. Resultado medido
 * (curl sem JS, sessão válida, app e API em hostnames distintos): a home
 * renderiza "Entrar" em vez do usuário, `/notificacoes` renderiza
 * "Falha ao carregar notificações: Autenticação necessária…", e `/editor`
 * responde 302 pra `/login` **com um editor logado**. A hidratação corrige
 * tudo depois — daí a piscada de estado deslogado.
 *
 * ## Por que `handleFetch` e não `+layout.server.ts`
 *
 * `handleFetch` intercepta TODA chamada feita via `event.fetch` no servidor,
 * num ponto único. As dez load functions do app continuam intactas: nenhuma
 * precisa aprender a ler cookie, nenhuma precisa virar server load. Um
 * `+layout.server.ts` resolveria o shell, mas as páginas continuariam
 * anônimas a menos que cada `+page.ts` passasse a receber e repassar o
 * cookie via `parent()` — dez arquivos tocados, e num repo com frentes
 * paralelas isso é conflito garantido.
 *
 * Efeito colateral bem-vindo: `options.cookie` do `gqlFetch` deixa de ser
 * necessário no caminho normal (ver `src/lib/graphql/fetcher.ts`). Continua
 * existindo, e quem passa explicitamente ganha precedência sobre este hook.
 *
 * ## O gate de host
 *
 * `handleFetch` vê toda chamada de servidor, inclusive as que um dia
 * apontem pra fora (webhook, CDN, API de terceiro). Repassar o header
 * `cookie` do visitante pra host arbitrário é entregar a sessão dele — falha
 * de segurança, não descuido de estilo. Então o repasse é gateado pela
 * **origem** (esquema + host + porta) de `GRAPHQL_URL`, e nada mais:
 *
 * - origem igual → repassa;
 * - outro host, outra porta, outro esquema, ou host que só *termina* igual
 *   (`evil-api.hinaria.com.br` vs `api.hinaria.com.br`) → não repassa.
 *
 * ## CSRF
 *
 * Este hook manda o cookie inteiro, `csrftoken` incluído — mas o gate do
 * Django (`apps/api/csrf.py`) exige, em mutation, o **header**
 * `X-CSRFToken`, que quem monta é o `gqlFetch` via `options.csrfToken`. O
 * hook não mexe nesse caminho. Hoje nenhuma load function faz mutation (as
 * mutations saem de handlers no browser, que leem `document.cookie`), então
 * não existe POST de mutation em SSR pra ficar sem token.
 */

import { GRAPHQL_URL } from "$lib/config";

import type { HandleFetch } from "@sveltejs/kit";

/** Origem (`http://host:porta`) de uma URL, ou `null` se ela não for uma URL. */
function origem(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Põe o header `cookie` do visitante na requisição de saída, **se e somente
 * se** o destino for a origem do GraphQL configurado.
 *
 * Muta e devolve a mesma `Request` de propósito: o SvelteKit reaproveita
 * `mode`/`credentials` da requisição original quando a identidade do objeto
 * não muda (ver `create_fetch` no runtime dele).
 *
 * @param request Requisição que o `event.fetch` está prestes a disparar.
 * @param cookieDoVisitante `event.request.headers.get("cookie")`. `null` ou
 *   vazio = visitante sem cookies; segue anônimo, sem header nenhum.
 * @param graphqlUrl Origem autorizada a receber o cookie. Injetável só pra
 *   teste; em runtime é sempre `GRAPHQL_URL`.
 */
export function _repassarSessao(
  request: Request,
  cookieDoVisitante: string | null,
  graphqlUrl: string = GRAPHQL_URL,
): Request {
  if (!cookieDoVisitante) return request;
  // Cookie explícito do chamador (`gqlFetch({ cookie })`) tem precedência —
  // o hook complementa quem não passou nada, não sobrescreve quem passou.
  if (request.headers.has("cookie")) return request;

  const autorizada = origem(graphqlUrl);
  if (autorizada === null || origem(request.url) !== autorizada) return request;

  request.headers.set("cookie", cookieDoVisitante);
  return request;
}

export const handleFetch: HandleFetch = ({ event, request, fetch }) =>
  fetch(_repassarSessao(request, event.request.headers.get("cookie")));
