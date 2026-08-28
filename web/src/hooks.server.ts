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

import { GRAPHQL_SSR_URL, GRAPHQL_URL } from "$lib/config";

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

/**
 * Põe o header `Origin` da página na requisição de saída, sob o MESMO gate de
 * host do cookie.
 *
 * ## Por que isto é necessário
 *
 * O `universal_fetch` do SvelteKit **emula CORS no servidor**. O trecho, no
 * runtime dele, é literal:
 *
 *     const acao = response.headers.get("access-control-allow-origin");
 *     if (!acao || (acao !== event.url.origin && acao !== "*")) throw ...
 *
 * Ou seja: mesmo rodando em Node/Workers, sem navegador nenhum, a resposta
 * precisa carregar `Access-Control-Allow-Origin` igual à origem da página.
 *
 * E `fetch` de servidor **não manda `Origin`**. O `django-cors-headers` sai
 * cedo quando o header não existe (`if not origin: return response`), então a
 * resposta volta sem `Access-Control-Allow-Origin` e o SvelteKit lança
 * `CORS error: No 'Access-Control-Allow-Origin' header is present`.
 *
 * MEDIDO contra produção, e é o que fecha o raciocínio:
 *   POST sem  Origin              -> 200, nenhum header ACAO
 *   POST com  Origin: <beta>      -> 200, access-control-allow-origin: <beta>
 *
 * Foi exatamente esse 500 que derrubou toda rota do beta no primeiro deploy.
 *
 * ## Por que não aparece em dev
 *
 * Em `localhost` a app e o Django compartilham hostname, e o cookie
 * passthrough do próprio SvelteKit já entrega — o caminho que quebra é o
 * cross-host, que só existe em produção. É o mesmo motivo pelo qual o bug de
 * sessão em SSR também era invisível na máquina.
 *
 * @param request Requisição prestes a sair.
 * @param origemDaPagina `event.url.origin` — a origem que o SvelteKit vai
 *   exigir de volta no `Access-Control-Allow-Origin`.
 * @param graphqlUrl Origem autorizada. Injetável só pra teste.
 */
export function _declararOrigem(
  request: Request,
  origemDaPagina: string,
  graphqlUrl: string = GRAPHQL_URL,
): Request {
  // Quem já declarou `Origin` manda — o hook complementa, não sobrescreve.
  if (request.headers.has("origin")) return request;

  const autorizada = origem(graphqlUrl);
  if (autorizada === null || origem(request.url) !== autorizada) return request;

  request.headers.set("origin", origemDaPagina);
  return request;
}

/**
 * Troca o destino público pelo interno, quando eles diferem.
 *
 * Por que existe: em produção o apex é servido por um Worker (`hinaria-proxy`)
 * que reescreve o `Host`, porque o Railway não responde sem isso. E um Worker
 * que faz `fetch` para o PRÓPRIO domínio **não passa pelas rotas de Worker da
 * zona** — a subrequisição vai direto ao origin, com o Host que o Railway não
 * sabe rotear.
 *
 * Medido no primeiro deploy do beta: a resposta era `404` servido pela
 * `cloudflare`, e o SvelteKit reportava
 * `CORS error: No 'Access-Control-Allow-Origin' header is present` — porque um
 * 404 do edge não carrega header de CORS. **O erro que aparecia não era o erro
 * que existia**, e foi por isso que ele sobreviveu a duas tentativas de
 * conserto no lado de CORS.
 *
 * Sob o mesmo gate de origem do cookie. Vazio ou igual = sem desvio (dev).
 */
export function _desviarParaSsr(
  request: Request,
  graphqlUrl: string = GRAPHQL_URL,
  graphqlSsrUrl: string = GRAPHQL_SSR_URL,
): Request {
  const autorizada = origem(graphqlUrl);
  if (autorizada === null || origem(request.url) !== autorizada) return request;

  const destino = origem(graphqlSsrUrl);
  if (destino === null || destino === autorizada) return request;

  const alvo = new URL(request.url);
  const base = new URL(graphqlSsrUrl);
  alvo.protocol = base.protocol;
  alvo.host = base.host;
  return new Request(alvo.toString(), request);
}

export const handleFetch: HandleFetch = ({ event, request, fetch }) => {
  const comSessao = _repassarSessao(request, event.request.headers.get("cookie"));
  const comOrigem = _declararOrigem(comSessao, event.url.origin);
  return fetch(_desviarParaSsr(comOrigem));
};
