/**
 * Marco 4.H — Ciclo 4H.4.
 *
 * Unit tests do ActivityHeatmap: SVG 53 colunas × 7 linhas, cor por bucket
 * (0 = fundo neutro, max = accent), title acessível por dia.
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import ActivityHeatmap from "./ActivityHeatmap.svelte";

/**
 * Gera N buckets sequenciais a partir de 2025-01-01. O componente espera
 * receber até 53×7 = 371 buckets; em produção o resolver devolve 365.
 */
function buckets(values: number[]) {
  const out = [];
  for (let i = 0; i < values.length; i++) {
    const d = new Date(Date.UTC(2025, 0, 1 + i));
    out.push({ date: d.toISOString().slice(0, 10), count: values[i] });
  }
  return out;
}

describe("ActivityHeatmap", () => {
  it("renderiza um SVG", () => {
    const { container } = render(ActivityHeatmap, { props: { buckets: buckets([0]) } });
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renderiza 53 colunas × 7 linhas (371 cells) mesmo com buckets vazios", () => {
    const { container } = render(ActivityHeatmap, { props: { buckets: [] } });
    const cells = container.querySelectorAll("rect[data-bucket-cell]");
    expect(cells).toHaveLength(53 * 7);
  });

  it("colore células com count > 0 com a cor de destaque", () => {
    const data = buckets([0, 5, 10]);
    const { container } = render(ActivityHeatmap, { props: { buckets: data } });
    const cells = container.querySelectorAll("rect[data-bucket-cell]");
    // Cell 0: count=0, deve ter fill = cor de fundo (com opacidade baixa)
    // Cell 1 e 2: count > 0, devem ter fill diferente
    const fill0 = cells[0].getAttribute("fill");
    const fill1 = cells[1].getAttribute("fill");
    const fill2 = cells[2].getAttribute("fill");
    expect(fill0).not.toEqual(fill1);
    expect(fill0).not.toEqual(fill2);
    // O bucket com count maior tem opacidade maior (cor mais saturada)
    expect(fill2).not.toEqual(fill1);
  });

  it("expõe title com data e count para acessibilidade/tooltip", () => {
    const data = buckets([3]);
    render(ActivityHeatmap, { props: { buckets: data } });
    expect(screen.getByTitle(/2025-01-01.*3/)).toBeInTheDocument();
  });

  it("renderiza estado vazio quando todos os buckets têm count 0", () => {
    const data = buckets([0, 0, 0, 0, 0]);
    const { container } = render(ActivityHeatmap, { props: { buckets: data } });
    const cells = container.querySelectorAll("rect[data-bucket-cell]");
    // Todas as cells com fill de fundo (mesmo valor)
    const fills = new Set<string | null>();
    cells.forEach((c) => fills.add(c.getAttribute("fill")));
    expect(fills.size).toBe(1);
  });
});
