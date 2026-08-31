/**
 * Marco 4.H — Ciclo 4H.5.
 *
 * Lista paginada de seguidores. Comportamentos:
 * - chama `userProfile(username).followers(first: 20, offset: (page-1)*20)`
 * - extrai `?page=N` do URL (default 1)
 * - renderiza nav "Anterior/Próximo" preservando username
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import { _loadFollowers } from "./+page";
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
  return new URL(`http://x/perfil/ana/seguidores${search}`);
}

describe("perfil/seguidores load function", () => {
  it("busca first=20 offset=0 sem ?page", async () => {
    const fetchFn = fakeFetch({
      data: {
        userProfile: {
          user: { id: "u1", username: "ana", email: "ana@x" },
          followersCount: 0,
          followers: [],
        },
      },
    });
    await _loadFollowers({
      fetch: fetchFn,
      params: { username: "ana" },
      url: makeUrl(""),
    });
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.variables).toEqual({ username: "ana", first: 20, offset: 0 });
  });

  it("calcula offset corretamente para ?page=3", async () => {
    const fetchFn = fakeFetch({
      data: {
        userProfile: {
          user: { id: "u1", username: "ana", email: "ana@x" },
          followersCount: 100,
          followers: [],
        },
      },
    });
    await _loadFollowers({
      fetch: fetchFn,
      params: { username: "ana" },
      url: makeUrl("?page=3"),
    });
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.variables).toEqual({ username: "ana", first: 20, offset: 40 });
  });

  it("retorna a lista de seguidores e o page atual", async () => {
    const fetchFn = fakeFetch({
      data: {
        userProfile: {
          user: { id: "u1", username: "ana", email: "ana@x" },
          followersCount: 2,
          followers: [
            { id: "u2", username: "bia", email: "b@x" },
            { id: "u3", username: "carlos", email: "c@x" },
          ],
        },
      },
    });
    const result = await _loadFollowers({
      fetch: fetchFn,
      params: { username: "ana" },
      url: makeUrl("?page=1"),
    });
    expect(result.followers).toHaveLength(2);
    expect(result.page).toBe(1);
    expect(result.username).toBe("ana");
  });

  it("page=N <= 0 cai para 1", async () => {
    const fetchFn = fakeFetch({
      data: {
        userProfile: {
          user: { id: "u1", username: "ana", email: "ana@x" },
          followersCount: 0,
          followers: [],
        },
      },
    });
    const result = await _loadFollowers({
      fetch: fetchFn,
      params: { username: "ana" },
      url: makeUrl("?page=-5"),
    });
    expect(result.page).toBe(1);
  });

  /*
   * O resolver `UserProfileType.followers` passou a exigir sessão (paridade
   * com o `@login_required` de `apps/users/views_social.py`), então esta rota
   * fecha a porta igual ao guard do `/editor/`: redireciona pro login
   * preservando o destino. A classificação do erro é a MESMA função
   * (`_isEditorAccessError`) — a mensagem que chega é PT-BR
   * ("Autenticação necessária para listar seguidores."), e um classificador
   * próprio procurando "authenticat" nunca casaria (é o bug de
   * `routes/notificacoes/+page.ts`).
   */
  it("anônimo cai no login preservando o destino", async () => {
    const fetchFn = fakeFetch({
      data: { userProfile: null },
      errors: [{ message: "Autenticação necessária para listar seguidores." }],
    });
    await expect(
      _loadFollowers({
        fetch: fetchFn,
        params: { username: "ana" },
        url: makeUrl("?page=2"),
      }),
    ).rejects.toMatchObject({
      status: 302,
      location: "/login?next=/perfil/ana/seguidores",
    });
  });

  it("erro que NÃO é de acesso continua virando mensagem na página", async () => {
    const fetchFn = fakeFetch({
      data: { userProfile: null },
      errors: [{ message: "Falha ao consultar o banco." }],
    });
    const result = await _loadFollowers({
      fetch: fetchFn,
      params: { username: "ana" },
      url: makeUrl(""),
    });
    expect(result.error).toBe("Falha ao consultar o banco.");
    expect(result.followers).toEqual([]);
  });

  it("falha de transporte (HTTP 5xx) não é confundida com falta de sessão", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 503 }));
    const result = await _loadFollowers({
      fetch: fetchFn,
      params: { username: "ana" },
      url: makeUrl(""),
    });
    expect(result.error).toMatch(/^HTTP /);
  });
});

function buildData(overrides: Record<string, unknown> = {}) {
  return {
    currentUser: null,
    editorPendingCount: 0,
    username: "ana",
    followers: [
      { id: "u2", username: "bia", email: "b@x" },
      { id: "u3", username: "carlos", email: "c@x" },
    ],
    followersCount: 2,
    page: 1,
    pageSize: 20,
    error: null,
    ...overrides,
  };
}

describe("perfil/seguidores página", () => {
  it("renderiza um item por seguidor", () => {
    render(Page, { props: { data: buildData() } });
    expect(screen.getAllByTestId("follower-item")).toHaveLength(2);
    expect(screen.getByText("bia")).toBeInTheDocument();
    expect(screen.getByText("carlos")).toBeInTheDocument();
  });

  it("cada item linka pro perfil do seguidor", () => {
    render(Page, { props: { data: buildData() } });
    const link = screen.getByRole("link", { name: /bia/i });
    expect(link).toHaveAttribute("href", "/perfil/bia");
  });

  it("mostra link 'Próximo' quando page atual está cheia (count > page*size)", () => {
    render(Page, {
      props: {
        data: buildData({
          followers: Array.from({ length: 20 }, (_, i) => ({
            id: `u${i}`,
            username: `user${i}`,
            email: `${i}@x`,
          })),
          followersCount: 50,
          page: 1,
        }),
      },
    });
    expect(screen.getByRole("link", { name: /próximo/i })).toHaveAttribute(
      "href",
      "/perfil/ana/seguidores?page=2",
    );
  });

  it("mostra link 'Anterior' quando page > 1", () => {
    render(Page, {
      props: {
        data: buildData({
          page: 3,
          followers: [{ id: "u2", username: "bia", email: "b@x" }],
          followersCount: 50,
        }),
      },
    });
    expect(screen.getByRole("link", { name: /anterior/i })).toHaveAttribute(
      "href",
      "/perfil/ana/seguidores?page=2",
    );
  });

  it("oculta 'Anterior' na página 1", () => {
    render(Page, { props: { data: buildData({ page: 1 }) } });
    expect(screen.queryByRole("link", { name: /anterior/i })).toBeNull();
  });

  it("oculta 'Próximo' quando não há mais páginas", () => {
    render(Page, {
      props: {
        data: buildData({
          page: 1,
          followers: [{ id: "u2", username: "bia", email: "b@x" }],
          followersCount: 1,
        }),
      },
    });
    expect(screen.queryByRole("link", { name: /próximo/i })).toBeNull();
  });

  it("renderiza estado vazio quando não há seguidores", () => {
    render(Page, {
      props: { data: buildData({ followers: [], followersCount: 0 }) },
    });
    expect(screen.getByTestId("followers-empty")).toBeInTheDocument();
  });
});
