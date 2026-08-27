/**
 * Marco 5.B — Ciclo 5B.6.
 *
 * Chips de prioridade: filtro MUTUAMENTE EXCLUSIVO (diferente do sort, que
 * é combinável). Paridade com o `[data-priority-row]` de
 * `templates/hymns/editor/hymnbook_list.html` — Todas · P1 Urgente (ponto
 * vermelho) · P2 Atenção (ponto ouro) · P3, e o reset ("Todas") preserva o
 * sort que o editor já montou.
 */

import { fireEvent, render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PriorityChips from "./PriorityChips.svelte";

import type { SortPair } from "$lib/editor-sort";

const gotoMock = vi.fn();
vi.mock("$app/navigation", () => ({
  goto: (...args: unknown[]) => gotoMock(...args),
}));

beforeEach(() => {
  gotoMock.mockClear();
});

function mount(priority = "all", pairs: SortPair[] = []) {
  return render(PriorityChips, { props: { priority, pairs } });
}

describe("PriorityChips (5B.6)", () => {
  it("renderiza as 4 opções com rótulo em PT-BR", () => {
    mount();
    expect(screen.getAllByTestId(/^priority-chip-/)).toHaveLength(4);
    expect(screen.getByTestId("priority-chip-all")).toHaveTextContent("Todas");
    expect(screen.getByTestId("priority-chip-P1")).toHaveTextContent("P1 Urgente");
    expect(screen.getByTestId("priority-chip-P2")).toHaveTextContent("P2 Atenção");
    expect(screen.getByTestId("priority-chip-P3")).toHaveTextContent("P3");
  });

  it("'Todas' é a ativa por default", () => {
    mount();
    expect(screen.getByTestId("priority-chip-all")).toHaveAttribute("aria-current", "true");
    expect(screen.getByTestId("priority-chip-P1")).not.toHaveAttribute("aria-current");
  });

  it("filtro é exclusivo: só uma chip ativa por vez", () => {
    mount("P1");
    expect(screen.getByTestId("priority-chip-P1")).toHaveAttribute("aria-current", "true");
    expect(screen.getByTestId("priority-chip-all")).not.toHaveAttribute("aria-current");
    expect(screen.getAllByTestId(/^priority-chip-/).filter((c) => c.hasAttribute("aria-current")))
      .toHaveLength(1);
  });

  it("href de P1 filtra pela prioridade", () => {
    mount();
    expect(screen.getByTestId("priority-chip-P1")).toHaveAttribute("href", "/editor/?priority=P1");
  });

  it("href de 'Todas' limpa o filtro", () => {
    mount("P1");
    expect(screen.getByTestId("priority-chip-all")).toHaveAttribute("href", "/editor/");
  });

  it("trocar de prioridade preserva o sort já montado", () => {
    mount("all", [
      ["review", "asc"],
      ["audio", "desc"],
    ]);
    expect(screen.getByTestId("priority-chip-P2")).toHaveAttribute(
      "href",
      "/editor/?priority=P2&sort=review:asc,audio:desc",
    );
  });

  it("reset pra 'Todas' também preserva o sort", () => {
    mount("P1", [["review", "asc"]]);
    expect(screen.getByTestId("priority-chip-all")).toHaveAttribute(
      "href",
      "/editor/?sort=review:asc",
    );
  });

  it("P1 e P2 têm ponto de cor; P3 e Todas não", () => {
    mount();
    expect(screen.getByTestId("priority-chip-P1").querySelector("[data-dot]")).not.toBeNull();
    expect(screen.getByTestId("priority-chip-P2").querySelector("[data-dot]")).not.toBeNull();
    expect(screen.getByTestId("priority-chip-P3").querySelector("[data-dot]")).toBeNull();
    expect(screen.getByTestId("priority-chip-all").querySelector("[data-dot]")).toBeNull();
  });

  it("clique navega com goto(replaceState: true)", async () => {
    mount();
    await fireEvent.click(screen.getByTestId("priority-chip-P1"));
    expect(gotoMock).toHaveBeenCalledTimes(1);
    expect(gotoMock.mock.calls[0][0]).toBe("/editor/?priority=P1");
    expect(gotoMock.mock.calls[0][1]).toMatchObject({ replaceState: true });
  });

  it("ctrl/cmd-clique fica com o browser", async () => {
    mount();
    await fireEvent.click(screen.getByTestId("priority-chip-P1"), { ctrlKey: true });
    expect(gotoMock).not.toHaveBeenCalled();
  });
});
