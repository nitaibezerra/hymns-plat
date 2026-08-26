/**
 * Sub-marco 5.F — Ciclo 5F.9.
 *
 * Porta do bloco de progresso de `templates/users/upload_processing.html`:
 *   - `pending` → "Aguardando…";
 *   - `processing` → "Página N de M";
 *   - barra com `progressPct` e semântica de progressbar;
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import OcrProgress from "./OcrProgress.svelte";

import type { OcrTaskSnapshot } from "$lib/ocr-polling";

function task(overrides: Partial<OcrTaskSnapshot> = {}): OcrTaskSnapshot {
  return {
    id: "task-1",
    status: "processing",
    currentPage: 3,
    totalPages: 12,
    progressPct: 25,
    errorMessage: "",
    pdfFilename: "hinario.pdf",
    resultData: null,
    ...overrides,
  };
}

describe("OcrProgress (5F.9)", () => {
  it("mostra 'Aguardando…' enquanto a task está pending", () => {
    render(OcrProgress, { props: { task: task({ status: "pending", currentPage: 0, progressPct: 0 }) } });
    expect(screen.getByTestId("ocr-progress-text")).toHaveTextContent("Aguardando…");
  });

  it("mostra 'Página N de M' durante o processamento", () => {
    render(OcrProgress, { props: { task: task({ currentPage: 3, totalPages: 12 }) } });
    expect(screen.getByTestId("ocr-progress-text")).toHaveTextContent("Página 3 de 12");
  });

  it("desenha a barra com o progressPct e a semântica de progressbar", () => {
    render(OcrProgress, { props: { task: task({ progressPct: 42 }) } });
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "42");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(screen.getByTestId("ocr-progress-fill").getAttribute("style")).toContain("42%");
  });

  it("sem task ainda mostra 'Iniciando…'", () => {
    render(OcrProgress, { props: { task: null } });
    expect(screen.getByTestId("ocr-progress-text")).toHaveTextContent("Iniciando…");
  });

  it("mostra o nome do arquivo enviado", () => {
    render(OcrProgress, { props: { task: task({ pdfFilename: "cruzeiro.pdf" }) } });
    expect(screen.getByTestId("ocr-progress")).toHaveTextContent("cruzeiro.pdf");
  });

  it("totalPages zerado não vira 'Página 0 de 0'", () => {
    render(OcrProgress, { props: { task: task({ currentPage: 0, totalPages: 0 }) } });
    expect(screen.getByTestId("ocr-progress-text")).toHaveTextContent("Aguardando…");
  });
});

describe("OcrProgress falha (5F.10)", () => {
  it("mostra a mensagem de erro da task e o botão Tentar novamente", () => {
    render(OcrProgress, {
      props: { task: task({ status: "failed", errorMessage: "Nenhum hino extraído do PDF." }) },
    });
    expect(screen.getByTestId("ocr-failed")).toHaveTextContent("Nenhum hino extraído do PDF.");
    const retry = screen.getByRole("link", { name: /tentar novamente/i });
    expect(retry).toHaveAttribute("href", "/contribuir/");
  });

  it("sem errorMessage cai num texto genérico em PT-BR", () => {
    render(OcrProgress, { props: { task: task({ status: "failed", errorMessage: "" }) } });
    expect(screen.getByTestId("ocr-failed")).toHaveTextContent(/erro desconhecido/i);
  });

  it("falha esconde a barra de progresso", () => {
    render(OcrProgress, { props: { task: task({ status: "failed", errorMessage: "x" }) } });
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("erro de rede do polling aparece sem esconder o progresso", () => {
    render(OcrProgress, { props: { task: task(), networkError: "HTTP 502" } });
    expect(screen.getByTestId("ocr-network-error")).toHaveTextContent("HTTP 502");
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("erro fatal (task inexistente) é definitivo: sem 'continuando a tentar', com Tentar novamente", () => {
    render(OcrProgress, {
      props: { task: task(), fatalError: "Tarefa de OCR não encontrada." },
    });
    expect(screen.getByTestId("ocr-fatal")).toHaveTextContent("Tarefa de OCR não encontrada.");
    expect(screen.queryByTestId("ocr-network-error")).toBeNull();
    expect(screen.queryByText(/continuando a tentar/i)).toBeNull();
    expect(screen.getByRole("link", { name: /tentar novamente/i })).toHaveAttribute(
      "href",
      "/contribuir/",
    );
  });

  it("erro fatal esconde a barra — o polling já parou", () => {
    render(OcrProgress, { props: { task: task(), fatalError: "Tarefa de OCR não encontrada." } });
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("erro fatal tem precedência sobre erro de rede transitório", () => {
    render(OcrProgress, {
      props: { task: task(), networkError: "HTTP 502", fatalError: "Tarefa de OCR não encontrada." },
    });
    expect(screen.getByTestId("ocr-fatal")).toBeInTheDocument();
    expect(screen.queryByTestId("ocr-network-error")).toBeNull();
  });
});
