/**
 * Sub-marco 5.F — Ciclo 5F.12.
 *
 * Porta do cartão de hinário similar de `templates/users/upload_disambiguate.html`:
 * nome (linkado pro detalhe), dono, total de hinos e os **dois** scores em %,
 * convertidos como o `int(score * 100)` do Django.
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import SimilarBookCard from "./SimilarBookCard.svelte";
import { scoreToPercent } from "./duplicates";

import type { SimilarBook } from "./duplicates";

function similar(overrides: Partial<SimilarBook> = {}): SimilarBook {
  return {
    hymnbook: {
      id: "b1",
      name: "O Cruzeiro",
      slug: "o-cruzeiro",
      ownerName: "Mestre Irineu",
      hymnsTotal: 132,
    },
    nameScore: 0.826,
    contentScore: 0.91,
    ...overrides,
  };
}

describe("scoreToPercent (5F.12)", () => {
  it("trunca como o int() do Python", () => {
    expect(scoreToPercent(0.826)).toBe(82);
    expect(scoreToPercent(0.999)).toBe(99);
    expect(scoreToPercent(1)).toBe(100);
    expect(scoreToPercent(0)).toBe(0);
  });

  it("não estoura com valores fora da faixa", () => {
    expect(scoreToPercent(1.5)).toBe(100);
    expect(scoreToPercent(-0.2)).toBe(0);
    expect(scoreToPercent(Number.NaN)).toBe(0);
  });
});

describe("SimilarBookCard (5F.12)", () => {
  it("mostra nome, dono e total de hinos", () => {
    render(SimilarBookCard, { props: { similar: similar() } });
    const card = screen.getByTestId("similar-book-card");
    expect(card).toHaveTextContent("O Cruzeiro");
    expect(card).toHaveTextContent("Mestre Irineu");
    expect(card).toHaveTextContent("132");
  });

  it("linka pro detalhe do hinário existente", () => {
    render(SimilarBookCard, { props: { similar: similar() } });
    expect(screen.getByRole("link", { name: /o cruzeiro/i })).toHaveAttribute(
      "href",
      "/hinarios/o-cruzeiro/",
    );
  });

  it("mostra os dois scores em porcentagem", () => {
    render(SimilarBookCard, { props: { similar: similar() } });
    expect(screen.getByTestId("similar-name-score")).toHaveTextContent("82%");
    expect(screen.getByTestId("similar-content-score")).toHaveTextContent("91%");
  });

  it("rotula qual score é de nome e qual é de conteúdo", () => {
    render(SimilarBookCard, { props: { similar: similar() } });
    expect(screen.getByTestId("similar-name-score")).toHaveTextContent(/nome/i);
    expect(screen.getByTestId("similar-content-score")).toHaveTextContent(/conteúdo/i);
  });
});
