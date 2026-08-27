/**
 * Marco 5.B — Ciclo 5B.7.
 *
 * Micro-barra de progresso. Paridade com `.metric-bar` de
 * `static/css/components.css` (usada por `hymnbook_list.html`): rótulo à
 * esquerda, contagem absoluta opcional, trilho, percentual em mono.
 *
 * Duas cores com significado: a barra de REVISÃO usa o azul litúrgico
 * (métrica primária, é o que fecha o hinário) e as de completude de
 * conteúdo usam ouro (secundárias, decorativas).
 *
 * O percentual vem PRONTO do backend (`HymnBookType.reviewProgress`, 5.A½);
 * o componente só apresenta — e blinda contra valor fora de 0-100 para não
 * vazar uma barra de 340% de largura.
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import ReviewProgressBar from "./ReviewProgressBar.svelte";

describe("ReviewProgressBar (5B.7)", () => {
  it("mostra rótulo e percentual", () => {
    render(ReviewProgressBar, { props: { label: "Revisados", pct: 40 } });
    const bar = screen.getByTestId("review-progress-bar");
    expect(bar).toHaveTextContent("Revisados");
    expect(bar).toHaveTextContent("40%");
  });

  it("a largura do preenchimento é o percentual", () => {
    render(ReviewProgressBar, { props: { label: "Revisados", pct: 40 } });
    expect(screen.getByTestId("progress-fill").getAttribute("style")).toContain("width: 40%");
  });

  it("é um progressbar acessível, com valor e rótulo", () => {
    render(ReviewProgressBar, { props: { label: "Revisados", pct: 40 } });
    const track = screen.getByRole("progressbar", { name: /revisados/i });
    expect(track).toHaveAttribute("aria-valuenow", "40");
    expect(track).toHaveAttribute("aria-valuemin", "0");
    expect(track).toHaveAttribute("aria-valuemax", "100");
  });

  it("mostra a contagem absoluta quando recebe uma", () => {
    render(ReviewProgressBar, {
      props: { label: "Revisados", pct: 40, count: "12 de 30" },
    });
    expect(screen.getByTestId("progress-count")).toHaveTextContent("12 de 30");
  });

  it("sem contagem, não sobra rótulo vazio na linha", () => {
    render(ReviewProgressBar, { props: { label: "Estilo", pct: 60 } });
    expect(screen.queryByTestId("progress-count")).not.toBeInTheDocument();
  });

  it("tom 'review' é a métrica primária; 'content' é secundária", () => {
    render(ReviewProgressBar, { props: { label: "Revisados", pct: 40, tone: "review" } });
    expect(screen.getByTestId("review-progress-bar").className).toMatch(/is-review/);
  });

  it("tom 'content' por default", () => {
    render(ReviewProgressBar, { props: { label: "Estilo", pct: 60 } });
    expect(screen.getByTestId("review-progress-bar").className).toMatch(/is-content/);
  });

  it("valor acima de 100 é limitado — barra não vaza do trilho", () => {
    render(ReviewProgressBar, { props: { label: "Áudios", pct: 340 } });
    expect(screen.getByTestId("progress-fill").getAttribute("style")).toContain("width: 100%");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("valor negativo vira zero", () => {
    render(ReviewProgressBar, { props: { label: "Áudios", pct: -5 } });
    expect(screen.getByTestId("progress-fill").getAttribute("style")).toContain("width: 0%");
  });

  it("zero renderiza a barra vazia, não a barra ausente", () => {
    render(ReviewProgressBar, { props: { label: "Áudios", pct: 0 } });
    expect(screen.getByTestId("review-progress-bar")).toHaveTextContent("0%");
    expect(screen.getByTestId("progress-fill")).toBeInTheDocument();
  });
});
