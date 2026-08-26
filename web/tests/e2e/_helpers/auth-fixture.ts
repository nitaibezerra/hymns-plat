/**
 * Fixture de sessão autenticada — desbloqueia `/notificacoes/` na tabela de
 * paridade (ficou de fora do Sub-marco 4.I por falta disso).
 *
 * **Por que pelo form do django-admin.** Duas alternativas foram descartadas:
 *
 * - A mutation `login` do GraphQL é `POST /graphql/`, que hoje exige cookie
 *   `csrftoken` + header `X-CSRFToken` — o mesmo aperto de CSRF que derruba o
 *   SSR do SvelteKit. Amarrar a fixture nela seria amarrá-la ao bloqueador.
 * - O `/accounts/login/` do allauth, neste projeto, renderiza **só** o botão
 *   "Continuar com Google" (verificado no HTML servido em dev): não existe
 *   campo de usuário/senha pra postar.
 *
 * O login do django-admin (`/django-admin/login/`) tem form de usuário e senha,
 * resolve o CSRF sozinho (token no HTML, cookie no `Set-Cookie` do GET) e o
 * `sessionid` que ele emite vale pro app inteiro — verificado: com esse cookie,
 * `GET /notificacoes/` responde 200 com a página real em vez do "Entrar".
 * Ou seja, a fixture **não** depende do fix de CSRF pra funcionar.
 *
 * **Por que uma sessão serve pros dois lados.** Cookie não distingue porta: o
 * `sessionid` gravado em `localhost` vale tanto pra `:9000` (Django) quanto
 * pra `:5173` (SvelteKit), e o SSR repassa o cookie pro GraphQL via
 * `event.fetch`. Um login, os dois lados autenticados.
 *
 * **Credencial:** `HINARIA_E2E_PASSWORD` (com `HINARIA_E2E_USERNAME`). Nada de
 * senha default hardcoded no repo — sem a env a fixture recusa dizendo o que
 * falta, em vez de skipar sem motivo.
 */

import { request } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";

export type StorageState = Awaited<ReturnType<APIRequestContext["storageState"]>>;

const DJANGO_BASE = process.env.HINARIA_DJANGO_BASE_URL ?? "http://localhost:9000";
const LOGIN_PATH = process.env.HINARIA_E2E_LOGIN_PATH ?? "/django-admin/login/";
const CSRF_INPUT =
  /<input[^>]*name=['"]csrfmiddlewaretoken['"][^>]*>|<input[^>]*value=['"][^'"]*['"][^>]*name=['"]csrfmiddlewaretoken['"][^>]*>/i;

/** Lê o `csrfmiddlewaretoken` do HTML do form de login. */
export function extractCsrfToken(html: string): string | null {
  const input = CSRF_INPUT.exec(html)?.[0];
  if (!input) return null;
  return /value=['"]([^'"]+)['"]/i.exec(input)?.[1] ?? null;
}

/** Explica, em PT-BR, o que falta pra fixture funcionar. */
export function describeAuthFixture(): string {
  return (
    "Rota autenticada: exportar HINARIA_E2E_PASSWORD (e HINARIA_E2E_USERNAME, " +
    `default "${process.env.HINARIA_E2E_USERNAME ?? "nitaibezerra"}") pra fixture ` +
    `logar no form do allauth em ${DJANGO_BASE}${LOGIN_PATH}. ` +
    "Ver _plan/marco4-diff-notes.md."
  );
}

/** `true` se o storageState carrega o cookie de sessão do Django. */
export function hasSessionCookie(state: StorageState): boolean {
  return state.cookies.some((cookie) => cookie.name === "sessionid");
}

/**
 * Faz o login programático e devolve o `storageState` pronto pra
 * `browser.newContext({ storageState })`.
 *
 * @returns `null` quando não há credencial configurada ou quando o login não
 *   produziu sessão — o chamador decide se skipa ou falha, sempre com motivo.
 */
export async function authenticatedContextState(): Promise<StorageState | null> {
  const username = process.env.HINARIA_E2E_USERNAME ?? "nitaibezerra";
  const password = process.env.HINARIA_E2E_PASSWORD;
  if (!password) return null;

  const context = await request.newContext({ baseURL: DJANGO_BASE });
  try {
    const form = await context.get(LOGIN_PATH);
    if (!form.ok()) return null;

    const csrfToken = extractCsrfToken(await form.text());
    if (!csrfToken) return null;

    const response = await context.post(LOGIN_PATH, {
      form: {
        csrfmiddlewaretoken: csrfToken,
        // `username` é o campo do django-admin; `login` é o do allauth.
        // Mandar os dois deixa a fixture funcionar com qualquer um dos forms
        // via HINARIA_E2E_LOGIN_PATH.
        username,
        login: username,
        password,
        next: "/",
      },
      headers: { Referer: `${DJANGO_BASE}${LOGIN_PATH}` },
      maxRedirects: 5,
    });
    if (!response.ok()) return null;

    const state = await context.storageState();
    return hasSessionCookie(state) ? state : null;
  } finally {
    await context.dispose();
  }
}
