/**
 * Marco 4.H — Ciclos 4H.7 e 4H.9 · Sub-marco 5.E — Ciclo 5E.8.
 *
 * Load function da página de notificações. Lê `?unread=1` da URL e passa
 * `unreadOnly` pra query GraphQL `notifications`.
 *
 * A query mora em `operations/quick-review.ts` (arquivo desta frente) e não no
 * barril `operations.ts`, que várias frentes editam em paralelo. É a mesma
 * query de antes mais o `sender`.
 *
 * O resolver `Query.notifications` exige sessão autenticada (gateado em
 * 4.A); para usuários anônimos devolve um GraphQL error. Neste caso
 * redirecionamos para /login preservando o destino — paridade com o
 * comportamento Django de `@login_required`
 * (`apps/users/views_social.py::notifications_list`).
 *
 * **Frente B — o classificador local nunca disparava.** Ele procurava a
 * substring inglesa `authenticat`; a mensagem real do resolver é PT-BR
 * ("Autenticação necessária para listar notificações.") e `autenticação` não
 * contém `authenticat` — o `ç` quebra o casamento. Resultado: anônimo em
 * `/notificacoes` via "Falha ao carregar notificações: …" em vez do login que
 * este cabeçalho promete desde o 4H.9.
 *
 * O conserto não é remendar a substring: é reusar `_isEditorAccessError` de
 * `routes/editor/+layout.ts`, o classificador do repo que lista as formas
 * PT-BR reais (`permissão`, `autenticação`) e as inglesas, mais
 * `_editorLoginRedirect` pro destino. Mesmo precedente que
 * `/perfil/[username]/seguidores/` e `/seguindo/` já seguem. Com um único
 * classificador, uma mensagem nova do backend passa a ser reconhecida por
 * todas as rotas de uma vez.
 */

import { GRAPHQL_URL } from "$lib/config";
import { gqlFetch } from "$lib/graphql/fetcher";
import { NOTIFICATIONS_WITH_SENDER_QUERY } from "$lib/graphql/operations/quick-review";
import { redirect } from "@sveltejs/kit";

import { _editorLoginRedirect, _isEditorAccessError } from "../editor/+layout";

import type { PageLoad } from "./$types";

export interface NotificationSender {
  id: string;
  username: string;
}

export interface NotificationItem {
  id: string;
  notificationType: string;
  title: string;
  message: string;
  link: string;
  isRead: boolean;
  createdAt: string;
  /**
   * 5E.8 — quem gerou a notificação. Campo do 5.A½; o template Django já o
   * mostrava ("De: <username>") e a SPA estava sem ele. `null` em
   * notificações do sistema, que não têm remetente.
   */
  sender: NotificationSender | null;
}

export interface NotificationsData {
  notifications: NotificationItem[];
  unreadOnly: boolean;
  error: string | null;
}

function parseUnreadOnly(raw: string | null): boolean {
  return raw === "1" || raw === "true";
}

export async function _loadNotifications(event: {
  fetch: typeof globalThis.fetch;
  url: URL;
}): Promise<NotificationsData> {
  const unreadOnly = parseUnreadOnly(event.url.searchParams.get("unread"));
  const response = await gqlFetch<{ notifications: NotificationItem[] | null }>(
    event.fetch,
    GRAPHQL_URL,
    NOTIFICATIONS_WITH_SENDER_QUERY,
    { unreadOnly },
  );

  // 4H.9: anônimo recebe GraphQLError → redireciona pra login (preserva
  // `next` para o redirect pós-login). Erros HTTP (5xx) e GraphQL errors
  // não relacionados a auth não disparam o redirect — eles caem no
  // campo `error` para a página exibir uma mensagem.
  //
  // `HTTP nnn` vem do `gqlFetch` para falha de transporte e fica FORA do
  // redirect: backend caído não é falta de login, e mandar o visitante pro
  // login esconderia a queda.
  const errorMessage = response.errors?.[0]?.message;
  if (errorMessage && !errorMessage.startsWith("HTTP ") && _isEditorAccessError(errorMessage)) {
    throw redirect(302, _editorLoginRedirect(event.url.pathname));
  }

  return {
    notifications: response.data?.notifications ?? [],
    unreadOnly,
    error: errorMessage ?? null,
  };
}

export const load: PageLoad = (event) => _loadNotifications(event);
