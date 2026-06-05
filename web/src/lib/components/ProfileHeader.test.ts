/**
 * Marco 4.H — Ciclo 4H.2.
 *
 * Unit tests do ProfileHeader: avatar (iniciais como fallback), nome,
 * contagens linkadas, e botão "Seguir" gateado por currentUser/isSelf.
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import ProfileHeader from "./ProfileHeader.svelte";

const ana = { id: "u1", username: "ana", email: "ana@example.com" };

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
