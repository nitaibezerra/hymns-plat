/**
 * Marco 4.B — Ciclo 4B.8.
 *
 * `+layout.svelte` é o shell visual que envolve TODAS as páginas:
 *
 *   - <Header /> recebe `currentUser` do `+layout.ts` (ciclo 4B.7).
 *   - <Footer /> fica sempre presente.
 *   - {@render children()} é renderizado dentro de um wrapper
 *     `data-testid="content-area"` (slot que `Sub-marco 4.C` vai mirar
 *     para inserir cards de listagem).
 *   - `data-testid="player-slot"` é um slot fixo no bottom da página
 *     onde `Sub-marco 4.F` (player global) vai montar; permanece vazio
 *     neste marco.
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import Layout from "./+layout.svelte";

const ANON_DATA = { currentUser: null };
const USER_DATA = {
  currentUser: { id: "u1", username: "ana", email: "ana@example.com" },
};

describe("+layout.svelte (shell)", () => {
  it("renderiza Header e Footer", () => {
    render(Layout, { props: { data: ANON_DATA, children: undefined } });
    expect(screen.getByTestId("site-header")).toBeInTheDocument();
    expect(screen.getByTestId("site-footer")).toBeInTheDocument();
  });

  it("renderiza o slot de conteúdo (content-area)", () => {
    render(Layout, { props: { data: ANON_DATA, children: undefined } });
    expect(screen.getByTestId("content-area")).toBeInTheDocument();
  });

  it("renderiza o slot do player fixed-bottom (vazio neste marco)", () => {
    render(Layout, { props: { data: ANON_DATA, children: undefined } });
    expect(screen.getByTestId("player-slot")).toBeInTheDocument();
  });

  it("repassa currentUser pro Header (mostra avatar quando autenticado)", () => {
    render(Layout, { props: { data: USER_DATA, children: undefined } });
    expect(screen.getByTestId("user-avatar")).toBeInTheDocument();
  });
});
