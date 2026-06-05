/**
 * Marco 4.H — Ciclo 4H.7.
 *
 * Load function da página de notificações: lê `?unread=1` da URL e
 * passa `unreadOnly` pra query GraphQL `notifications`.
 */

import { describe, expect, it, vi } from "vitest";

import { _loadNotifications } from "./+page";

function fakeFetch<T>(payload: T) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function makeUrl(search: string) {
  return new URL(`http://x/notificacoes/${search}`);
}

describe("notificacoes load function (4H.7)", () => {
  it("busca notifications(unreadOnly: false) por default", async () => {
    const fetchFn = fakeFetch({ data: { notifications: [] } });
    await _loadNotifications({ fetch: fetchFn, url: makeUrl("") });
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.variables).toEqual({ unreadOnly: false });
  });

  it("busca notifications(unreadOnly: true) com ?unread=1", async () => {
    const fetchFn = fakeFetch({ data: { notifications: [] } });
    await _loadNotifications({ fetch: fetchFn, url: makeUrl("?unread=1") });
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.variables).toEqual({ unreadOnly: true });
  });

  it("retorna a lista de notificações e flag unreadOnly", async () => {
    const fetchFn = fakeFetch({
      data: {
        notifications: [
          {
            id: "n1",
            notificationType: "follow",
            title: "Novo seguidor",
            message: "joao começou a seguir você",
            link: "/perfil/joao",
            isRead: false,
            createdAt: "2025-01-01T10:00:00Z",
          },
        ],
      },
    });
    const result = await _loadNotifications({ fetch: fetchFn, url: makeUrl("?unread=1") });
    expect(result.notifications).toHaveLength(1);
    expect(result.unreadOnly).toBe(true);
  });

  it("propaga erro HTTP via campo error", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    const result = await _loadNotifications({ fetch: fetchFn, url: makeUrl("") });
    expect(result.error).toMatch(/HTTP 500/);
  });
});
