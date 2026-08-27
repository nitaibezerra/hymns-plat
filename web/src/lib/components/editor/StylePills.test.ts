/**
 * Sub-marco 5.C — Ciclo 5C.6.
 *
 * Pílulas de estilo musical. Os valores canônicos são os de
 * `Hymn.CANONICAL_STYLES` em `apps/hymns/models.py` — "Marcha", "Valsa",
 * "Mazurca", nessa ordem. Nenhum campo do schema GraphQL expõe a tupla, por
 * isso ela é espelhada aqui e pinada por este teste: se o Django mudar a
 * lista, este teste é o lugar que avisa.
 *
 * `commonStyles` (top-N do hinário) entra como sugestão extra, sem repetir
 * o que já é canônico.
 */

import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import StylePills, { CANONICAL_STYLES } from "./StylePills.svelte";

describe("StylePills — 5C.6", () => {
  it("expõe os mesmos valores canônicos do Django", () => {
    expect(CANONICAL_STYLES).toEqual(["Marcha", "Valsa", "Mazurca"]);
  });

  it("renderiza uma pílula por estilo canônico", () => {
    render(StylePills, { props: { value: "" } });
    const pills = screen.getAllByTestId("style-pill");
    expect(pills.map((el) => el.textContent?.trim())).toEqual(["Marcha", "Valsa", "Mazurca"]);
  });

  it("pílulas são <button type=button> (não submetem o formulário)", () => {
    render(StylePills, { props: { value: "" } });
    for (const pill of screen.getAllByTestId("style-pill")) {
      expect(pill.getAttribute("type")).toBe("button");
    }
  });

  it("clicar numa pílula preenche o valor e marca a pílula como ativa", async () => {
    render(StylePills, { props: { value: "" } });
    const valsa = screen.getByRole("button", { name: "Valsa" });
    await fireEvent.click(valsa);
    expect(valsa.dataset.active).toBe("true");
    expect(screen.getByRole("button", { name: "Marcha" }).dataset.active).toBe("false");
  });

  it("valor inicial já marca a pílula correspondente", () => {
    render(StylePills, { props: { value: "Mazurca" } });
    expect(screen.getByRole("button", { name: "Mazurca" }).dataset.active).toBe("true");
  });

  it("clicar na pílula ativa limpa o campo (toggle)", async () => {
    render(StylePills, { props: { value: "Marcha" } });
    const marcha = screen.getByRole("button", { name: "Marcha" });
    await fireEvent.click(marcha);
    expect(marcha.dataset.active).toBe("false");
  });

  it("sugestões do hinário aparecem sem duplicar as canônicas", () => {
    render(StylePills, { props: { value: "", suggestions: ["Valsa", "Chorinho", "Chorinho"] } });
    const extras = screen.getAllByTestId("style-suggestion");
    expect(extras.map((el) => el.textContent?.trim())).toEqual(["Chorinho"]);
  });

  it("sem sugestões, nenhuma pílula extra é renderizada", () => {
    render(StylePills, { props: { value: "" } });
    expect(screen.queryAllByTestId("style-suggestion")).toHaveLength(0);
  });
});
