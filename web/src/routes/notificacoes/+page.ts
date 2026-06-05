/**
 * Marco 4.H — Ciclo 4H.7.
 *
 * Load function da página de notificações. Lê `?unread=1` da URL e passa
 * `unreadOnly` pra query GraphQL `notifications`.
 */

import { GRAPHQL_URL } from "$lib/config";
import { gqlFetch } from "$lib/graphql/fetcher";
import { NOTIFICATIONS_QUERY } from "$lib/graphql/operations";

import type { PageLoad } from "./$types";

export interface NotificationItem {
  id: string;
  notificationType: string;
  title: string;
  message: string;
  link: string;
  isRead: boolean;
  createdAt: string;
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
    NOTIFICATIONS_QUERY,
    { unreadOnly },
  );
  return {
    notifications: response.data?.notifications ?? [],
    unreadOnly,
    error: response.errors?.[0]?.message ?? null,
  };
}

export const load: PageLoad = (event) => _loadNotifications(event);
