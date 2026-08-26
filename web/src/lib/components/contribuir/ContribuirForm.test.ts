/**
 * Sub-marco 5.F — Ciclo 5F.7.
 *
 * O formulário de `/contribuir/` espelha `HymnBookPdfUploadForm` no cliente:
 * nome, dono e PDF obrigatórios; extensão `.pdf` e limite de 50 MB checados
 * ANTES de subir o arquivo (`clean_pdf_file`, `apps/hymns/forms.py:163`).
 *
 * Regra: com o formulário inválido, `onsubmit` NÃO é chamado — nada de
 * upload de 50 MB pra descobrir no servidor que o nome estava vazio.
 */

import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import ContribuirForm from "./ContribuirForm.svelte";
import { MAX_PDF_BYTES, validatePdfFile, validateUploadForm } from "./upload-validation";

function makeFile(filename: string, size = 1024, type = "application/pdf"): File {
  const file = new File(["x"], filename, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

/** Anexa arquivos a um <input type="file"> em jsdom. */
async function setFiles(input: HTMLElement, files: File[]) {
  Object.defineProperty(input, "files", { value: files, configurable: true });
  await fireEvent.change(input);
}

describe("validatePdfFile (5F.7)", () => {
  it("exige um arquivo", () => {
    expect(validatePdfFile(null)).toMatch(/PDF/i);
  });

  it("rejeita extensão diferente de .pdf com a mensagem do Django", () => {
    expect(validatePdfFile(makeFile("hinario.docx"))).toBe("O arquivo deve ter extensão .pdf");
  });

  it("aceita .PDF em maiúsculas (o Django faz lower())", () => {
    expect(validatePdfFile(makeFile("HINARIO.PDF"))).toBeNull();
  });

  it("rejeita acima de 50 MB com a mensagem do Django", () => {
    expect(validatePdfFile(makeFile("hinario.pdf", MAX_PDF_BYTES + 1))).toBe(
      "O arquivo não pode ser maior que 50MB",
    );
  });

  it("aceita exatamente 50 MB (o Django usa `>`)", () => {
    expect(validatePdfFile(makeFile("hinario.pdf", MAX_PDF_BYTES))).toBeNull();
  });
});

describe("validateUploadForm (5F.7)", () => {
  it("exige nome e dono", () => {
    const errors = validateUploadForm({
      name: "   ",
      ownerName: "",
      pdfFile: makeFile("h.pdf"),
    });
    expect(errors.name).toBeTruthy();
    expect(errors.ownerName).toBeTruthy();
  });

  it("não reclama quando tudo está preenchido", () => {
    expect(
      validateUploadForm({
        name: "O Justiceiro",
        ownerName: "Padrinho Sebastião",
        pdfFile: makeFile("h.pdf"),
      }),
    ).toEqual({});
  });
});

describe("ContribuirForm (5F.7)", () => {
  it("não chama onsubmit com o formulário vazio e mostra os erros", async () => {
    const onsubmit = vi.fn();
    render(ContribuirForm, { props: { onsubmit } });

    await fireEvent.submit(screen.getByTestId("contribuir-form"));

    expect(onsubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId("error-name")).toHaveTextContent(/nome/i);
    expect(screen.getByTestId("error-ownerName")).toHaveTextContent(/dono/i);
    expect(screen.getByTestId("error-pdfFile")).toHaveTextContent(/PDF/i);
  });

  it("rejeita arquivo que não é .pdf sem chamar onsubmit", async () => {
    const onsubmit = vi.fn();
    render(ContribuirForm, { props: { onsubmit } });

    await fireEvent.input(screen.getByTestId("name-input"), { target: { value: "O Justiceiro" } });
    await fireEvent.input(screen.getByTestId("owner-input"), { target: { value: "Padrinho" } });
    await setFiles(screen.getByTestId("pdf-input"), [makeFile("hinario.txt", 10, "text/plain")]);
    await fireEvent.submit(screen.getByTestId("contribuir-form"));

    expect(onsubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId("error-pdfFile")).toHaveTextContent("O arquivo deve ter extensão .pdf");
  });

  it("rejeita PDF acima de 50 MB sem chamar onsubmit", async () => {
    const onsubmit = vi.fn();
    render(ContribuirForm, { props: { onsubmit } });

    await fireEvent.input(screen.getByTestId("name-input"), { target: { value: "O Justiceiro" } });
    await fireEvent.input(screen.getByTestId("owner-input"), { target: { value: "Padrinho" } });
    await setFiles(screen.getByTestId("pdf-input"), [makeFile("grande.pdf", MAX_PDF_BYTES + 1)]);
    await fireEvent.submit(screen.getByTestId("contribuir-form"));

    expect(onsubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId("error-pdfFile")).toHaveTextContent(
      "O arquivo não pode ser maior que 50MB",
    );
  });

  it("chama onsubmit com os dados quando tudo é válido", async () => {
    const onsubmit = vi.fn();
    render(ContribuirForm, { props: { onsubmit } });
    const pdf = makeFile("hinario.pdf");

    await fireEvent.input(screen.getByTestId("name-input"), { target: { value: "O Justiceiro" } });
    await fireEvent.input(screen.getByTestId("owner-input"), { target: { value: "Padrinho" } });
    await setFiles(screen.getByTestId("pdf-input"), [pdf]);
    await fireEvent.submit(screen.getByTestId("contribuir-form"));

    expect(onsubmit).toHaveBeenCalledTimes(1);
    expect(onsubmit.mock.calls[0][0]).toMatchObject({
      name: "O Justiceiro",
      ownerName: "Padrinho",
      pdfFile: pdf,
      coverImage: null,
    });
  });

  it("capa é opcional e chega no payload quando escolhida", async () => {
    const onsubmit = vi.fn();
    render(ContribuirForm, { props: { onsubmit } });
    const cover = makeFile("capa.jpg", 2048, "image/jpeg");

    await fireEvent.input(screen.getByTestId("name-input"), { target: { value: "O Justiceiro" } });
    await fireEvent.input(screen.getByTestId("owner-input"), { target: { value: "Padrinho" } });
    await setFiles(screen.getByTestId("pdf-input"), [makeFile("hinario.pdf")]);
    await setFiles(screen.getByTestId("cover-input"), [cover]);
    await fireEvent.submit(screen.getByTestId("contribuir-form"));

    expect(onsubmit.mock.calls[0][0].coverImage).toBe(cover);
  });

  it("mostra o erro de upload devolvido pela página e desabilita o botão enquanto envia", () => {
    render(ContribuirForm, {
      props: { onsubmit: vi.fn(), submitting: true, submitError: "Falha ao enviar o PDF." },
    });
    expect(screen.getByTestId("submit-error")).toHaveTextContent("Falha ao enviar o PDF.");
    expect(screen.getByTestId("contribuir-submit")).toBeDisabled();
  });
});
