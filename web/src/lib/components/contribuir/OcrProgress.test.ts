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
