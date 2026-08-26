/**
 * Marco 4.H — Ciclo 4H.2.
 *
 * Unit tests do ProfileHeader: avatar (iniciais como fallback), nome,
 * contagens linkadas, e botão "Seguir" gateado por currentUser/isSelf.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

import ProfileHeader from "./ProfileHeader.svelte";

const ana = { id: "u1", username: "ana", email: "ana@example.com" };

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

describe("ProfileHeader", () => {
  it("renderiza nome do usuário", () => {
    render(ProfileHeader, {
      props: { user: ana, followersCount: 0, followingCount: 0, currentUser: null },
    });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/ana/i);
  });

  it("renderiza avatar com iniciais maiúsculas (fallback)", () => {
    render(ProfileHeader, {
      props: { user: ana, followersCount: 0, followingCount: 0, currentUser: null },
    });
    expect(screen.getByTestId("profile-avatar")).toHaveTextContent("AN");
  });

  it("renderiza contagens linkando pra seguidores/seguindo", () => {
    render(ProfileHeader, {
      props: { user: ana, followersCount: 42, followingCount: 7, currentUser: null },
    });
    expect(screen.getByTestId("profile-followers-count")).toHaveTextContent("42");
    expect(screen.getByTestId("profile-following-count")).toHaveTextContent("7");
    const followersLink = screen.getByRole("link", { name: "42" });
    expect(followersLink).toHaveAttribute("href", "/perfil/ana/seguidores");
    const followingLink = screen.getByRole("link", { name: "7" });
    expect(followingLink).toHaveAttribute("href", "/perfil/ana/seguindo");
  });

  it("mostra botão Seguir quando autenticado e não-self", () => {
    render(ProfileHeader, {
      props: {
        user: ana,
        followersCount: 0,
        followingCount: 0,
        currentUser: { id: "u2", username: "joao", email: "j@x" },
      },
    });
    expect(screen.getByRole("button", { name: /seguir/i })).toBeInTheDocument();
  });

  it("oculta botão Seguir quando é o próprio perfil", () => {
    render(ProfileHeader, {
      props: { user: ana, followersCount: 0, followingCount: 0, currentUser: ana },
    });
    expect(screen.queryByRole("button", { name: /seguir/i })).toBeNull();
  });

  it("oculta botão Seguir quando anônimo", () => {
    render(ProfileHeader, {
      props: { user: ana, followersCount: 0, followingCount: 0, currentUser: null },
    });
    expect(screen.queryByRole("button", { name: /seguir/i })).toBeNull();
  });
});

/**
 * Sub-marco 5.E — Ciclo 5E.7.
 *
 * O botão do Marco 4 era inerte de propósito. Agora ele chama
 * `followUser`/`unfollowUser` com UI otimista: o estado vira NA HORA e volta
 * atrás se o servidor recusar.
 *
 * O projeto não usa o cache do urql (as loads têm `gqlFetch` próprio), então
 * o otimismo é estado local + rollback, não `optimisticResponse`.
 */
const joao = { id: "u2", username: "joao", email: "j@x" };

function followSetup(props: Record<string, unknown> = {}) {
  return render(ProfileHeader, {
    props: {
      user: ana,
      followersCount: 10,
      followingCount: 0,
      currentUser: joao,
      ...props,
    },
  });
}

function followBtn() {
  return screen.getByTestId("follow-btn");
}

/** Promessa que só resolve quando o teste mandar — congela a UI no otimismo. */
function deferredFetch() {
  let release: (value: Response) => void = () => {};
  const fn = vi.fn().mockReturnValue(new Promise<Response>((r) => (release = r)));
  globalThis.fetch = fn as unknown as typeof fetch;
  return { fn, release: (payload: unknown) => release(jsonResponse(payload)) };
}

function profilePayload(field: string, followersCount: number, isFollowed: boolean) {
  return {
    data: {
      [field]: {
        __typename: "UserProfileType",
        followersCount,
        isFollowedByCurrentUser: isFollowed,
      },
    },
  };
}

describe("ProfileHeader — seguir/deixar de seguir (5E.7)", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("nasce em 'Seguir' quando ainda não segue", () => {
    followSetup({ isFollowedByCurrentUser: false });
    expect(followBtn()).toHaveTextContent(/^Seguir$/);
    expect(followBtn()).toHaveAttribute("aria-pressed", "false");
  });

  it("nasce em 'Seguindo' quando isFollowedByCurrentUser é true", () => {
    followSetup({ isFollowedByCurrentUser: true });
    expect(followBtn()).toHaveTextContent(/seguindo/i);
    expect(followBtn()).toHaveAttribute("aria-pressed", "true");
  });

  it("chama followUser com o username do perfil", async () => {
    const fetchFn = stubFetch(profilePayload("followUser", 11, true));
    followSetup({ isFollowedByCurrentUser: false });
    await fireEvent.click(followBtn());
    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.query).toContain("followUser");
    expect(body.variables).toEqual({ username: "ana" });
  });

  it("chama unfollowUser quando já segue", async () => {
    const fetchFn = stubFetch(profilePayload("unfollowUser", 9, false));
    followSetup({ isFollowedByCurrentUser: true });
    await fireEvent.click(followBtn());
    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.query).toContain("unfollowUser");
  });

  it("vira 'Seguindo' ANTES da resposta do servidor (otimismo)", async () => {
    const { release } = deferredFetch();
    followSetup({ isFollowedByCurrentUser: false });
    await fireEvent.click(followBtn());
    expect(followBtn()).toHaveTextContent(/seguindo/i);
    release(profilePayload("followUser", 11, true));
  });

  it("incrementa a contagem de seguidores na hora", async () => {
    const { release } = deferredFetch();
    followSetup({ isFollowedByCurrentUser: false });
    await fireEvent.click(followBtn());
    expect(screen.getByTestId("profile-followers-count")).toHaveTextContent("11");
    release(profilePayload("followUser", 11, true));
  });

  it("decrementa a contagem ao deixar de seguir", async () => {
    const { release } = deferredFetch();
    followSetup({ isFollowedByCurrentUser: true });
    await fireEvent.click(followBtn());
    expect(screen.getByTestId("profile-followers-count")).toHaveTextContent("9");
    release(profilePayload("unfollowUser", 9, false));
  });

  it("adota a contagem que o servidor devolveu (a nossa era só um palpite)", async () => {
    stubFetch(profilePayload("followUser", 42, true));
    followSetup({ isFollowedByCurrentUser: false });
    await fireEvent.click(followBtn());
    await waitFor(() =>
      expect(screen.getByTestId("profile-followers-count")).toHaveTextContent("42"),
    );
  });

  it("desfaz o otimismo quando o servidor recusa", async () => {
    stubFetch({
      data: {
        followUser: {
          __typename: "PermissionDeniedError",
          message: "Você não tem permissão para realizar essa ação.",
        },
      },
    });
    followSetup({ isFollowedByCurrentUser: false });
    await fireEvent.click(followBtn());
    await waitFor(() => expect(followBtn()).toHaveTextContent(/^Seguir$/));
    expect(screen.getByTestId("profile-followers-count")).toHaveTextContent("10");
  });

  it("mostra o erro do servidor depois do rollback", async () => {
    stubFetch({
      data: {
        followUser: { __typename: "NotFoundError", message: "Usuário não encontrado." },
      },
    });
    followSetup({ isFollowedByCurrentUser: false });
    await fireEvent.click(followBtn());
    await waitFor(() =>
      expect(screen.getByTestId("follow-error")).toHaveTextContent("Usuário não encontrado."),
    );
  });

  it("desfaz o otimismo quando a rede falha", async () => {
    const fn = vi.fn().mockResolvedValue(new Response("boom", { status: 500 }));
    globalThis.fetch = fn as unknown as typeof fetch;
    followSetup({ isFollowedByCurrentUser: true });
    await fireEvent.click(followBtn());
    await waitFor(() => expect(followBtn()).toHaveTextContent(/seguindo/i));
    expect(screen.getByTestId("profile-followers-count")).toHaveTextContent("10");
  });

  it("ignora cliques enquanto a mutation está em voo", async () => {
    const { fn, release } = deferredFetch();
    followSetup({ isFollowedByCurrentUser: false });
    await fireEvent.click(followBtn());
    await fireEvent.click(followBtn());
    expect(fn).toHaveBeenCalledTimes(1);
    release(profilePayload("followUser", 11, true));
  });

  it("manda o header CSRF (mutation roda no browser)", async () => {
    document.cookie = "csrftoken=tok999";
    const fetchFn = stubFetch(profilePayload("followUser", 11, true));
    followSetup({ isFollowedByCurrentUser: false });
    await fireEvent.click(followBtn());
    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
    expect(fetchFn.mock.calls[0][1].headers["X-CSRFToken"]).toBe("tok999");
  });
});
