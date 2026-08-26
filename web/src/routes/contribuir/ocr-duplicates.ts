/**
 * Sub-marco 5.F — Ciclo 5F.11.
 *
 * Acesso a `Query.ocrDuplicates(taskId)`, o resolver que chama
 * `apps/hymns/disambiguation.py::find_duplicates_with_content` com os
 * thresholds do fluxo Django (nome 0.7 / conteúdo 0.8). A regra de
 * similaridade **não** é reimplementada aqui.
 *
 * Degradação deliberada: qualquer falha na consulta (rede, HTTP, ou o
 * resolver ainda não existir — ciclos 5F.1–5F.3 são backend, fora do escopo
 * desta frente) devolve "sem duplicatas" com `unavailable: true`. O Django só
 * desvia pra desambiguação **quando encontra** duplicata, então "não tem" e
 * "não sei" levam ao mesmo passo: a conferência. Melhor seguir o fluxo do que
 * travar o usuário numa tela de progresso.
 */

import { GRAPHQL_URL } from "$lib/config";
import { gqlFetch } from "$lib/graphql/fetcher";
import { OCR_DUPLICATES_QUERY } from "$lib/graphql/operations/contribuir";

import type { DuplicateBook, SimilarBook } from "$lib/components/contribuir/duplicates";

export interface OcrDuplicates {
  exactMatch: DuplicateBook | null;
  similar: SimilarBook[];
  hasDuplicates: boolean;
  /** `true` quando a consulta não pôde ser feita (backend sem o resolver). */
  unavailable: boolean;
}

export const NO_DUPLICATES: OcrDuplicates = {
  exactMatch: null,
  similar: [],
  hasDuplicates: false,
  unavailable: false,
};

const UNAVAILABLE: OcrDuplicates = { ...NO_DUPLICATES, unavailable: true };

interface RawBook {
  id: string;
  name: string;
  slug: string;
  ownerName: string;
  stats?: { hymnsTotal?: number } | null;
}

interface RawDuplicates {
  exactMatch: RawBook | null;
  highConfidence: { nameScore: number; contentScore: number; hymnbook: RawBook }[] | null;
}

function toBook(raw: RawBook): DuplicateBook {
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    ownerName: raw.ownerName,
    hymnsTotal: raw.stats?.hymnsTotal ?? 0,
  };
}

export async function fetchOcrDuplicates(
  fetchFn: typeof globalThis.fetch,
  taskId: string,
): Promise<OcrDuplicates> {
  let response;
  try {
    response = await gqlFetch<{ ocrDuplicates: RawDuplicates | null }>(
      fetchFn,
      GRAPHQL_URL,
      OCR_DUPLICATES_QUERY,
      { taskId },
    );
  } catch {
    return UNAVAILABLE;
  }

  if (response.errors?.length) return UNAVAILABLE;

  const raw = response.data?.ocrDuplicates;
  if (!raw) return NO_DUPLICATES;

  const exactMatch = raw.exactMatch ? toBook(raw.exactMatch) : null;
  const similar: SimilarBook[] = (raw.highConfidence ?? []).map((entry) => ({
    hymnbook: toBook(entry.hymnbook),
    nameScore: entry.nameScore,
    contentScore: entry.contentScore,
  }));

  return {
    exactMatch,
    similar,
    hasDuplicates: exactMatch !== null || similar.length > 0,
    unavailable: false,
  };
}

export type { DuplicateBook, SimilarBook };
