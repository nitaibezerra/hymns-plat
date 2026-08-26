/**
 * Sub-marco 5.C — testes de integração da tela 07 · Revisar hino.
 *
 * Cada ciclo TDD acrescenta um bloco aqui. Paridade de referência:
 * `templates/hymns/editor/revise_hymn.html` + a view
 * `apps/hymns/editor_views.py::editor_revise_hymn`.
 */

import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import Page from "./+page.svelte";
import type { ReviseHymnData } from "./+page";

vi.mock("$app/navigation", () => ({
  goto: vi.fn(),
}));

export const sampleData: ReviseHymnData & { currentUser: null } = {
  currentUser: null,
  error: null,
  hymn: {
    id: "h-1",
    number: 7,
    title: "Estrela do Norte",
    text: "Eu vou subindo\nEu vou subindo",
    ocrText: "Eu vou subindo\nEu vou subiudo",
    style: "Valsa",
    repetitions: "1-2,3-4",
    extraInstructions: "Cantar duas vezes",
    offeredTo: "Mestre Irineu",
    section: "Primeira parte",
    receivedAt: "1930-05-01",
    reviewStatus: "IN_REVIEW",
    lastReviewedAt: "2026-08-01T10:00:00+00:00",
    lastReviewedBy: { id: "u-1", username: "ana" },
    hymnBook: {
      id: "hb-1",
      name: "O Cruzeiro",
      slug: "o-cruzeiro",
      hymns: [
        { id: "h-0", number: 6, reviewStatus: "REVIEWED" },
        { id: "h-1", number: 7, reviewStatus: "IN_REVIEW" },
        { id: "h-2", number: 8, reviewStatus: "NOT_REVIEWED" },
      ],
      nextPendingHymn: { id: "h-2", number: 8, title: "Sol Nascente" },
    },
    inlineDiff: {
      changes: 1,
      adds: 0,
      dels: 0,
      lines: [
        { kind: "eq", tokens: [{ kind: "eq", text: "Eu vou subindo", sub: null, add: null }] },
        {
          kind: "replace",
          tokens: [
            { kind: "eq", text: "Eu vou ", sub: null, add: null },
            { kind: "sub", text: null, sub: "subiudo", add: "subindo" },
          ],
        },
      ],
    },
    ocrLineConfidences: [100, 92],
    commonStyles: ["Valsa", "Marcha"],
    commonRepetitions: ["1-2,3-4", "1-4"],
    revisions: [],
    audios: [],
  },
};

describe("5C.5 — formulário edita todos os campos de HymnForm", () => {
  it("mostra estado de erro quando o load falhou", () => {
    render(Page, { props: { data: { ...sampleData, hymn: null, error: "Sem acesso." } } });
    expect(screen.getByTestId("error")).toHaveTextContent("Sem acesso.");
  });

  it("preenche os campos editáveis com os valores do hino", () => {
    render(Page, { props: { data: sampleData } });
    expect((screen.getByLabelText("Número") as HTMLInputElement).value).toBe("7");
    expect((screen.getByLabelText("Título") as HTMLInputElement).value).toBe("Estrela do Norte");
    expect((screen.getByLabelText("Letra") as HTMLTextAreaElement).value).toBe(
      "Eu vou subindo\nEu vou subindo",
    );
    expect((screen.getByLabelText("Repetições") as HTMLInputElement).value).toBe("1-2,3-4");
    expect((screen.getByLabelText("Estilo") as HTMLInputElement).value).toBe("Valsa");
    expect((screen.getByLabelText("Oferecido para") as HTMLInputElement).value).toBe("Mestre Irineu");
    expect((screen.getByLabelText("Seção") as HTMLInputElement).value).toBe("Primeira parte");
    expect((screen.getByLabelText("Instruções") as HTMLTextAreaElement).value).toBe(
      "Cantar duas vezes",
    );
  });

  it("`Recebido em` aparece somente-leitura (updateHymn não aceita o campo)", () => {
    render(Page, { props: { data: sampleData } });
    const received = screen.getByLabelText("Recebido em") as HTMLInputElement;
    expect(received.value).toBe("1930-05-01");
    expect(received.readOnly).toBe(true);
  });

  it("status de revisão é um segmentado com o valor atual marcado", () => {
    render(Page, { props: { data: sampleData } });
    const current = screen.getByLabelText("Em revisão") as HTMLInputElement;
    expect(current.checked).toBe(true);
    expect((screen.getByLabelText("Não revisado") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("Revisado") as HTMLInputElement).checked).toBe(false);
  });

  it("editar número/título reflete na prévia (prova o bind:value)", async () => {
    render(Page, { props: { data: sampleData } });
    expect(screen.getByTestId("preview-title")).toHaveTextContent("7 - Estrela do Norte");

    await fireEvent.input(screen.getByLabelText("Título"), { target: { value: "Estrela D'Alva" } });
    await fireEvent.input(screen.getByLabelText("Número"), { target: { value: "9" } });

    expect(screen.getByTestId("preview-title")).toHaveTextContent("9 - Estrela D'Alva");
  });

  it("renderiza o diff e o sparkline de OCR na coluna direita", () => {
    render(Page, { props: { data: sampleData } });
    expect(screen.getAllByTestId("diff-line")).toHaveLength(2);
    expect(screen.getAllByTestId("ocr-bar")).toHaveLength(2);
  });
});

describe("5C.6 — pílulas de estilo preenchem o campo", () => {
  it("clicar em `Mazurca` escreve no input de Estilo", async () => {
    render(Page, { props: { data: sampleData } });
    const input = screen.getByLabelText("Estilo") as HTMLInputElement;
    expect(input.value).toBe("Valsa");

    await fireEvent.click(screen.getByRole("button", { name: "Mazurca" }));
    expect(input.value).toBe("Mazurca");
  });

  it("`commonStyles` do hinário entra como sugestão extra", () => {
    render(Page, {
      props: {
        data: {
          ...sampleData,
          hymn: { ...sampleData.hymn!, commonStyles: ["Valsa", "Chorinho"] },
        },
      },
    });
    expect(screen.getAllByTestId("style-suggestion").map((el) => el.textContent?.trim())).toEqual([
      "Chorinho",
    ]);
  });
});
