/**
 * Marco 4.E — Ciclo 4E.4.
 *
 * `SiblingHymnsList` mostra outros hinos que dividem o mesmo `number` em
 * hinários visíveis pelo usuário (gating já feito no resolver). Renderiza
 * cards com link pro detalhe de cada irmão.
 *
 * O schema vigente (4.A) não expõe `hymnBook` em `HymnType`, então a UI
 * usa apenas `id`, `number` e `title` — o componente está preparado pra
 * receber `hymnBook { name, slug }` quando ampliarmos o schema, mas o
 * teste-base não exige isso.
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import SiblingHymnsList from "./SiblingHymnsList.svelte";

const SIBLINGS = [
  { id: "h-justiceiro-12", number: 12, title: "Estrela do Norte (O Justiceiro)" },
  { id: "h-cruzeiro-12", number: 12, title: "Estrela do Norte (O Cruzeiro)" },
];

describe("SiblingHymnsList", () => {
  it("renderiza um card pra cada irmão", () => {
    render(SiblingHymnsList, { props: { siblings: SIBLINGS } });
    const cards = screen.getAllByTestId("sibling-card");
    expect(cards).toHaveLength(2);
  });

  it("cada card mostra o título do hino", () => {
    render(SiblingHymnsList, { props: { siblings: SIBLINGS } });
    expect(screen.getByText(/O Justiceiro/i)).toBeInTheDocument();
    expect(screen.getByText(/O Cruzeiro/i)).toBeInTheDocument();
  });

  it("cada card tem link pro detalhe do hino /hinos/<id>", () => {
    render(SiblingHymnsList, { props: { siblings: SIBLINGS } });
    const links = screen.getAllByRole("link") as HTMLAnchorElement[];
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/hinos/h-justiceiro-12",
      "/hinos/h-cruzeiro-12",
    ]);
  });

  it("não renderiza a lista quando recebe array vazio", () => {
    render(SiblingHymnsList, { props: { siblings: [] } });
    expect(screen.queryByTestId("sibling-card")).toBeNull();
  });
});
