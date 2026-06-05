/**
 * Marco 4.D — Ciclo 4D.3.
 *
 * HymnBody renderiza a letra de um hino. Cada linha do texto vira uma <p>
 * (ou <div>) separada, preservando quebras visuais. O wrapper usa a classe
 * `hymn-body-centered` que (via CSS global) centraliza o bloco horizontalmente
 * mantendo cada verso alinhado à esquerda (look "página-de-cantador").
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import HymnBody from "./HymnBody.svelte";

describe("HymnBody", () => {
  it("renderiza cada linha como um elemento separado", () => {
    render(HymnBody, { props: { body: "Linha 1\nLinha 2\nLinha 3" } });
    const lines = screen.getAllByTestId("hymn-line");
    expect(lines).toHaveLength(3);
    expect(lines[0].textContent).toBe("Linha 1");
    expect(lines[1].textContent).toBe("Linha 2");
    expect(lines[2].textContent).toBe("Linha 3");
  });

  it("aplica a classe 'hymn-body-centered' no wrapper", () => {
    render(HymnBody, { props: { body: "Verso único" } });
    const wrapper = screen.getByTestId("hymn-body");
    expect(wrapper.className).toMatch(/hymn-body-centered/);
  });

  it("renderiza estado vazio quando body é null ou string vazia", () => {
    const { rerender } = render(HymnBody, { props: { body: null } });
    expect(screen.queryByTestId("hymn-line")).toBeNull();
    rerender({ body: "" });
    expect(screen.queryByTestId("hymn-line")).toBeNull();
  });

  it("preserva linhas em branco (estrofes separadas)", () => {
    render(HymnBody, { props: { body: "A\n\nB" } });
    const lines = screen.getAllByTestId("hymn-line");
    // 3 linhas: "A", "", "B"
    expect(lines).toHaveLength(3);
    expect(lines[0].textContent).toBe("A");
    expect(lines[1].textContent).toBe("");
    expect(lines[2].textContent).toBe("B");
  });
});
