/**
 * Marco 4.H — Ciclos 4H.7, 4H.8 e 4H.9.
 *
 * Load function + render + guard de autenticação anônima.
 */

import { redirect } from "@sveltejs/kit";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

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

/**
 * Sub-marco 5.E — Ciclo 5E.8.
 *
 * "Marcar tudo como lido" (`markAllNotificationsRead`) e o `sender` — campo
 * novo do 5.A½ que o template Django já mostra como "De: <username>".
 */
const originalFetch = globalThis.fetch;

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetch(payload: unknown) {
  const fn = vi.fn().mockResolvedValue(jsonResponse(payload));
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

function notification(overrides: Record<string, unknown> = {}) {
  return {
    id: "n1",
    notificationType: "follow",
    title: "Novo seguidor",
    message: "joao começou a seguir você",
    link: "/perfil/joao",
    isRead: false,
    createdAt: "2025-01-01T10:00:00Z",
    sender: { id: "u2", username: "joao" },
    ...overrides,
  };
}

describe("notificacoes — remetente (5E.8)", () => {
  it("a query pede o sender de cada notificação", async () => {
    const fetchFn = fakeFetch({ data: { notifications: [] } });
    await _loadNotifications({ fetch: fetchFn, url: makeUrl("") });
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.query).toContain("sender");
  });

  it("mostra quem gerou a notificação, como o template Django", () => {
    render(Page, { props: { data: buildData({ notifications: [notification()] }) } });
    expect(screen.getByTestId("notification-sender")).toHaveTextContent(/De:\s*joao/i);
  });

  it("o remetente linka pro perfil dele", () => {
    render(Page, { props: { data: buildData({ notifications: [notification()] }) } });
    expect(screen.getByRole("link", { name: "joao" })).toHaveAttribute("href", "/perfil/joao/");
  });

  it("notificação sem sender não mostra a linha 'De:'", () => {
    render(Page, { props: { data: buildData({ notifications: [notification({ sender: null })] }) } });
    expect(screen.queryByTestId("notification-sender")).toBeNull();
  });
});

describe("notificacoes — marcar tudo como lido (5E.8)", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("mostra o botão quando existe notificação não lida", () => {
    render(Page, { props: { data: buildData({ notifications: [notification()] }) } });
    expect(screen.getByTestId("mark-all-read")).toBeInTheDocument();
  });

  it("esconde o botão quando está tudo lido", () => {
    render(Page, {
      props: { data: buildData({ notifications: [notification({ isRead: true })] }) },
    });
    expect(screen.queryByTestId("mark-all-read")).toBeNull();
  });

  it("esconde o botão quando não há notificação nenhuma", () => {
    render(Page, { props: { data: buildData({ notifications: [] }) } });
    expect(screen.queryByTestId("mark-all-read")).toBeNull();
  });

  it("chama markAllNotificationsRead", async () => {
    const fetchFn = stubFetch({ data: { markAllNotificationsRead: 1 } });
    render(Page, { props: { data: buildData({ notifications: [notification()] }) } });
    await fireEvent.click(screen.getByTestId("mark-all-read"));
    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.query).toContain("markAllNotificationsRead");
  });

  it("manda o header CSRF (mutation roda no browser)", async () => {
    document.cookie = "csrftoken=tok777";
    const fetchFn = stubFetch({ data: { markAllNotificationsRead: 1 } });
    render(Page, { props: { data: buildData({ notifications: [notification()] }) } });
    await fireEvent.click(screen.getByTestId("mark-all-read"));
    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
    expect(fetchFn.mock.calls[0][1].headers["X-CSRFToken"]).toBe("tok777");
  });

  it("marca as notificações como lidas na própria tela", async () => {
    stubFetch({ data: { markAllNotificationsRead: 1 } });
    render(Page, { props: { data: buildData({ notifications: [notification()] }) } });
    await fireEvent.click(screen.getByTestId("mark-all-read"));
    await waitFor(() =>
      expect(screen.getByTestId("notification-item")).toHaveAttribute("data-is-read", "true"),
    );
  });

  it("some com o botão depois de marcar tudo", async () => {
    stubFetch({ data: { markAllNotificationsRead: 1 } });
    render(Page, { props: { data: buildData({ notifications: [notification()] }) } });
    await fireEvent.click(screen.getByTestId("mark-all-read"));
    await waitFor(() => expect(screen.queryByTestId("mark-all-read")).toBeNull());
  });

  it("mantém as não lidas e mostra o erro quando a mutation falha", async () => {
    const fn = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    globalThis.fetch = fn as unknown as typeof fetch;
    render(Page, { props: { data: buildData({ notifications: [notification()] }) } });
    await fireEvent.click(screen.getByTestId("mark-all-read"));
    await waitFor(() => expect(screen.getByTestId("mark-all-read-error")).toBeInTheDocument());
    expect(screen.getByTestId("notification-item")).toHaveAttribute("data-is-read", "false");
  });
});
