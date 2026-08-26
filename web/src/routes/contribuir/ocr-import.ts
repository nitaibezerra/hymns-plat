/**
 * Sub-marco 5.F — Ciclos 5F.15 e 5F.16.
 *
 * As duas mutations que fecham o wizard. Ambas recebem **tudo por argumento**:
 * o estado do wizard saiu de `request.session` e virou URL/cliente, então não
 * existe estado implícito de servidor pra elas lerem.
 *
 * `taskId` é a chave de idempotência: uma task já consumida não gera segundo
 * hinário — a garantia é do backend, aqui só não escondemos o erro.
 *
 * Toda falha vira `{ ok: false, message }` em PT-BR: a tela de conferência
 * precisa continuar viva pro usuário tentar de novo sem perder o que conferiu.
 */

import { getCsrfTokenFromCookie } from "$lib/graphql/client";
import { GRAPHQL_URL } from "$lib/config";
import { gqlFetch } from "$lib/graphql/fetcher";
import {
  CREATE_HYMNBOOK_FROM_OCR_MUTATION,
  CREATE_HYMNBOOK_VERSION_FROM_OCR_MUTATION,
} from "$lib/graphql/operations/contribuir";

export type OcrImportResult =
  | { ok: true; slug: string; name: string }
  | { ok: false; message: string };

/** Payload da união: ou o hinário, ou um dos erros tipados do schema. */
interface ImportPayload {
  __typename: string;
  slug?: string;
  name?: string;
  message?: string;
}

const NETWORK_MESSAGE = "Erro de rede. Verifique sua conexão e tente novamente.";

async function runImportMutation(
  fetchFn: typeof globalThis.fetch,
  mutation: string,
  variables: Record<string, unknown>,
  field: string,
  genericMessage: string,
): Promise<OcrImportResult> {
  let response;
  try {
    response = await gqlFetch<Record<string, ImportPayload | null>>(
      fetchFn,
      GRAPHQL_URL,
      mutation,
      variables,
      { csrfToken: getCsrfTokenFromCookie() },
    );
  } catch {
    return { ok: false, message: NETWORK_MESSAGE };
  }

  // Erro GraphQL cobre também "a mutation ainda não existe no schema" (os
  // ciclos 5F.2/5F.3 são backend, fora do escopo desta frente).
  if (response.errors?.length) {
    return { ok: false, message: genericMessage };
  }

  const payload = response.data?.[field] ?? null;
  if (!payload) {
    return { ok: false, message: genericMessage };
  }

  if (payload.__typename === "HymnBookType" && payload.slug) {
    return { ok: true, slug: payload.slug, name: payload.name ?? "" };
  }

  // Erro tipado da união: a mensagem do backend já vem em PT-BR.
  return { ok: false, message: payload.message || genericMessage };
}

export function createHymnBookFromOcr(
  fetchFn: typeof globalThis.fetch,
  taskId: string,
): Promise<OcrImportResult> {
  return runImportMutation(
    fetchFn,
    CREATE_HYMNBOOK_FROM_OCR_MUTATION,
    { taskId },
    "createHymnBookFromOcr",
    "Não foi possível criar o hinário agora. Tente novamente em alguns instantes.",
  );
}

export function createHymnBookVersionFromOcr(
  fetchFn: typeof globalThis.fetch,
  taskId: string,
  hymnbookSlug: string,
  versionName: string,
): Promise<OcrImportResult> {
  return runImportMutation(
    fetchFn,
    CREATE_HYMNBOOK_VERSION_FROM_OCR_MUTATION,
    { taskId, hymnbookSlug, versionName },
    "createHymnBookVersionFromOcr",
    "Não foi possível criar a versão agora. Tente novamente em alguns instantes.",
  );
}
