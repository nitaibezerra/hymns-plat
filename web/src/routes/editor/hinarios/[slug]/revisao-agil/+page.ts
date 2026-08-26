/**
 * Sub-marco 5.E — Ciclo 5E.1.
 *
 * Load da tela 07c · Revisão ágil. A rota mora sob `/editor/`, então herda o
 * guard de `isEditor` do `+layout.ts` do workspace — aqui só tratamos as
 * falhas de dados, com os mesmos três desfechos do resto do 5.B/5.D:
 * sem permissão → login; slug inexistente → 404; backend com problema → 503.
 *
 * Seleção do hino corrente: `?h=<number>` como no Django
 * (`editor_quick_review`), mas o default é o primeiro INCOMPLETO em vez do
 * primeiro da lista. No monolito essa escolha vive numa segunda view
 * (`editor_next_incomplete`), que é a porta de entrada real da revisão básica
 * e redireciona pro `quick_review?h=<primeiro incompleto>`. A SPA junta as
 * duas numa rota só: o default do `?h=` ausente já é o destino daquele
 * redirect. Um `?h=` explícito é sempre respeitado, mesmo apontando pra um
 * hino já completo — é assim que o editor volta pra revisar de novo.
 */

import { GRAPHQL_URL } from "$lib/config";
import { gqlFetch } from "$lib/graphql/fetcher";
import { QUICK_REVIEW_QUERY } from "$lib/graphql/operations/quick-review";
import { error, redirect } from "@sveltejs/kit";

import { _editorLoginRedirect, _isEditorAccessError } from "../../../+layout";

import type { PageLoad } from "./$types";

export interface QuickReviewHymn {
  id: string;
  number: number;
  title: string;
  body: string;
  style: string;
  repetitions: string;
}

export interface QuickReviewHymnbook {
  id: string;
  name: string;
  slug: string;
}

export interface QuickReviewData {
  hymnbook: QuickReviewHymnbook;
  hymns: QuickReviewHymn[];
  current: QuickReviewHymn | null;
  /**
   * Todo hino do hinário já tem estilo E repetições. Hinário vazio é `false`:
   * "não há o que revisar" é outro estado, com outra mensagem (o Django
   * também os separa).
   */
  allComplete: boolean;
}

/**
 * "Incompleto" = sem estilo OU sem repetições. Mesma condição do
 * `Q(style="") | Q(repetitions="")` que o backend usa em
 * `editor_quick_review` e em `HymnBookType.nextIncompleteHymn`.
 */
export function _isIncomplete(hymn: QuickReviewHymn): boolean {
  return hymn.style.trim() === "" || hymn.repetitions.trim() === "";
}

/**
 * Resolve o hino corrente. `requested` é o `?h=` cru da URL.
 *
 * Ordem de preferência: número pedido → primeiro incompleto → primeiro da
 * lista. O último degrau existe pro caso "hinário inteiro completo", em que a
 * tela ainda precisa de algo pra mostrar antes de exibir a conclusão (5E.4).
 */
export function _pickCurrent(
  hymns: QuickReviewHymn[],
  requested: string | null,
): QuickReviewHymn | null {
  if (requested !== null && requested.trim() !== "") {
    const wanted = Number(requested);
    if (Number.isInteger(wanted)) {
      const match = hymns.find((h) => h.number === wanted);
      if (match) return match;
    }
  }
  return hymns.find(_isIncomplete) ?? hymns[0] ?? null;
}

export async function _loadQuickReview(event: {
  fetch: typeof globalThis.fetch;
  params: { slug: string };
  url: URL;
}): Promise<QuickReviewData> {
  const { slug } = event.params;

  const response = await gqlFetch<{
    hymnbook: (QuickReviewHymnbook & { hymns: QuickReviewHymn[] }) | null;
  }>(event.fetch, GRAPHQL_URL, QUICK_REVIEW_QUERY, { slug });

  const errorMessage = response.errors?.[0]?.message;
  if (errorMessage) {
    if (!errorMessage.startsWith("HTTP ") && _isEditorAccessError(errorMessage)) {
      throw redirect(302, _editorLoginRedirect(`/editor/hinarios/${slug}/revisao-agil/`));
    }
    throw error(503, "Não foi possível carregar o hinário agora. Tente novamente em instantes.");
  }

  const raw = response.data?.hymnbook ?? null;
  if (!raw) {
    throw error(404, "Hinário não encontrado.");
  }

  const { hymns: rawHymns, ...hymnbook } = raw;
  // O resolver já ordena por número, mas a tela depende dessa ordem pros
  // links anterior/próximo (5E.5) — ordenar aqui torna a dependência local.
  const hymns = [...(rawHymns ?? [])].sort((a, b) => a.number - b.number);

  return {
    hymnbook,
    hymns,
    current: _pickCurrent(hymns, event.url.searchParams.get("h")),
    allComplete: hymns.length > 0 && !hymns.some(_isIncomplete),
  };
}

export const load: PageLoad = (event) => _loadQuickReview(event);
