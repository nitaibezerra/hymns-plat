/**
 * Marco 5.B — Ciclo 5B.3.
 *
 * Barra de 4 stats do workspace. Paridade com o `<dl>` do header de
 * `templates/hymns/editor/hymnbook_list.html`: P1 urgente (vermelho),
 * Hinários (tinta), Pendentes (ouro), Revisados · 7d (verde), todos com o
 * número em `font-display`.
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import EditorStatsBar from "./EditorStatsBar.svelte";

function stats(overrides: Record<string, number> = {}) {
  return {
    totalHinarios: 4,
    pendingHymns: 37,
    recentReviewed7d: 12,
    p1Count: 2,
    ...overrides,
  };
}

describe("EditorStatsBar (5B.3)", () => {
  it("renderiza exatamente 4 cards de stat", () => {
    render(EditorStatsBar, { props: { stats: stats() } });
    expect(screen.getAllByTestId(/^stat-card-/)).toHaveLength(4);
  });

  it("cada card traz seu rótulo em PT-BR e seu valor", () => {
    render(EditorStatsBar, { props: { stats: stats() } });

    expect(screen.getByTestId("stat-card-p1")).toHaveTextContent(/p1 urgente/i);
    expect(screen.getByTestId("stat-card-p1")).toHaveTextContent("2");

    expect(screen.getByTestId("stat-card-hinarios")).toHaveTextContent(/hinários/i);
    expect(screen.getByTestId("stat-card-hinarios")).toHaveTextContent("4");

    expect(screen.getByTestId("stat-card-pendentes")).toHaveTextContent(/pendentes/i);
    expect(screen.getByTestId("stat-card-pendentes")).toHaveTextContent("37");

    expect(screen.getByTestId("stat-card-revisados")).toHaveTextContent(/revisados/i);
    expect(screen.getByTestId("stat-card-revisados")).toHaveTextContent("12");
  });

  it("o número usa font-display (paridade com o template Django)", () => {
    render(EditorStatsBar, { props: { stats: stats() } });
    const value = screen.getByTestId("stat-value-pendentes");
    expect(value.className).toMatch(/font-display/);
  });

  it("é uma <dl> semântica — rótulo em <dt>, número em <dd>", () => {
    render(EditorStatsBar, { props: { stats: stats() } });
    const bar = screen.getByTestId("editor-stats-bar");
    expect(bar.tagName).toBe("DL");
    expect(bar.querySelectorAll("dt")).toHaveLength(4);
    expect(bar.querySelectorAll("dd")).toHaveLength(4);
  });

  it("zero não desaparece nem vira vazio — a fila limpa também é informação", () => {
    render(EditorStatsBar, {
      props: { stats: stats({ p1Count: 0, pendingHymns: 0, recentReviewed7d: 0 }) },
    });
    expect(screen.getByTestId("stat-value-p1")).toHaveTextContent("0");
    expect(screen.getByTestId("stat-value-pendentes")).toHaveTextContent("0");
    expect(screen.getByTestId("stat-value-revisados")).toHaveTextContent("0");
  });

  it("P1 fica em tom de urgência e 'Revisados · 7d' em tom de conquista", () => {
    render(EditorStatsBar, { props: { stats: stats() } });
    expect(screen.getByTestId("stat-value-p1").className).toMatch(/is-urgent/);
    expect(screen.getByTestId("stat-value-pendentes").className).toMatch(/is-pending/);
    expect(screen.getByTestId("stat-value-revisados").className).toMatch(/is-done/);
  });
});
