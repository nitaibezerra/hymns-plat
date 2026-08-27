/**
 * Sub-marco 5.C — Ciclo 5C.7.
 *
 * Pílulas de padrão de repetição. Espelham `Hymn.CANONICAL_REPETITIONS` em
 * `apps/hymns/models.py` — nenhum campo do schema GraphQL expõe a tupla, e
 * este teste é o que a pina.
 */

import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import RepetitionPills, { CANONICAL_REPETITIONS } from "./RepetitionPills.svelte";

describe("RepetitionPills — 5C.7", () => {
  it("expõe os mesmos valores canônicos do Django", () => {
    expect(CANONICAL_REPETITIONS).toEqual(["1-2,3-4", "1-2,3-4,1-4", "1-4", "3-4,1-4", "1-2,1-4"]);
  });

  it("renderiza uma pílula por padrão canônico", () => {
    render(RepetitionPills, { props: { value: "" } });
    expect(screen.getAllByTestId("repetition-pill")).toHaveLength(5);
  });

  it("pílulas são <button type=button>", () => {
    render(RepetitionPills, { props: { value: "" } });
    for (const pill of screen.getAllByTestId("repetition-pill")) {
      expect(pill.getAttribute("type")).toBe("button");
    }
  });

  it("clicar numa pílula preenche o valor e marca como ativa", async () => {
    render(RepetitionPills, { props: { value: "" } });
    const pill = screen.getByRole("button", { name: "3-4,1-4" });
    await fireEvent.click(pill);
    expect(pill.dataset.active).toBe("true");
    expect(screen.getByRole("button", { name: "1-4" }).dataset.active).toBe("false");
  });

  it("clicar na pílula ativa limpa o campo (toggle)", async () => {
    render(RepetitionPills, { props: { value: "1-4" } });
    const pill = screen.getByRole("button", { name: "1-4" });
    expect(pill.dataset.active).toBe("true");
    await fireEvent.click(pill);
    expect(pill.dataset.active).toBe("false");
  });

  it("sugestões do hinário aparecem sem duplicar as canônicas", () => {
    render(RepetitionPills, { props: { value: "", suggestions: ["1-4", "5-8", "5-8"] } });
    expect(
      screen.getAllByTestId("repetition-suggestion").map((el) => el.textContent?.trim()),
    ).toEqual(["5-8"]);
  });
});
