/**
 * Sub-marco 5.C — Ciclo 5C.4.
 *
 * `OcrConfidenceBar` é o sparkline de fidelidade do OCR: uma barra por linha
 * de `HymnType.ocrLineConfidences` (0-100), altura proporcional ao score e
 * cor em três faixas — espelha `.ocr-confidence-sparkline` de
 * `static/css/components.css` (`.bar.low` / `.bar.mid` / `.bar.high`).
 *
 * Faixas (o Django não fixa os cortes em nenhum lugar; escolhidas aqui e
 * documentadas): `< 60` = low, `60-84` = mid, `>= 85` = high.
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import OcrConfidenceBar from "./OcrConfidenceBar.svelte";

describe("OcrConfidenceBar — 5C.4", () => {
  it("renderiza uma barra por linha do OCR", () => {
    render(OcrConfidenceBar, { props: { confidences: [100, 80, 40] } });
    expect(screen.getAllByTestId("ocr-bar")).toHaveLength(3);
  });

  it("altura da barra é proporcional ao score (0-100 → 0-100%)", () => {
    render(OcrConfidenceBar, { props: { confidences: [100, 50, 0] } });
    const bars = screen.getAllByTestId("ocr-bar");
    expect(bars[0].style.height).toBe("100%");
    expect(bars[1].style.height).toBe("50%");
    expect(bars[2].style.height).toBe("0%");
  });

  it("classifica o score em low/mid/high", () => {
    render(OcrConfidenceBar, { props: { confidences: [95, 70, 30] } });
    const bars = screen.getAllByTestId("ocr-bar");
    expect(bars.map((el) => el.dataset.level)).toEqual(["high", "mid", "low"]);
  });

  it("cada barra tem título acessível com a linha e o percentual", () => {
    render(OcrConfidenceBar, { props: { confidences: [92] } });
    const bar = screen.getAllByTestId("ocr-bar")[0];
    expect(bar.getAttribute("title")).toBe("Linha 1 · 92% de fidelidade do OCR");
  });

  it("clamp de valores fora de 0-100", () => {
    render(OcrConfidenceBar, { props: { confidences: [140, -20] } });
    const bars = screen.getAllByTestId("ocr-bar");
    expect(bars[0].style.height).toBe("100%");
    expect(bars[1].style.height).toBe("0%");
  });

  it("exibe a média como legenda", () => {
    render(OcrConfidenceBar, { props: { confidences: [100, 80] } });
    expect(screen.getByTestId("ocr-average")).toHaveTextContent("Fidelidade média do OCR · 90%");
  });

  it("lista vazia (hino sem OCR) mostra o estado vazio", () => {
    render(OcrConfidenceBar, { props: { confidences: [] } });
    expect(screen.getByTestId("ocr-empty")).toHaveTextContent("Sem OCR para este hino.");
    expect(screen.queryAllByTestId("ocr-bar")).toHaveLength(0);
  });
});
