/**
 * Marco 4.D — Ciclo 4D.3.
 *
 * HymnCorrido renderiza todos os hinos do hinário em coluna (modo "corrido").
 * Cada hino aparece como um bloco com título + HymnBody, separados por uma
 * marca decorativa. Look "página de cantador" — bloco centralizado, versos
 * alinhados à esquerda.
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import HymnCorrido from "./HymnCorrido.svelte";

const hymns = [
  { id: "h-1", number: 1, title: "Abertura", body: "Verso 1\nVerso 2" },
  { id: "h-2", number: 2, title: "Saudação", body: "Linha A\nLinha B" },
  { id: "h-3", number: 3, title: "Estrela do Norte", body: "Brilha o sol" },
];

describe("HymnCorrido", () => {
  it("renderiza um item por hino", () => {
    render(HymnCorrido, { props: { hymns } });
    const items = screen.getAllByTestId("hymn-corrido-item");
    expect(items).toHaveLength(3);
  });

  it("cada item mostra número + título + corpo", () => {
    render(HymnCorrido, { props: { hymns } });
    const items = screen.getAllByTestId("hymn-corrido-item");
    expect(items[0].textContent ?? "").toContain("1");
    expect(items[0].textContent ?? "").toContain("Abertura");
    expect(items[0].textContent ?? "").toContain("Verso 1");
    expect(items[0].textContent ?? "").toContain("Verso 2");
    expect(items[2].textContent ?? "").toContain("Estrela do Norte");
    expect(items[2].textContent ?? "").toContain("Brilha o sol");
  });

  it("renderiza estado vazio quando não há hinos", () => {
    render(HymnCorrido, { props: { hymns: [] } });
    expect(screen.getByTestId("hymn-corrido-empty")).toBeInTheDocument();
  });
});
