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

export const UPDATE_HYMNBOOK_MUTATION = `
  mutation UpdateHymnBook($slug: String!, $input: HymnBookInput!) {
    updateHymnBook(slug: $slug, input: $input) {
      __typename
      ... on HymnBookType { id slug name }
      ... on ValidationError { message field }
      ... on PermissionDeniedError { message }
      ... on NotFoundError { message }
    }
  }
`;

// ---------------------------------------------------------------------------
// 5D.8 / 5D.9 — criar hino
// ---------------------------------------------------------------------------

/**
 * Contexto do form de novo hino: nome do hinário pro cabeçalho e os números
 * já usados, pra sugerir `max + 1` (paridade com `hymn_create_view`).
 */
export const HYMNBOOK_HYMN_NUMBERS_QUERY = `
  query HymnBookHymnNumbers($slug: String!) {
    hymnbook(slug: $slug) {
      id
      name
      slug
      hymns {
        id
        number
      }
    }
  }
`;

export function suggestNextNumber(numbers: number[]): number {
  if (numbers.length === 0) return 1;
  return Math.max(...numbers) + 1;
}

export interface HymnInputValues {
  number: number;
  title: string;
  text: string;
  style: string;
  repetitions: string;
  extraInstructions: string;
  offeredTo: string;
  section: string;
}

export interface HymnRef {
  __typename: string;
  id: string;
  number: number;
  title: string;
}

export const CREATE_HYMN_MUTATION = `
  mutation CreateHymn($hymnbookSlug: String!, $input: HymnInput!) {
    createHymn(hymnbookSlug: $hymnbookSlug, input: $input) {
      __typename
      ... on HymnType { id number title }
      ... on ValidationError { message field }
      ... on PermissionDeniedError { message }
      ... on NotFoundError { message }
    }
  }
`;

export function createHymn(
  fetchFn: typeof globalThis.fetch,
  hymnbookSlug: string,
  values: HymnInputValues,
): Promise<MutationOutcome<HymnRef>> {
  return runMutation<HymnRef>(
    fetchFn,
    CREATE_HYMN_MUTATION,
    { hymnbookSlug, input: values },
    "createHymn",
    ["HymnType"],
  );
}

// ---------------------------------------------------------------------------
// 5D.10 / 5D.11 — editar e deletar hino
// ---------------------------------------------------------------------------

/**
 * `HymnType` não expõe um campo `text`: a letra sai por `body`, que no
 * resolver é exatamente `hymn.text` (`apps/api/types.py`). Por isso o form de
 * edição lê `body` e escreve `HymnUpdateInput.text`.
 *
 * `hymnBook` só existe em `HymnType` desde o 5.A½ — é o que permite montar o
 * breadcrumb "voltar ao hinário" sem uma segunda query.
 */
export const HYMN_FORM_QUERY = `
  query HymnForm($pk: ID!) {
    hymn(pk: $pk) {
      id
      number
      title
      body
      style
      repetitions
      extraInstructions
      offeredTo
      section
      hymnBook {
        id
        name
        slug
      }
    }
  }
`;

export const UPDATE_HYMN_MUTATION = `
  mutation UpdateHymn($pk: ID!, $input: HymnUpdateInput!) {
    updateHymn(pk: $pk, input: $input) {
      __typename
      ... on HymnType { id number title }
      ... on ValidationError { message field }
      ... on PermissionDeniedError { message }
      ... on NotFoundError { message }
    }
  }
`;

export function updateHymn(
  fetchFn: typeof globalThis.fetch,
  pk: string,
  values: HymnInputValues,
): Promise<MutationOutcome<HymnRef>> {
  return runMutation<HymnRef>(
    fetchFn,
    UPDATE_HYMN_MUTATION,
    { pk, input: values },
    "updateHymn",
    ["HymnType"],
  );
}

// ---------------------------------------------------------------------------
// 5D.12 / 5D.13 — upload de áudio
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 5D.14 a 5D.16 — fila de aprovação de áudios
// ---------------------------------------------------------------------------

/**
 * `hymn`, `credits`, `format` e `fileSize` só existem em `HymnAudioType`
 * desde o 5.A½. Sem eles a fila era inutilizável: não havia como dizer a que
 * hino/hinário cada gravação pertencia.
 */
export const PENDING_AUDIOS_QUERY = `
  query PendingAudios {
    pendingAudios {
      id
      title
      credits
      source
      format
      fileSize
      url
      durationSeconds
      createdAt
      isApproved
      uploadedBy {
        id
        username
      }
      hymn {
        id
        number
        title
        hymnBook {
          id
          name
          slug
        }
      }
    }
  }
`;

export const AUDIO_ALLOWED_EXTENSIONS = ["mp3", "ogg", "flac"] as const;
export const AUDIO_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Validação client-side do arquivo de áudio (5D.13). Roda ANTES do upload:
 * subir 25 MB pra descobrir que a extensão é inválida seria cruel com quem
 * está em conexão ruim. O backend continua validando — isto é conveniência,
 * não segurança.
 *
 * Devolve `null` quando o arquivo passa, ou a mensagem em PT-BR pra exibir.
 */
export function validateAudioFile(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!AUDIO_ALLOWED_EXTENSIONS.includes(extension as (typeof AUDIO_ALLOWED_EXTENSIONS)[number])) {
    return "Formato não aceito. Envie um arquivo MP3, OGG ou FLAC.";
  }
  if (file.size > AUDIO_MAX_BYTES) {
    return "Arquivo muito grande. O tamanho máximo é 25 MB.";
  }
  return null;
}

export const UPLOAD_AUDIO_MUTATION = `
  mutation UploadAudio(
    $hymnPk: ID!
    $file: Upload!
    $title: String
    $source: String
    $credits: String
    $allowDownload: Boolean
  ) {
    uploadAudio(
      hymnPk: $hymnPk
      file: $file
      title: $title
      source: $source
      credits: $credits
      allowDownload: $allowDownload
    ) {
      __typename
      ... on HymnAudioType { id title }
      ... on ValidationError { message field }
      ... on PermissionDeniedError { message }
      ... on NotFoundError { message }
    }
  }
`;

export interface AudioRef {
  __typename: string;
  id: string;
  title: string;
}

export interface UploadAudioMeta {
  title: string;
  source: string;
  credits: string;
  allowDownload: boolean;
}

/**
 * `Upload` só viaja por multipart — não existe forma JSON. A validação de
 * extensão e tamanho acontece ANTES daqui, no componente (5D.13): mandar 25
 * MB pra descobrir que a extensão é inválida seria cruel com quem está em
 * conexão ruim.
 */
export function uploadAudio(
  fetchFn: typeof globalThis.fetch,
  hymnPk: string,
  file: File,
  meta: UploadAudioMeta,
): Promise<MutationOutcome<AudioRef>> {
  return runMultipartMutation<AudioRef>(
    fetchFn,
    UPLOAD_AUDIO_MUTATION,
    {
      hymnPk,
      file: null,
      title: meta.title,
      source: meta.source,
      credits: meta.credits,
      allowDownload: meta.allowDownload,
    },
    { "variables.file": file },
    "uploadAudio",
    ["HymnAudioType"],
  );
}

export const DELETE_HYMN_MUTATION = `
  mutation DeleteHymn($pk: ID!) {
    deleteHymn(pk: $pk) {
      __typename
      ... on DeleteResult { ok deletedId }
      ... on PermissionDeniedError { message }
      ... on NotFoundError { message }
    }
  }
`;

export function deleteHymn(
  fetchFn: typeof globalThis.fetch,
  pk: string,
): Promise<MutationOutcome<DeleteRef>> {
  return runMutation<DeleteRef>(
    fetchFn,
    DELETE_HYMN_MUTATION,
    { pk },
    "deleteHymn",
    ["DeleteResult"],
  );
}

// ---------------------------------------------------------------------------
// 5D.6 / 5D.7 — checklist e publicação
// ---------------------------------------------------------------------------

export interface PublishReadinessCheck {
  key: string;
  label: string;
  ok: boolean;
}

export interface PublishReadiness {
  canPublish: boolean;
  checks: PublishReadinessCheck[];
}

export const PUBLISH_READINESS_QUERY = `
  query PublishReadiness($slug: String!) {
    publishReadiness(slug: $slug) {
      canPublish
      checks {
        key
        label
        ok
      }
    }
  }
`;

/**
 * O checklist é sempre do backend (`apps/hymns/services/review.py::
 * publish_readiness`). O cliente NÃO reimplementa nenhuma regra — só desenha
 * o resultado e respeita `canPublish`.
 */
export async function fetchPublishReadiness(
  fetchFn: typeof globalThis.fetch,
  slug: string,
): Promise<{ readiness: PublishReadiness | null; error: string | null }> {
  const response = await gqlFetch<{ publishReadiness: PublishReadiness | null }>(
    fetchFn,
    GRAPHQL_URL,
    PUBLISH_READINESS_QUERY,
    { slug },
  );
  const readiness = response.data?.publishReadiness ?? null;
  if (!readiness) {
    return {
      readiness: null,
      error:
        response.errors?.[0]?.message ??
        "Não foi possível carregar o checklist de publicação.",
    };
  }
  return { readiness, error: null };
}

export const PUBLISH_HYMNBOOK_MUTATION = `
  mutation PublishHymnBook($slug: String!) {
    publishHymnBook(slug: $slug) {
      __typename
      ... on PublishResult { ok failedChecks }
      ... on PermissionDeniedError { message }
      ... on NotFoundError { message }
    }
  }
`;

export const UNPUBLISH_HYMNBOOK_MUTATION = `
  mutation UnpublishHymnBook($slug: String!) {
    unpublishHymnBook(slug: $slug) {
      __typename
      ... on HymnBookType { id slug name isPublished }
      ... on PermissionDeniedError { message }
      ... on NotFoundError { message }
    }
  }
`;

export interface PublishRef {
  __typename: string;
  ok: boolean;
  failedChecks: string[];
}

/**
 * `PublishResult` pode voltar com `ok: false` + `failedChecks` mesmo sem
 * erro de permissão: é o backend re-checando o `publish_readiness` no
 * momento do commit (o checklist da tela pode ter envelhecido). Traduzimos
 * isso numa mensagem legível em vez de deixar passar como sucesso.
 */
export async function publishHymnBook(
  fetchFn: typeof globalThis.fetch,
  slug: string,
): Promise<MutationOutcome<PublishRef>> {
  const outcome = await runMutation<PublishRef>(
    fetchFn,
    PUBLISH_HYMNBOOK_MUTATION,
    { slug },
    "publishHymnBook",
    ["PublishResult"],
  );
  if (outcome.ok && outcome.data && !outcome.data.ok) {
    const pending = outcome.data.failedChecks.join("; ");
    return {
      ok: false,
      data: null,
      message: pending
        ? `Hinário não pode ser publicado. Pendências: ${pending}`
        : "Hinário não pode ser publicado.",
    };
  }
  return outcome;
}

export function unpublishHymnBook(
  fetchFn: typeof globalThis.fetch,
  slug: string,
): Promise<MutationOutcome<HymnBookRef>> {
  return runMutation<HymnBookRef>(
    fetchFn,
    UNPUBLISH_HYMNBOOK_MUTATION,
    { slug },
    "unpublishHymnBook",
    ["HymnBookType"],
  );
}

export interface DeleteRef {
  __typename: string;
  ok: boolean;
  deletedId: string | null;
}

export const DELETE_HYMNBOOK_MUTATION = `
  mutation DeleteHymnBook($slug: String!) {
    deleteHymnBook(slug: $slug) {
      __typename
      ... on DeleteResult { ok deletedId }
      ... on PermissionDeniedError { message }
      ... on NotFoundError { message }
    }
  }
`;

export function deleteHymnBook(
  fetchFn: typeof globalThis.fetch,
  slug: string,
): Promise<MutationOutcome<DeleteRef>> {
  return runMutation<DeleteRef>(
    fetchFn,
    DELETE_HYMNBOOK_MUTATION,
    { slug },
    "deleteHymnBook",
    ["DeleteResult"],
  );
}

export function updateHymnBook(
  fetchFn: typeof globalThis.fetch,
  slug: string,
  values: HymnBookInputValues,
  coverFile: File | null,
): Promise<MutationOutcome<HymnBookRef>> {
  if (!coverFile) {
    return runMutation<HymnBookRef>(
      fetchFn,
      UPDATE_HYMNBOOK_MUTATION,
      { slug, input: values },
      "updateHymnBook",
      ["HymnBookType"],
    );
  }
  return runMultipartMutation<HymnBookRef>(
    fetchFn,
    UPDATE_HYMNBOOK_MUTATION,
    { slug, input: { ...values, coverImage: null } },
    { "variables.input.coverImage": coverFile },
    "updateHymnBook",
    ["HymnBookType"],
  );
}
