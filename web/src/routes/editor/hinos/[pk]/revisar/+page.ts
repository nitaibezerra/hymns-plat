/**
 * Sub-marco 5.C — Ciclo 5C.1.
 *
 * Load function da tela 07 · Revisar hino (a mais complexa do projeto).
 * Roda em SSR + CSR; `event.fetch` propaga o cookie de sessão do Django,
 * que é o que autoriza os campos editoriais (`inlineDiff`, `revisions`…).
 *
 * O guard de editor mora no `+layout` de `/editor` (outra frente). Aqui só
 * tratamos o erro: se o backend recusar, `error` volta preenchido e a
 * página mostra a mensagem em vez de renderizar o formulário.
 *
 * Nota de schema: `HymnType` não expõe `text` — `body` devolve `Hymn.text`
 * cru. Normalizamos para `hymn.text` porque é esse o nome que o formulário
 * e `HymnUpdateInput.text` usam.
 */

import { GRAPHQL_URL } from "$lib/config";
import { gqlFetch } from "$lib/graphql/fetcher";
import { REVISE_HYMN_QUERY } from "$lib/graphql/operations/revise-hymn";

import type { PageLoad } from "./$types";

export type ReviewStatus = "NOT_REVIEWED" | "IN_REVIEW" | "REVIEWED";

export interface UserRef {
  id: string;
  username: string;
}

export interface InlineDiffToken {
  kind: string;
  text: string | null;
  sub: string | null;
  add: string | null;
}

export interface InlineDiffLine {
  kind: string;
  tokens: InlineDiffToken[];
}

export interface InlineDiff {
  changes: number;
  adds: number;
  dels: number;
  lines: InlineDiffLine[];
}

export interface HymnRef {
  id: string;
  number: number;
  title: string;
}

export interface HymnBookHymnRef {
  id: string;
  number: number;
  reviewStatus: ReviewStatus;
}

export interface ReviseHymnBook {
  id: string;
  name: string;
  slug: string;
  hymns: HymnBookHymnRef[];
  nextPendingHymn: HymnRef | null;
}

export interface HymnRevision {
  id: string;
  previousStatus: string;
  newStatus: string;
  changeSummary: string;
  fieldDiff: Record<string, unknown> | null;
  revisedAt: string;
  revisedBy: UserRef | null;
}

export interface ReviseHymnAudio {
  id: string;
  url: string;
  title: string;
  waveformPeaks: number[];
  durationSeconds: number | null;
  isApproved: boolean;
  isMatch: boolean | null;
  qualityRating: number | null;
  qualityObservations: string[];
  mismatchReason: string;
  reviewedAt: string | null;
  reviewedBy: UserRef | null;
}

export interface ReviseHymn {
  id: string;
  number: number;
  title: string;
  /** Letra crua, normalizada de `HymnType.body`. */
  text: string;
  ocrText: string;
  style: string;
  repetitions: string;
  extraInstructions: string;
  offeredTo: string;
  section: string;
  receivedAt: string | null;
  reviewStatus: ReviewStatus;
  lastReviewedAt: string | null;
  lastReviewedBy: UserRef | null;
  hymnBook: ReviseHymnBook;
  inlineDiff: InlineDiff | null;
  ocrLineConfidences: number[];
  commonStyles: string[];
  commonRepetitions: string[];
  revisions: HymnRevision[];
  audios: ReviseHymnAudio[];
}

/** Forma bruta que volta do GraphQL (com `body` em vez de `text`). */
type RawHymn = Omit<ReviseHymn, "text"> & { body: string | null };

export interface ReviseHymnData {
  hymn: ReviseHymn | null;
  error: string | null;
}

export async function _loadReviseHymn(event: {
  fetch: typeof globalThis.fetch;
  params: { pk: string };
}): Promise<ReviseHymnData> {
  const response = await gqlFetch<{ hymn: RawHymn | null }>(
    event.fetch,
    GRAPHQL_URL,
    REVISE_HYMN_QUERY,
    { pk: event.params.pk },
  );

  if (response.errors?.length) {
    return { hymn: null, error: response.errors[0].message };
  }
  const raw = response.data?.hymn ?? null;
  if (!raw) {
    return { hymn: null, error: null };
  }
  const { body, ...rest } = raw;
  return { hymn: { ...rest, text: body ?? "" }, error: null };
}

export const load: PageLoad = (event) => _loadReviseHymn(event);
