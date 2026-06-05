/**
 * Marco 4.D — Ciclo 4D.2.
 *
 * HymnIndex renderiza a lista numerada de hinos do hinário (modo "índice").
 * Cada hino vira um link `<a href="/hinos/{id}">` exibindo número + título.
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import HymnIndex from "./HymnIndex.svelte";

const hymns = [
  { id: "h-1", number: 1, title: "Abertura", body: "..." },
  { id: "h-2", number: 2, title: "Saudação", body: "..." },
  { id: "h-3", number: 12, title: "O Cruzeiro", body: "..." },
];

describe("HymnIndex", () => {
  it("renderiza um item por hino", () => {
    render(HymnIndex, { props: { hymns } });
    const items = screen.getAllByTestId("hymn-index-item");
    expect(items).toHaveLength(3);
  });

  it("cada item é um link para /hinos/[id]", () => {
    render(HymnIndex, { props: { hymns } });
    const links = screen.getAllByRole("link");
    expect(links[0].getAttribute("href")).toBe("/hinos/h-1");
    expect(links[1].getAttribute("href")).toBe("/hinos/h-2");
    expect(links[2].getAttribute("href")).toBe("/hinos/h-3");
  });

  it("mostra número formatado com 2 dígitos e título", () => {
    render(HymnIndex, { props: { hymns } });
    const items = screen.getAllByTestId("hymn-index-item");
    expect(items[0].textContent ?? "").toMatch(/01.*Abertura/);
    expect(items[1].textContent ?? "").toMatch(/02.*Saudação/);
    expect(items[2].textContent ?? "").toMatch(/12.*O Cruzeiro/);
  });

  it("renderiza estado vazio quando não há hinos", () => {
    render(HymnIndex, { props: { hymns: [] } });
    expect(screen.getByTestId("hymn-index-empty")).toBeInTheDocument();
  });
});
