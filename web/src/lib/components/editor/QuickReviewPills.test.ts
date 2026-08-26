/**
 * Sub-marco 5.E — Ciclo 5E.2.
 *
 * Pílulas fixas da revisão ágil: 3 de estilo (M/V/Z) e 4 de repetições
 * (1/2/3/4), com atalhos de teclado.
 *
 * Os valores vêm da fonte da verdade do backend e são pinados aqui:
 *   - estilos: `Hymn.CANONICAL_STYLES` (apps/hymns/models.py), reexportado
 *     por `StylePills.svelte`;
 *   - repetições: `quick_repetitions` de `editor_quick_review`
 *     (apps/hymns/editor_views.py) — subconjunto ordenado de
 *     `Hymn.CANONICAL_REPETITIONS`, na ordem dos atalhos.
 */

import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import { CANONICAL_REPETITIONS } from "./RepetitionPills.svelte";
import { CANONICAL_STYLES } from "./StylePills.svelte";
import QuickReviewPills from "./QuickReviewPills.svelte";
import { QUICK_REPETITIONS } from "$lib/graphql/operations/quick-review";

function setup(props: Record<string, unknown> = {}) {
  return render(QuickReviewPills, {
    props: { style: "", repetitions: "", ...props },
  });
}

function styleTiles() {
  return screen.getAllByTestId("quick-style-tile");
}

function repetitionTiles() {
  return screen.getAllByTestId("quick-repetition-tile");
}

describe("QuickReviewPills — presets canônicos (5E.2)", () => {
  it("não inventa lista: as repetições da revisão ágil são todas canônicas", () => {
    QUICK_REPETITIONS.forEach((pattern) => {
      expect(CANONICAL_REPETITIONS).toContain(pattern);
    });
  });

  it("pina os 4 presets de repetição na ordem dos atalhos 1..4", () => {
    expect([...QUICK_REPETITIONS]).toEqual(["1-2,3-4", "1-4", "1-2,3-4,1-4", "3-4,1-4"]);
  });

  it("renderiza uma pílula por estilo canônico", () => {
    setup();
    expect(styleTiles().map((el) => el.dataset.value)).toEqual([...CANONICAL_STYLES]);
  });

  it("renderiza uma pílula por preset de repetição", () => {
    setup();
    expect(repetitionTiles().map((el) => el.dataset.value)).toEqual([...QUICK_REPETITIONS]);
  });

  it("mostra o atalho de cada estilo (Mazurca usa Z, não M)", () => {
    setup();
    expect(styleTiles().map((el) => el.dataset.shortcut)).toEqual(["M", "V", "Z"]);
  });

  it("mostra o atalho numérico de cada repetição", () => {
    setup();
    expect(repetitionTiles().map((el) => el.dataset.shortcut)).toEqual(["1", "2", "3", "4"]);
  });
});

describe("QuickReviewPills — clique (5E.2)", () => {
  it("marca a pílula de estilo correspondente ao valor atual", () => {
    setup({ style: "Valsa" });
    const active = styleTiles().filter((el) => el.dataset.active === "true");
    expect(active).toHaveLength(1);
    expect(active[0].dataset.value).toBe("Valsa");
  });

  it("marca a pílula de repetição correspondente ao valor atual", () => {
    setup({ repetitions: "1-4" });
    const active = repetitionTiles().filter((el) => el.dataset.active === "true");
    expect(active[0].dataset.value).toBe("1-4");
  });

  it("clicar numa pílula de estilo avisa onchange", async () => {
    const onchange = vi.fn();
    setup({ onchange });
    await fireEvent.click(styleTiles()[1]);
    expect(onchange).toHaveBeenCalledWith({ style: "Valsa", repetitions: "" });
  });

  it("clicar numa pílula de repetição avisa onchange", async () => {
    const onchange = vi.fn();
    setup({ onchange });
    await fireEvent.click(repetitionTiles()[2]);
    expect(onchange).toHaveBeenCalledWith({ style: "", repetitions: "1-2,3-4,1-4" });
  });

  it("clicar na pílula já ativa limpa o campo (é como o editor desmarca)", async () => {
    const onchange = vi.fn();
    setup({ style: "Marcha", onchange });
    await fireEvent.click(styleTiles()[0]);
    expect(onchange).toHaveBeenCalledWith({ style: "", repetitions: "" });
  });

  it("expõe aria-pressed pra leitor de tela", () => {
    setup({ style: "Mazurca" });
    expect(styleTiles()[2]).toHaveAttribute("aria-pressed", "true");
    expect(styleTiles()[0]).toHaveAttribute("aria-pressed", "false");
  });
});

describe("QuickReviewPills — atalhos de teclado (5E.2)", () => {
  it("M seleciona Marcha", async () => {
    const onchange = vi.fn();
    setup({ onchange });
    await fireEvent.keyDown(window, { key: "m" });
    expect(onchange).toHaveBeenCalledWith({ style: "Marcha", repetitions: "" });
  });

  it("V seleciona Valsa (maiúscula também)", async () => {
    const onchange = vi.fn();
    setup({ onchange });
    await fireEvent.keyDown(window, { key: "V" });
    expect(onchange).toHaveBeenCalledWith({ style: "Valsa", repetitions: "" });
  });

  it("Z seleciona Mazurca", async () => {
    const onchange = vi.fn();
    setup({ onchange });
    await fireEvent.keyDown(window, { key: "z" });
    expect(onchange).toHaveBeenCalledWith({ style: "Mazurca", repetitions: "" });
  });

  it("1..4 selecionam os presets de repetição na ordem", async () => {
    for (const [index, key] of ["1", "2", "3", "4"].entries()) {
      const onchange = vi.fn();
      const view = setup({ onchange });
      await fireEvent.keyDown(window, { key });
      expect(onchange).toHaveBeenCalledWith({ style: "", repetitions: QUICK_REPETITIONS[index] });
      view.unmount();
    }
  });

  it("atalho de estilo é toggle, igual ao clique", async () => {
    const onchange = vi.fn();
    setup({ style: "Marcha", onchange });
    await fireEvent.keyDown(window, { key: "m" });
    expect(onchange).toHaveBeenCalledWith({ style: "", repetitions: "" });
  });

  it("ignora tecla sem atalho", async () => {
    const onchange = vi.fn();
    setup({ onchange });
    await fireEvent.keyDown(window, { key: "q" });
    await fireEvent.keyDown(window, { key: "9" });
    expect(onchange).not.toHaveBeenCalled();
  });

  it("ignora o atalho quando vem com modificador (Ctrl/Meta/Alt)", async () => {
    const onchange = vi.fn();
    setup({ onchange });
    await fireEvent.keyDown(window, { key: "m", ctrlKey: true });
    await fireEvent.keyDown(window, { key: "1", metaKey: true });
    await fireEvent.keyDown(window, { key: "v", altKey: true });
    expect(onchange).not.toHaveBeenCalled();
  });

  it("pausa os atalhos quando o foco está num input de texto", async () => {
    const onchange = vi.fn();
    setup({ onchange });
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    await fireEvent.keyDown(input, { key: "m", bubbles: true });
    expect(onchange).not.toHaveBeenCalled();
    input.remove();
  });

  it("pausa os atalhos quando o foco está num textarea", async () => {
    const onchange = vi.fn();
    setup({ onchange });
    const area = document.createElement("textarea");
    document.body.appendChild(area);
    area.focus();
    await fireEvent.keyDown(area, { key: "1", bubbles: true });
    expect(onchange).not.toHaveBeenCalled();
    area.remove();
  });

  it("não escuta o teclado quando desabilitado", async () => {
    const onchange = vi.fn();
    setup({ onchange, shortcutsEnabled: false });
    await fireEvent.keyDown(window, { key: "m" });
    expect(onchange).not.toHaveBeenCalled();
  });
});

describe("QuickReviewPills — campos livres (5E.2)", () => {
  it("mantém o campo de texto livre pra estilo (Hymn.style não tem choices)", () => {
    setup({ style: "Hino" });
    const input = screen.getByTestId("quick-style-input") as HTMLInputElement;
    expect(input.value).toBe("Hino");
  });

  it("mantém o campo de texto livre pra repetições", () => {
    setup({ repetitions: "2-3" });
    const input = screen.getByTestId("quick-repetitions-input") as HTMLInputElement;
    expect(input.value).toBe("2-3");
  });

  it("digitar no campo livre avisa onchange", async () => {
    const onchange = vi.fn();
    setup({ onchange });
    const input = screen.getByTestId("quick-style-input");
    await fireEvent.input(input, { target: { value: "Mestre" } });
    expect(onchange).toHaveBeenCalledWith({ style: "Mestre", repetitions: "" });
  });

  it("valor livre fora dos presets não marca nenhuma pílula", () => {
    setup({ style: "Mestre" });
    expect(styleTiles().filter((el) => el.dataset.active === "true")).toHaveLength(0);
  });
});
