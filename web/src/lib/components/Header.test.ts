/**
 * Marco 4.B — Ciclo 4B.4.
 *
 * Header renderiza brand "hinária", links de nav ("Hinários", "Buscar"),
 * botão de tema. Quando recebe prop `currentUser`, mostra avatar+username;
 * sem user, mostra link "Entrar".
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import Header from "./Header.svelte";

describe("Header", () => {
  it("renderiza a brand hinária", () => {
    render(Header, { props: { currentUser: null } });
    expect(screen.getByText(/hinária/i)).toBeInTheDocument();
  });

  it("renderiza os links principais de navegação", () => {
    render(Header, { props: { currentUser: null } });
    expect(screen.getByRole("link", { name: /hinários/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /buscar/i })).toBeInTheDocument();
  });

  it("aponta 'Buscar' pra /busca, a rota que existe de fato", () => {
    render(Header, { props: { currentUser: null } });
    const link = screen.getByRole("link", { name: /buscar/i });
    expect(link.getAttribute("href")).toBe("/busca");
  });

  it("aponta 'Hinários' pra /hinarios", () => {
    render(Header, { props: { currentUser: null } });
    expect(
      screen.getByRole("link", { name: /hinários/i }).getAttribute("href"),
    ).toBe("/hinarios");
  });

  it("renderiza o botão de alternância de tema", () => {
    render(Header, { props: { currentUser: null } });
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
  });

  it("mostra link \"Entrar\" quando não há usuário autenticado", () => {
    render(Header, { props: { currentUser: null } });
    expect(screen.getByRole("link", { name: /entrar/i })).toBeInTheDocument();
    expect(screen.queryByTestId("user-avatar")).toBeNull();
  });

  it("mostra avatar e username quando há usuário autenticado", () => {
    render(Header, {
      props: {
        currentUser: { id: "u1", username: "ana", email: "ana@example.com" },
      },
    });
    expect(screen.getByTestId("user-avatar")).toBeInTheDocument();
    expect(screen.getByTestId("user-avatar")).toHaveTextContent(/ana/i);
    expect(screen.queryByRole("link", { name: /entrar/i })).toBeNull();
  });

  it("aponta o avatar pra /perfil/<username>, nao pra /perfil pelado", () => {
    render(Header, {
      props: {
        currentUser: { id: "u1", username: "ana", email: "ana@example.com" },
      },
    });
    // A rota implementada é `/perfil/[username]`; `/perfil` é 404.
    expect(screen.getByTestId("user-avatar").getAttribute("href")).toBe(
      "/perfil/ana",
    );
  });
});
