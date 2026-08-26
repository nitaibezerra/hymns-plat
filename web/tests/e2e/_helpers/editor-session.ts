/**
 * Sessão autenticada para as specs do workspace editorial.
 *
 * **Por que não pela tela de login da SPA.** Seria a jornada mais fiel, e não
 * funciona hoje: `/login` posta a mutation `login` do GraphQL do browser em
 * `:5173` para o Django em `:9000`, e o `CsrfViewMiddleware` recusa com
 * `Origin checking failed - http://localhost:5173 does not match any trusted
 * origins`. `config/settings/local.py` não define `CSRF_TRUSTED_ORIGINS`
 * (só `production.py` define), então TODA mutation vinda da SPA em dev toma
 * 403. Medido nesta base, não deduzido. O conserto é uma linha em `config/`
 * — fora do escopo desta frente; está registrado em `blocked`.
 *
 * **Como funciona então.** Um `APIRequestContext` do Playwright NÃO é um
 * browser: ele manda o `Origin` que a gente mandar. Logando pelo próprio
 * endpoint do Django com `Origin` = o Django, a requisição é same-origin aos
 * olhos do middleware e a MESMA mutation `login` do app roda de verdade — não
 * é atalho de banco nem sessão forjada. O `sessionid` que volta vale para a
 * SPA porque cookie não distingue porta: gravado em `localhost`, serve a
 * `:9000` e a `:5173`, e o SSR do SvelteKit repassa o cookie ao GraphQL via
 * `event.fetch`.
 *
 * **Por que não a `auth-fixture.ts` que já existe.** Ela loga pelo form do
 * django-admin, que exige `is_staff`. Dar `is_staff` ao editor da fixture o
 * faria passar por gates de staff (`apps/api/mutations.py`) que um editor
 * comum não passa — a fixture deixaria de exercitar a regra real. O
 * `hasSessionCookie` dela, esse sim, é reusado aqui.
 */

import { request } from "@playwright/test";

import { hasSessionCookie, type StorageState } from "./auth-fixture";
import { editorUsername, seedPassword, viewerUsername } from "./seed-fixture";

const DJANGO_BASE = process.env.HINARIA_DJANGO_BASE_URL ?? "http://localhost:9000";
const GRAPHQL_PATH = "/graphql/";

const LOGIN_MUTATION = `
  mutation EntrarE2E($username: String!, $password: String!) {
    login(username: $username, password: $password) {
      __typename
      ... on LoginSuccess { user { id username isEditor } }
      ... on LoginError { message }
    }
  }
`;

export interface SeedSession {
  state: StorageState;
  isEditor: boolean;
  username: string;
}

/** Lê o `csrftoken` de um `storageState`. */
function csrfFrom(state: StorageState): string | null {
  return state.cookies.find((cookie) => cookie.name === "csrftoken")?.value ?? null;
}

/**
 * Loga `username` pela mutation real e devolve o `storageState` pronto para
 * `browser.newContext({ storageState })`.
 *
 * @returns `null` quando o login não produziu sessão — credencial errada,
 *   fixture não semeada ou Django fora do ar. O chamador decide entre skipar
 *   e falhar, sempre com motivo; nunca skipa em silêncio.
 */
export async function seedSession(username: string): Promise<SeedSession | null> {
  const context = await request.newContext({ baseURL: DJANGO_BASE });
  try {
    // GET semeia o cookie `csrftoken` (`ensure_csrf_cookie` em métodos
    // seguros, ver `apps/api/csrf.py`).
    const seeded = await context.get(GRAPHQL_PATH, { headers: { Accept: "text/html" } });
    if (!seeded.ok()) return null;

    const token = csrfFrom(await context.storageState());
    if (!token) return null;

    const response = await context.post(GRAPHQL_PATH, {
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": token,
        Origin: DJANGO_BASE,
        Referer: `${DJANGO_BASE}/`,
      },
      data: { query: LOGIN_MUTATION, variables: { username, password: seedPassword() } },
    });
    if (!response.ok()) return null;

    const payload = (await response.json()) as {
      data?: { login?: { __typename: string; user?: { isEditor: boolean } } };
    };
    const login = payload.data?.login;
    if (login?.__typename !== "LoginSuccess") return null;

    const state = await context.storageState();
    if (!hasSessionCookie(state)) return null;
    return { state, isEditor: Boolean(login.user?.isEditor), username };
  } catch {
    return null;
  } finally {
    await context.dispose();
  }
}

/** Sessão do editor da fixture. */
export function editorSession(): Promise<SeedSession | null> {
  return seedSession(editorUsername());
}

/** Sessão do usuário comum da fixture — quem o guard tem que negar. */
export function viewerSession(): Promise<SeedSession | null> {
  return seedSession(viewerUsername());
}

/** Explica, em PT-BR, o que fazer quando a sessão não sai. */
export function describeSessionFailure(username: string): string {
  return (
    `Não consegui logar "${username}" em ${DJANGO_BASE}${GRAPHQL_PATH}. ` +
    "Confira: (1) o Django está no ar nessa porta; (2) o banco foi semeado " +
    "(`./scripts/dev-fullstack.sh seed`); (3) HINARIA_E2E_PASSWORD bate com a " +
    "senha usada no seed."
  );
}
