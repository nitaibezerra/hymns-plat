/**
 * Sub-marco 5.F — Ciclo 5F.14.
 *
 * Porta da tabela de `templates/users/upload_preview.html`: Nº (dois dígitos,
 * como o `stringformat:"02d"`), Título e confiança do OCR em % — ou "—"
 * quando o OCR não devolveu confiança (o `_hymn_to_dict` remove campos
 * vazios/None, então isso é comum).
 *
 * Mostra os 5 primeiros e, se houver mais, o rodapé "… e mais N hinos".
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import OcrPreviewTable from "./OcrPreviewTable.svelte";
import { formatHymnNumber, formatOcrConfidence } from "./ocr-result";

import type { OcrHymn } from "./ocr-result";

function hymn(number: number, title: string, ocrAvgConfidence: number | null = 87.6): OcrHymn {
  return { number, title, text: `Texto do hino ${number}`, ocrAvgConfidence };
}

function fiveHymns(): OcrHymn[] {
  return [
    hymn(1, "Estrela Brilhante"),
    hymn(2, "Lua Branca"),
    hymn(3, "Sol e Lua"),
    hymn(4, "Firmamento"),
    hymn(5, "Chamo a Força"),
  ];
}

describe("formatHymnNumber (5F.14)", () => {
  it("preenche com zero até dois dígitos", () => {
    expect(formatHymnNumber(1)).toBe("01");
    expect(formatHymnNumber(9)).toBe("09");
    expect(formatHymnNumber(10)).toBe("10");
    expect(formatHymnNumber(132)).toBe("132");
  });

  it("número ausente vira travessão", () => {
    expect(formatHymnNumber(null)).toBe("—");
  });
});

describe("formatOcrConfidence (5F.14)", () => {
  it("arredonda pra inteiro com %", () => {
    expect(formatOcrConfidence(87.6)).toBe("88%");
    expect(formatOcrConfidence(0)).toBe("0%");
  });

  it("confiança ausente vira travessão", () => {
    expect(formatOcrConfidence(null)).toBe("—");
  });
});

describe("OcrPreviewTable (5F.14)", () => {
  it("mostra uma linha por hino recebido", () => {
    render(OcrPreviewTable, { props: { hymns: fiveHymns(), totalHymns: 5 } });
    expect(screen.getAllByTestId("ocr-preview-row")).toHaveLength(5);
  });

  it("cada linha traz número, título e confiança", () => {
    render(OcrPreviewTable, { props: { hymns: [hymn(2, "Lua Branca", 91.2)], totalHymns: 1 } });
    const row = screen.getByTestId("ocr-preview-row");
    expect(row).toHaveTextContent("02");
    expect(row).toHaveTextContent("Lua Branca");
    expect(row).toHaveTextContent("91%");
  });

  it("hino sem confiança de OCR mostra travessão", () => {
    render(OcrPreviewTable, { props: { hymns: [hymn(1, "Estrela", null)], totalHymns: 1 } });
    expect(screen.getByTestId("ocr-preview-row")).toHaveTextContent("—");
  });

  it("com mais de 5 hinos mostra o rodapé com o restante", () => {
    render(OcrPreviewTable, { props: { hymns: fiveHymns(), totalHymns: 23 } });
    expect(screen.getByTestId("ocr-preview-more")).toHaveTextContent("18");
  });

  it("com exatamente 5 hinos não mostra rodapé", () => {
    render(OcrPreviewTable, { props: { hymns: fiveHymns(), totalHymns: 5 } });
    expect(screen.queryByTestId("ocr-preview-more")).toBeNull();
  });

  it("um único hino restante fica no singular", () => {
    render(OcrPreviewTable, { props: { hymns: fiveHymns(), totalHymns: 6 } });
    expect(screen.getByTestId("ocr-preview-more")).toHaveTextContent(/mais 1 hino$/);
  });

  it("cabeçalhos em PT-BR", () => {
    render(OcrPreviewTable, { props: { hymns: fiveHymns(), totalHymns: 5 } });
    const headers = screen.getAllByRole("columnheader").map((th) => th.textContent?.trim());
    expect(headers).toEqual(["Nº", "Título", "OCR"]);
  });
});
