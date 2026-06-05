/**
 * Marco 4.H — Ciclos 4H.7, 4H.8 e 4H.9.
 *
 * Load function + render + guard de autenticação anônima.
 */

import { redirect } from "@sveltejs/kit";
import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import { _loadNotifications } from "./+page";
import Page from "./+page.svelte";

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

function buildData(overrides: Record<string, unknown> = {}) {
  return {
    currentUser: null,
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
    unreadOnly: false,
    error: null,
    ...overrides,
  };
}

describe("notificacoes toggle 'apenas não lidas' (4H.8)", () => {
  it("mostra link 'Apenas não lidas' quando unreadOnly=false", () => {
    render(Page, { props: { data: buildData({ unreadOnly: false }) } });
    const link = screen.getByRole("link", { name: /apenas não lidas/i });
    expect(link).toHaveAttribute("href", "/notificacoes/?unread=1");
  });

  it("mostra link 'Todas' quando unreadOnly=true", () => {
    render(Page, { props: { data: buildData({ unreadOnly: true }) } });
    const link = screen.getByRole("link", { name: /^todas$/i });
    expect(link).toHaveAttribute("href", "/notificacoes/?unread=0");
  });

  it("toggle é um <a href> (sem onclick) — navegação puramente via URL", () => {
    render(Page, { props: { data: buildData({ unreadOnly: false }) } });
    const link = screen.getByRole("link", { name: /apenas não lidas/i });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("onclick")).toBeNull();
  });
});

describe("notificacoes guard de autenticação (4H.9)", () => {
  it("redirect helper do @sveltejs/kit lança objeto serializável", () => {
    try {
      throw redirect(302, "/login");
    } catch (e: unknown) {
      expect(e).toMatchObject({ status: 302, location: "/login" });
    }
  });

  it("anônimo (GraphQL error de auth) redireciona pra /login?next=/notificacoes/", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { notifications: null },
          errors: [{ message: "User must be authenticated to view notifications" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await expect(_loadNotifications({ fetch: fetchFn, url: makeUrl("") })).rejects.toMatchObject({
      status: 302,
      location: "/login?next=/notificacoes/",
    });
  });

  it("anônimo com mensagem 'permission denied' também redireciona", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { notifications: null },
          errors: [{ message: "Permission denied" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await expect(_loadNotifications({ fetch: fetchFn, url: makeUrl("?unread=1") })).rejects.toMatchObject({
      status: 302,
      location: "/login?next=/notificacoes/",
    });
  });

  it("erro HTTP não confunde com erro de auth (não redireciona)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    const result = await _loadNotifications({ fetch: fetchFn, url: makeUrl("") });
    expect(result.error).toMatch(/HTTP 500/);
  });

  it("GraphQL error que não é de auth também não redireciona", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { notifications: null },
          errors: [{ message: "Unexpected database error" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const result = await _loadNotifications({ fetch: fetchFn, url: makeUrl("") });
    expect(result.error).toBe("Unexpected database error");
  });
});
