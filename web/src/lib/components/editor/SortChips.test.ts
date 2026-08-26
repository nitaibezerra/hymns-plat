/**
 * Marco 5.B — Ciclo 5B.5.
 *
 * As 4 chips de ordenação. Paridade com o `[data-sort-row]` de
 * `templates/hymns/editor/hymnbook_list.html`: rótulo, seta de direção,
 * numerinho de prioridade quando há sort combinado, `aria-current`.
 *
 * Cada chip é um `<a href>` REAL (compartilhável, clicável com o meio do
 * mouse, funciona sem JS) e o clique normal é interceptado pra fazer
 * `goto(..., { replaceState: true })` — o histórico não deve encher de um
 * registro por clique de chip.
 */

import { fireEvent, render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SortChips from "./SortChips.svelte";

import type { SortPair } from "$lib/editor-sort";

const gotoMock = vi.fn();
vi.mock("$app/navigation", () => ({
  goto: (...args: unknown[]) => gotoMock(...args),
}));

beforeEach(() => {
  gotoMock.mockClear();
});

function mount(pairs: SortPair[] = [], extra: Record<string, unknown> = {}) {
  return render(SortChips, { props: { pairs, ...extra } });
}

describe("SortChips (5B.5)", () => {
  it("renderiza as 4 chips com rótulo em PT-BR", () => {
    mount();
    expect(screen.getAllByTestId(/^sort-chip-/)).toHaveLength(4);
    expect(screen.getByRole("link", { name: /revisão/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /estilo \+ reps/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /áudios/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /recentes/i })).toBeInTheDocument();
  });

  it("chip inativa: sem aria-current e sem seta", () => {
    mount();
    const chip = screen.getByTestId("sort-chip-review");
    expect(chip).not.toHaveAttribute("aria-current");
    expect(chip).not.toHaveTextContent("↑");
    expect(chip).not.toHaveTextContent("↓");
  });

  it("chip em asc mostra ↑ e aria-current=true", () => {
    mount([["review", "asc"]]);
    const chip = screen.getByTestId("sort-chip-review");
    expect(chip).toHaveAttribute("aria-current", "true");
    expect(chip).toHaveTextContent("↑");
  });

  it("chip em desc mostra ↓", () => {
    mount([["review", "desc"]]);
    expect(screen.getByTestId("sort-chip-review")).toHaveTextContent("↓");
  });

  it("href da chip inativa liga o sort em asc (off → asc)", () => {
    mount();
    expect(screen.getByTestId("sort-chip-review")).toHaveAttribute(
      "href",
      "/editor/?sort=review:asc",
    );
  });

  it("href da chip em asc inverte pra desc (asc → desc)", () => {
    mount([["review", "asc"]]);
    expect(screen.getByTestId("sort-chip-review")).toHaveAttribute(
      "href",
      "/editor/?sort=review:desc",
    );
  });

  it("href da chip em desc desliga o sort (desc → off) e não deixa `?sort=` órfão", () => {
    mount([["review", "desc"]]);
    expect(screen.getByTestId("sort-chip-review")).toHaveAttribute("href", "/editor/");
  });

  it("métrica nova entra no fim: clique novo tem MENOR prioridade", () => {
    mount([["review", "asc"]]);
    expect(screen.getByTestId("sort-chip-audio")).toHaveAttribute(
      "href",
      "/editor/?sort=review:asc,audio:asc",
    );
  });

  it("sort único não numera prioridade — não há o que desempatar", () => {
    mount([["review", "asc"]]);
    expect(screen.queryByTestId("sort-position-review")).not.toBeInTheDocument();
  });

  it("com 2+ sorts, o numerinho mostra a ordem do ORDER BY", () => {
    mount([
      ["review", "asc"],
      ["audio", "desc"],
    ]);
    expect(screen.getByTestId("sort-position-review")).toHaveTextContent("1");
    expect(screen.getByTestId("sort-position-audio")).toHaveTextContent("2");
  });

  it("preserva o filtro de prioridade ativo no href", () => {
    mount([], { priority: "P1" });
    expect(screen.getByTestId("sort-chip-review")).toHaveAttribute(
      "href",
      "/editor/?sort=review:asc&priority=P1",
    );
  });

  it("priority='all' não vira querystring — é o default do backend", () => {
    mount([], { priority: "all" });
    expect(screen.getByTestId("sort-chip-review")).toHaveAttribute(
      "href",
      "/editor/?sort=review:asc",
    );
  });

  it("clique navega com goto(replaceState: true) em vez de empilhar histórico", async () => {
    mount();
    await fireEvent.click(screen.getByTestId("sort-chip-review"));

    expect(gotoMock).toHaveBeenCalledTimes(1);
    expect(gotoMock.mock.calls[0][0]).toBe("/editor/?sort=review:asc");
    expect(gotoMock.mock.calls[0][1]).toMatchObject({ replaceState: true });
  });

  it("clique com ctrl/cmd deixa o browser abrir em outra aba (não intercepta)", async () => {
    mount();
    await fireEvent.click(screen.getByTestId("sort-chip-review"), { metaKey: true });
    expect(gotoMock).not.toHaveBeenCalled();
  });

  it("mostra a contagem de hinários da fila", () => {
    mount([], { total: 4 });
    expect(screen.getByTestId("sort-count")).toHaveTextContent("4 hinários");
  });

  it("contagem no singular quando é um só", () => {
    mount([], { total: 1 });
    expect(screen.getByTestId("sort-count")).toHaveTextContent("1 hinário");
  });
});
