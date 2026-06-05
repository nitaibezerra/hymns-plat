/**
 * Marco 4.H — Ciclo 4H.6.
 *
 * Lista paginada de quem o usuário está seguindo. Mesmo padrão da rota
 * /seguidores (4H.5).
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import { _loadFollowing } from "./+page";
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
  return new URL(`http://x/perfil/ana/seguindo${search}`);
}

describe("perfil/seguindo load function", () => {
  it("busca first=20 offset=0 sem ?page", async () => {
    const fetchFn = fakeFetch({
      data: {
        userProfile: {
          user: { id: "u1", username: "ana", email: "ana@x" },
          followingCount: 0,
          following: [],
        },
      },
    });
    await _loadFollowing({
      fetch: fetchFn,
      params: { username: "ana" },
      url: makeUrl(""),
    });
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.variables).toEqual({ username: "ana", first: 20, offset: 0 });
  });

  it("calcula offset corretamente para ?page=2", async () => {
    const fetchFn = fakeFetch({
      data: {
        userProfile: {
          user: { id: "u1", username: "ana", email: "ana@x" },
          followingCount: 50,
          following: [],
        },
      },
    });
    await _loadFollowing({
      fetch: fetchFn,
      params: { username: "ana" },
      url: makeUrl("?page=2"),
    });
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.variables).toEqual({ username: "ana", first: 20, offset: 20 });
  });

  it("retorna a lista de seguindo e o page atual", async () => {
    const fetchFn = fakeFetch({
      data: {
        userProfile: {
          user: { id: "u1", username: "ana", email: "ana@x" },
          followingCount: 2,
          following: [
            { id: "u2", username: "bia", email: "b@x" },
            { id: "u3", username: "carlos", email: "c@x" },
          ],
        },
      },
    });
    const result = await _loadFollowing({
      fetch: fetchFn,
      params: { username: "ana" },
      url: makeUrl("?page=1"),
    });
    expect(result.following).toHaveLength(2);
    expect(result.page).toBe(1);
    expect(result.username).toBe("ana");
  });
});

function buildData(overrides: Record<string, unknown> = {}) {
  return {
    username: "ana",
    following: [
      { id: "u2", username: "bia", email: "b@x" },
      { id: "u3", username: "carlos", email: "c@x" },
    ],
    followingCount: 2,
    page: 1,
    pageSize: 20,
    error: null,
    ...overrides,
  };
}

describe("perfil/seguindo página", () => {
  it("renderiza um item por usuário seguido", () => {
    render(Page, { props: { data: buildData() } });
    expect(screen.getAllByTestId("following-item")).toHaveLength(2);
  });

  it("cada item linka pro perfil do usuário seguido", () => {
    render(Page, { props: { data: buildData() } });
    const link = screen.getByRole("link", { name: /bia/i });
    expect(link).toHaveAttribute("href", "/perfil/bia");
  });

  it("mostra link 'Próximo' quando há mais páginas", () => {
    render(Page, {
      props: {
        data: buildData({
          following: Array.from({ length: 20 }, (_, i) => ({
            id: `u${i}`,
            username: `user${i}`,
            email: `${i}@x`,
          })),
          followingCount: 50,
          page: 1,
        }),
      },
    });
    expect(screen.getByRole("link", { name: /próximo/i })).toHaveAttribute(
      "href",
      "/perfil/ana/seguindo?page=2",
    );
  });

  it("mostra link 'Anterior' quando page > 1", () => {
    render(Page, {
      props: {
        data: buildData({
          page: 2,
          following: [{ id: "u2", username: "bia", email: "b@x" }],
          followingCount: 30,
        }),
      },
    });
    expect(screen.getByRole("link", { name: /anterior/i })).toHaveAttribute(
      "href",
      "/perfil/ana/seguindo?page=1",
    );
  });

  it("renderiza estado vazio quando não há seguindo", () => {
    render(Page, {
      props: { data: buildData({ following: [], followingCount: 0 }) },
    });
    expect(screen.getByTestId("following-empty")).toBeInTheDocument();
  });
});
