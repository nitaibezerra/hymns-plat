/**
 * Marco 5.B — Ciclo 5B.8.
 *
 * Lista de hinos do hinário com badge de status. Paridade com o `<ul>` de
 * `templates/hymns/editor/hymnbook_detail.html`: número em mono com dois
 * dígitos, título em `font-display`, badge "● <status>" colorido (verde
 * revisado · ouro em revisão · vermelho não revisado) e o link "Revisar".
 *
 * Os rótulos são os MESMOS do `Hymn.ReviewStatus` do Django ("Não
 * revisado" / "Em revisão" / "Revisado") — o editor alterna entre as duas
 * telas e um vocabulário divergente o faria duvidar do dado.
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import HymnStatusList from "./HymnStatusList.svelte";

const hrefFor = (pk: string) => `/editor/hinos/${pk}/revisar/`;

function hymns() {
  return [
    { id: "h1", number: 1, title: "Sol Lua Estrela", reviewStatus: "REVIEWED" },
    { id: "h2", number: 2, title: "Estrela Brilhante", reviewStatus: "IN_REVIEW" },
    { id: "h3", number: 12, title: "Sete Estrelas", reviewStatus: "NOT_REVIEWED" },
  ];
}

describe("HymnStatusList (5B.8)", () => {
  it("uma linha por hino", () => {
    render(HymnStatusList, { props: { hymns: hymns(), hrefFor } });
    expect(screen.getAllByTestId(/^hymn-row-/)).toHaveLength(3);
  });

  it("número com dois dígitos, como no template", () => {
    render(HymnStatusList, { props: { hymns: hymns(), hrefFor } });
    expect(screen.getByTestId("hymn-number-h1")).toHaveTextContent("01");
    expect(screen.getByTestId("hymn-number-h3")).toHaveTextContent("12");
  });

  it("título em font-display", () => {
    render(HymnStatusList, { props: { hymns: hymns(), hrefFor } });
    const title = screen.getByTestId("hymn-title-h1");
    expect(title).toHaveTextContent("Sol Lua Estrela");
    expect(title.className).toMatch(/font-display/);
  });

  it("badge traduz o status pro vocabulário PT-BR do Django", () => {
    render(HymnStatusList, { props: { hymns: hymns(), hrefFor } });
    expect(screen.getByTestId("hymn-badge-h1")).toHaveTextContent("Revisado");
    expect(screen.getByTestId("hymn-badge-h2")).toHaveTextContent("Em revisão");
    expect(screen.getByTestId("hymn-badge-h3")).toHaveTextContent("Não revisado");
  });

  it("cada status tem seu tom: verde revisado, ouro em revisão, vermelho pendente", () => {
    render(HymnStatusList, { props: { hymns: hymns(), hrefFor } });
    expect(screen.getByTestId("hymn-badge-h1").className).toMatch(/is-reviewed/);
    expect(screen.getByTestId("hymn-badge-h2").className).toMatch(/is-in-review/);
    expect(screen.getByTestId("hymn-badge-h3").className).toMatch(/is-not-reviewed/);
  });

  it("status desconhecido não quebra a lista — cai em 'Não revisado'", () => {
    render(HymnStatusList, {
      props: {
        hymns: [{ id: "hx", number: 3, title: "Hino Novo", reviewStatus: "ALGO_NOVO" }],
        hrefFor,
      },
    });
    expect(screen.getByTestId("hymn-badge-hx")).toHaveTextContent("Não revisado");
  });

  it("cada linha leva pra revisão daquele hino", () => {
    render(HymnStatusList, { props: { hymns: hymns(), hrefFor } });
    const link = screen.getByTestId("hymn-revise-h2");
    expect(link).toHaveAttribute("href", "/editor/hinos/h2/revisar/");
    expect(link).toHaveTextContent(/revisar/i);
  });

  it("o link de revisão diz de qual hino é (nome acessível não repetido)", () => {
    render(HymnStatusList, { props: { hymns: hymns(), hrefFor } });
    expect(
      screen.getByRole("link", { name: /revisar.*estrela brilhante/i }),
    ).toBeInTheDocument();
  });

  it("hinário sem hino nenhum explica o vazio", () => {
    render(HymnStatusList, { props: { hymns: [], hrefFor } });
    expect(screen.getByTestId("hymn-list-empty")).toHaveTextContent(/nenhum hino/i);
  });
});
