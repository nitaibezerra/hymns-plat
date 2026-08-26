/**
 * Sub-marco 5.D — operações GraphQL do CRUD editorial (hinários, hinos e
 * aprovação de áudios) + helpers de guard.
 *
 * Arquivo EXCLUSIVO desta frente. `$lib/graphql/operations.ts` (o barril
 * antigo) é compartilhado por quatro frentes em paralelo e editá-lo produz
 * `export const` duplicado no merge — foi assim que a regressão do merge F3
 * derrubou o build. Aqui só entram operações de 5.D.
 */

import { GRAPHQL_URL } from "$lib/config";
import { getCsrfTokenFromCookie } from "$lib/graphql/client";
import { gqlFetch } from "$lib/graphql/fetcher";
import { redirect } from "@sveltejs/kit";

// ---------------------------------------------------------------------------
// Guard de editor
// ---------------------------------------------------------------------------

/**
 * O contrato do 5.A½ fixou `UserType.isEditor` como a ÚNICA fonte de verdade
 * de papel. Inferir editor de `currentUser !== null` (como o Marco 4 fazia)
 * vaza telas editoriais para qualquer usuário logado.
 */
export const EDITOR_GUARD_QUERY = `
  query EditorGuard {
    currentUser {
      id
      username
      isEditor
    }
  }
`;

export interface EditorGuardUser {
  id: string;
  username: string;
  isEditor: boolean;
}

export interface EditorGuardResult {
  user: EditorGuardUser | null;
  /** Logado, mas sem papel de editor. A página mostra "acesso negado". */
  forbidden: boolean;
  error: string | null;
}

/**
 * Reconhece erros de autenticação/permissão vindos do backend. Os resolvers
 * do workspace (5.A½) levantam GraphQLError pra quem não é editor; as
 * mensagens variam entre Strawberry e as nossas, então cobrimos o conjunto
 * em vez de acoplar à string exata.
 */
export function isAuthOrPermissionError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("authenticat") ||
    m.includes("must be logged in") ||
    m.includes("permission denied") ||
    m.includes("not an editor") ||
    m.includes("unauthorized")
  );
}

/**
 * Guard compartilhado pelas load functions de 5.D.
 *
 * - anônimo → `throw redirect(302, /login?next=<nextPath>)` (paridade com o
 *   `@login_required` do Django);
 * - logado sem papel de editor → `forbidden: true` (paridade com o
 *   `messages.error` + redirect do `_has_editor_access`), deixando a página
 *   renderizar a negativa em vez de um 500.
 */
export async function requireEditor(
  fetchFn: typeof globalThis.fetch,
  nextPath: string,
): Promise<EditorGuardResult> {
  const response = await gqlFetch<{ currentUser: EditorGuardUser | null }>(
    fetchFn,
    GRAPHQL_URL,
    EDITOR_GUARD_QUERY,
  );

  const errorMessage = response.errors?.[0]?.message ?? null;
  const httpError = errorMessage?.startsWith("HTTP ") ?? false;
  const user = response.data?.currentUser ?? null;

  if (!user) {
    // Erro de transporte não é "anônimo": devolvemos o erro pra página em vez
    // de expulsar o editor pro login por causa de um 500 do backend.
    if (httpError) return { user: null, forbidden: true, error: errorMessage };
    throw redirect(302, `/login?next=${nextPath}`);
  }
  return { user, forbidden: !user.isEditor, error: httpError ? errorMessage : null };
}

// ---------------------------------------------------------------------------
// Mutations — executadas no browser (não em load function), por isso levam
// o header `X-CSRFToken` lido do cookie do Django.
// ---------------------------------------------------------------------------

export interface MutationOutcome<T> {
  ok: boolean;
  data: T | null;
  message: string | null;
}

/**
 * Executa uma mutation e normaliza o resultado.
 *
 * Todas as mutations de 5.D devolvem `union` com `PermissionDeniedError |
 * NotFoundError | ValidationError`, então o discriminante é sempre
 * `__typename`. `okTypename` diz qual membro representa sucesso.
 */
export async function runMutation<T extends { __typename: string }>(
  fetchFn: typeof globalThis.fetch,
  query: string,
  variables: Record<string, unknown>,
  field: string,
  okTypenames: string[],
): Promise<MutationOutcome<T>> {
  const response = await gqlFetch<Record<string, T & { message?: string }>>(
    fetchFn,
    GRAPHQL_URL,
    query,
    variables,
    { csrfToken: getCsrfTokenFromCookie() },
  );
  return normalizeUnion<T>(
    response.errors?.[0]?.message ?? null,
    response.data?.[field] ?? null,
    okTypenames,
  );
}

/**
 * Variante multipart pro scalar `Upload` (capa de hinário em 5D.2/5D.4 e
 * áudio em 5D.12), seguindo o graphql-multipart-request-spec — o mesmo que a
 * view do Django aceita (`multipart_uploads_enabled=True` em
 * `apps/api/urls.py`).
 *
 * `files` mapeia o caminho da variável (ex.: `variables.input.coverImage`)
 * para o `File`. O valor correspondente dentro de `variables` deve vir `null`.
 *
 * Não definimos `Content-Type`: o browser precisa gerar o boundary.
 */
export async function runMultipartMutation<T extends { __typename: string }>(
  fetchFn: typeof globalThis.fetch,
  query: string,
  variables: Record<string, unknown>,
  files: Record<string, File>,
  field: string,
  okTypenames: string[],
): Promise<MutationOutcome<T>> {
  const form = new FormData();
  form.append("operations", JSON.stringify({ query, variables }));

  const paths = Object.keys(files);
  const map: Record<string, string[]> = {};
  paths.forEach((path, index) => {
    map[String(index)] = [path];
  });
  form.append("map", JSON.stringify(map));
  paths.forEach((path, index) => {
    form.append(String(index), files[path]);
  });

  const csrfToken = getCsrfTokenFromCookie();
  const response = await fetchFn(GRAPHQL_URL, {
    method: "POST",
    credentials: "include",
    headers: csrfToken ? { "X-CSRFToken": csrfToken } : {},
    body: form,
  });
  if (!response.ok) {
    return { ok: false, data: null, message: `HTTP ${response.status}` };
  }
  const json = (await response.json()) as {
    data?: Record<string, (T & { message?: string }) | null>;
    errors?: { message: string }[];
  };
  return normalizeUnion<T>(
    json.errors?.[0]?.message ?? null,
    json.data?.[field] ?? null,
    okTypenames,
  );
}

function normalizeUnion<T extends { __typename: string }>(
  transportError: string | null,
  payload: (T & { message?: string }) | null,
  okTypenames: string[],
): MutationOutcome<T> {
  if (transportError) {
    return { ok: false, data: null, message: transportError };
  }
  if (!payload) {
    return { ok: false, data: null, message: "Resposta inválida do servidor." };
  }
  if (okTypenames.includes(payload.__typename)) {
    return { ok: true, data: payload as T, message: null };
  }
  return {
    ok: false,
    data: null,
    message: payload.message ?? "Não foi possível concluir a operação.",
  };
}

// ---------------------------------------------------------------------------
// 5D.2 / 5D.4 — criar e editar hinário
// ---------------------------------------------------------------------------

export interface HymnBookInputValues {
  name: string;
  ownerName: string;
  introName: string;
  description: string;
}

export interface HymnBookRef {
  __typename: string;
  id: string;
  slug: string;
  name: string;
}

/**
 * Form de edição. `description`, `ownerName`, `introName` e `coverImage` só
 * existem em `HymnBookType` desde o 5.A½ — antes disso o form de edição não
 * tinha como pré-popular nada além do nome.
 */
export const HYMNBOOK_FORM_QUERY = `
  query HymnBookForm($slug: String!) {
    hymnbook(slug: $slug) {
      id
      name
      slug
      introName
      ownerName
      description
      coverImage
      isPublished
    }
  }
`;

export const CREATE_HYMNBOOK_MUTATION = `
  mutation CreateHymnBook($input: HymnBookInput!) {
    createHymnBook(input: $input) {
      __typename
      ... on HymnBookType { id slug name }
      ... on ValidationError { message field }
      ... on PermissionDeniedError { message }
    }
  }
`;

/**
 * Sem capa mandamos JSON puro (mais barato e não exige o parser multipart);
 * com capa caímos no multipart spec, porque `Upload` não é serializável em
 * JSON.
 */
export function createHymnBook(
  fetchFn: typeof globalThis.fetch,
  values: HymnBookInputValues,
  coverFile: File | null,
): Promise<MutationOutcome<HymnBookRef>> {
  if (!coverFile) {
    return runMutation<HymnBookRef>(
      fetchFn,
      CREATE_HYMNBOOK_MUTATION,
      { input: values },
      "createHymnBook",
      ["HymnBookType"],
    );
  }
  return runMultipartMutation<HymnBookRef>(
    fetchFn,
    CREATE_HYMNBOOK_MUTATION,
    { input: { ...values, coverImage: null } },
    { "variables.input.coverImage": coverFile },
    "createHymnBook",
    ["HymnBookType"],
  );
}
