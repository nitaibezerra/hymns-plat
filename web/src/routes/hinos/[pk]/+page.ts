/**
 * Marco 4.E — Ciclo 4E.1.
 *
 * Load function do detalhe de hino. Roda em SSR + CSR; `event.fetch`
 * preserva cookies de sessão pro resolver `Query.hymn` aplicar gating de
 * visibilidade (rascunhos só pra editor/admin) e pra `siblingsWithSameNumber`
 * já considerar `visible_to(user)`.
 */

import { GRAPHQL_URL } from "$lib/config";
import { gqlFetch } from "$lib/graphql/fetcher";
import { HYMN_DETAIL_QUERY } from "$lib/graphql/operations";

import type { PageLoad } from "./$types";

export interface HymnRef {
  id: string;
  number: number;
  title: string;
}

export interface HymnAudio {
  id: string;
  url: string;
  waveformPeaks: number[];
  durationSeconds: number | null;
  isApproved?: boolean;
  uploadedBy: { id: string; username: string } | null;
}

export interface HymnDetail {
  id: string;
  number: number;
  title: string;
  /** Letra do hino. `HymnType.body` é `String!` no schema, mas mantemos o
   * `null` tolerado porque o `HymnBody` já lida com vazio. */
  body: string | null;
  reviewStatus: "NOT_REVIEWED" | "IN_REVIEW" | "REVIEWED";
  previousInBook: HymnRef | null;
  nextInBook: HymnRef | null;
  siblingsWithSameNumber: HymnRef[];
  audios: HymnAudio[];
}

export interface HymnDetailData {
  hymn: HymnDetail | null;
  error: string | null;
  /** Repassado pro `HymnAudioList` pra liberar os áudios pendentes. */
  isEditor: boolean;
}

/**
 * Inferência de editor. O frontend ainda não tem um sinal forte de papel:
 * `CurrentUser` só devolve `{ id, username, email }`, então tratamos
 * "logado" como "editor", que é a mesma inferência usada no resto do
 * frontend do Marco 4 (o backend continua sendo a autoridade — ele filtra
 * `approvedOnly` de acordo com a permissão real da sessão).
 *
 * TODO(fase 2): trocar por `currentUser.isEditor`. O campo está sendo
 * adicionado ao `UserType` por outra frente e deve ser plugado aqui e no
 * `HymnAudioList` no mesmo commit, removendo esta inferência.
 */
function inferIsEditor(currentUser: { id: string } | null | undefined): boolean {
  return currentUser != null;
}

export async function _loadHymn(event: {
  fetch: typeof globalThis.fetch;
  params: { pk: string };
  /** `parent()` do SvelteKit — traz `currentUser` do `+layout.ts`.
   * Opcional pra manter a função testável sem montar o layout. */
  parent?: () => Promise<{ currentUser: { id: string } | null }>;
}): Promise<HymnDetailData> {
  const parentData = event.parent ? await event.parent() : null;
  const isEditor = inferIsEditor(parentData?.currentUser);

  const response = await gqlFetch<{ hymn: HymnDetail | null }>(
    event.fetch,
    GRAPHQL_URL,
    HYMN_DETAIL_QUERY,
    { pk: event.params.pk, approvedOnly: !isEditor },
  );
  return {
    hymn: response.data?.hymn ?? null,
    error: response.errors?.[0]?.message ?? null,
    isEditor,
  };
}

export const load: PageLoad = (event) => _loadHymn(event);
