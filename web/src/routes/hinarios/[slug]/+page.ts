/**
 * Marco 4.D — Ciclo 4D.1.
 *
 * Load function do detalhe do hinário. Recebe `slug` via params e `mode` via
 * searchParams. Valida `mode` contra whitelist `[indice, corrido, carrossel]`;
 * modo inválido cai para `indice`. Modes são URL-driven (não JS-toggled), o que
 * permite deep-link e back/forward navegáveis (decisão herdada do monolito).
 */

import { GRAPHQL_URL } from "$lib/config";
import { gqlFetch } from "$lib/graphql/fetcher";
import { HYMNBOOK_DETAIL_QUERY } from "$lib/graphql/operations";

import type { PageLoad } from "./$types";

export type HymnbookMode = "indice" | "corrido" | "carrossel";

const VALID_MODES: ReadonlyArray<HymnbookMode> = ["indice", "corrido", "carrossel"];

export interface HymnSummary {
  id: string;
  number: number;
  title: string;
  body: string | null;
  /** Estilo canônico (Marcha/Valsa/Mazurca…). Vai à direita, no índice. */
  style: string;
  /** Agrupador do índice. Vazio quando o hinário não usa seções. */
  section: string;
  /**
   * Decide entre ▶ e `⊘` na linha do índice.
   *
   * Booleano dedicado em vez de `audios { id }` porque o índice de "O
   * Cruzeirinho" tem 160 linhas, e pedir a lista por hino são 160 subconsultas
   * para responder um sim-ou-não.
   */
  hasApprovedAudio: boolean;
}

export interface HymnbookDetailStats {
  hymnsTotal: number;
  audiosApproved: number;
}

export interface HymnbookDetail {
  id: string;
  name: string;
  slug: string;
  isPublished: boolean;
  /* Campos do hero, portados na Fase 4 da paridade visual — ver
     `templates/hymns/hymnbook_detail.html`. */
  introName: string | null;
  ownerName: string | null;
  description: string | null;
  coverImage: string | null;
  displayAccent: string | null;
  stats: HymnbookDetailStats;
  hymns: HymnSummary[];
}

export interface HymnbookDetailData {
  hymnbook: HymnbookDetail | null;
  mode: HymnbookMode;
  error: string | null;
}

export function _resolveMode(raw: string | null | undefined): HymnbookMode {
  if (!raw) return "indice";
  return (VALID_MODES as readonly string[]).includes(raw) ? (raw as HymnbookMode) : "indice";
}

export async function _loadHymnbook(event: {
  fetch: typeof globalThis.fetch;
  params: { slug: string };
  url: URL;
}): Promise<HymnbookDetailData> {
  const mode = _resolveMode(event.url.searchParams.get("mode"));

  const response = await gqlFetch<{ hymnbook: HymnbookDetail | null }>(
    event.fetch,
    GRAPHQL_URL,
    HYMNBOOK_DETAIL_QUERY,
    { slug: event.params.slug },
  );

  return {
    hymnbook: response.data?.hymnbook ?? null,
    mode,
    error: response.errors?.[0]?.message ?? null,
  };
}

export const load: PageLoad = (event) => _loadHymnbook(event);
