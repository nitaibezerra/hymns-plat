/**
 * Marco 4.B — Ciclo 4B.7.
 *
 * Load function global do shell. Roda em SSR + CSR.
 *
 * Sobre a sessão: no browser é `credentials: 'include'` que carrega o cookie.
 * Em SSR quem carrega é o `handleFetch` de `src/hooks.server.ts` — o
 * `event.fetch` do SvelteKit, sozinho, só repassa cookie quando o Django está
 * no mesmo hostname da app, o que é verdade em dev e falso em produção
 * (`app.` vs `api.`). Era por isso que o header nascia "Entrar" mesmo com
 * sessão válida e só a hidratação corrigia.
 *
 * Busca o `currentUser` do GraphQL e propaga `{ currentUser }` para todas
 * as páginas. Erros são engolidos (currentUser = null) porque a UI deve
 * funcionar como anônima quando o backend está com problemas — não faz
 * sentido derrubar o shell inteiro por causa do header.
 */

import { GRAPHQL_URL } from "$lib/config";
import { gqlFetch } from "$lib/graphql/fetcher";
import { CURRENT_USER_QUERY } from "$lib/graphql/operations";

import type { LayoutLoad } from "./$types";

export interface LayoutUser {
  id: string;
  username: string;
  email: string | null;
  /** Acesso ao workspace editorial — governa a CTA "Fila de revisão". */
  isEditor: boolean;
}

export interface LayoutData {
  currentUser: LayoutUser | null;
  /**
   * Badge da CTA editorial: hinários com ao menos um hino não revisado.
   *
   * Vem junto do `currentUser` numa consulta só. O monolito pega o mesmo número
   * de um context processor que roda em TODA request
   * (`apps.hymns.context_processors.editor_workspace`), então o custo é o
   * mesmo — e o resolver devolve 0 pra anônimo em vez de erro, justamente pra
   * poder ser pedido aqui sem derrubar o shell de quem não está logado.
   */
  editorPendingCount: number;
}

const VAZIO: LayoutData = { currentUser: null, editorPendingCount: 0 };

export async function _loadLayout(event: { fetch: typeof globalThis.fetch }): Promise<LayoutData> {
  try {
    const response = await gqlFetch<{
      currentUser: LayoutUser | null;
      editorPendingBookCount: number;
    }>(event.fetch, GRAPHQL_URL, CURRENT_USER_QUERY);
    if (response.errors?.length) {
      return VAZIO;
    }
    return {
      currentUser: response.data?.currentUser ?? null,
      editorPendingCount: response.data?.editorPendingBookCount ?? 0,
    };
  } catch {
    return VAZIO;
  }
}

export const load: LayoutLoad = (event) => _loadLayout(event);
