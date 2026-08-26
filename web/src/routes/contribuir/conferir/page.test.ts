/**
 * Sub-marco 5.F — Ciclo 5F.14.
 *
 * Tela 3b do wizard, porta de `apps/users/views.py::upload_preview_view` e do
 * template `upload_preview.html`. A rota mudou de nome de propósito
 * (`preview/` → `conferir/`), acompanhando o rótulo CONFERIR do stepper.
 *
 * Contrato da load function: task na URL, dados do hinário e os 5 primeiros
 * hinos vindos de `ocrTask.resultData`.
 *
 * Contrato da tela: prévia do texto extraído, tabela e o aviso de rascunho —
 * o hinário entra `is_published=False` e cada hino como não revisado.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Page from "./+page.svelte";
import { _loadConferir } from "./+page";

const gotoMock = vi.fn();
vi.mock("$app/navigation", () => ({
  goto: (...args: unknown[]) => gotoMock(...args),
}));

const TASK_ID = "6f1c0d3e-9a52-4c81-bf0e-9a1a1c1d2e3f";

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeUrl(search = `?task=${TASK_ID}`) {
  return new URL(`http://localhost/contribuir/conferir/${search}`);
}

function ocrHymns(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    title: `Hino ${i + 1}`,
    text: `Verso do hino ${i + 1}`,
    ocr_avg_confidence: 90,
  }));
}

function taskPayload(count = 8) {
  return {
    data: {
      ocrTask: {
        id: TASK_ID,
        status: "completed",
        currentPage: 10,
        totalPages: 10,
        progressPct: 100,
        errorMessage: "",
        pdfFilename: "hinario.pdf",
        resultData: {
          hymn_book: {
            name: "O Justiceiro",
            owner: "Padrinho Sebastião",
            intro_name: "Justiceiro",
            hymns: ocrHymns(count),
          },
        },
      },
    },
  };
}

describe("conferir load function (5F.14)", () => {
  it("sem ?task= volta pra /contribuir/", async () => {
    const fetchFn = vi.fn();
    await expect(_loadConferir({ fetch: fetchFn, url: makeUrl("") })).rejects.toMatchObject({
      status: 302,
      location: "/contribuir/",
    });
  });

  it("erro de auth redireciona pro login preservando o passo", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ data: { ocrTask: null }, errors: [{ message: "Permission denied" }] }),
      );
    await expect(_loadConferir({ fetch: fetchFn, url: makeUrl() })).rejects.toMatchObject({
      status: 302,
      location: "/login?next=/contribuir/conferir/",
    });
  });

  it("task inexistente devolve 404", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ data: { ocrTask: null } }));
    await expect(_loadConferir({ fetch: fetchFn, url: makeUrl() })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("devolve nome, dono, total e só os 5 primeiros hinos", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(taskPayload(8)));
    const result = await _loadConferir({ fetch: fetchFn, url: makeUrl() });
    expect(result.name).toBe("O Justiceiro");
    expect(result.owner).toBe("Padrinho Sebastião");
    expect(result.totalHymns).toBe(8);
    expect(result.previewHymns).toHaveLength(5);
    expect(result.previewHymns[0]).toMatchObject({ number: 1, title: "Hino 1", ocrAvgConfidence: 90 });
  });

  it("task ainda sem resultData volta pro passo de processamento", async () => {
    const payload = taskPayload();
    (payload.data.ocrTask as { resultData: unknown; status: string }).resultData = null;
    (payload.data.ocrTask as { status: string }).status = "processing";
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(payload));
    await expect(_loadConferir({ fetch: fetchFn, url: makeUrl() })).rejects.toMatchObject({
      status: 302,
      location: `/contribuir/processando/?task=${TASK_ID}`,
    });
  });
});

function pageData(overrides: Record<string, unknown> = {}) {
  return {
    currentUser: null,
    taskId: TASK_ID,
    name: "O Justiceiro",
    owner: "Padrinho Sebastião",
    totalHymns: 23,
    previewHymns: [
      { number: 1, title: "Estrela Brilhante", text: "Verso um", ocrAvgConfidence: 92.4 },
      { number: 2, title: "Lua Branca", text: "Verso dois", ocrAvgConfidence: null },
    ],
    error: null,
    ...overrides,
  };
}

describe("conferir page (5F.14)", () => {
  it("mostra o passo 3 do stepper", () => {
    render(Page, { props: { data: pageData() } });
    expect(screen.getAllByTestId("upload-step")[2]).toHaveAttribute("data-state", "current");
  });

  it("avisa que será criado como rascunho", () => {
    render(Page, { props: { data: pageData() } });
    expect(screen.getByTestId("draft-warning")).toHaveTextContent(/será criado como rascunho/i);
  });

  it("mostra nome, dono e total de hinos detectados", () => {
    render(Page, { props: { data: pageData() } });
    const head = screen.getByTestId("conferir-summary");
    expect(head).toHaveTextContent("O Justiceiro");
    expect(head).toHaveTextContent("Padrinho Sebastião");
    expect(head).toHaveTextContent("23");
  });

  it("mostra a prévia do texto de cada hino", () => {
    render(Page, { props: { data: pageData() } });
    const preview = screen.getByTestId("conferir-preview");
    expect(preview).toHaveTextContent("Estrela Brilhante");
    expect(preview).toHaveTextContent("Verso um");
  });

  it("mostra a tabela Nº/Título/OCR com o rodapé do restante", () => {
    render(Page, { props: { data: pageData() } });
    expect(screen.getAllByTestId("ocr-preview-row")).toHaveLength(2);
    expect(screen.getByTestId("ocr-preview-more")).toHaveTextContent("21");
  });

  it("tem link pra voltar ao início do wizard", () => {
    render(Page, { props: { data: pageData() } });
    expect(screen.getByRole("link", { name: /voltar/i })).toHaveAttribute("href", "/contribuir/");
  });
});

describe("conferir submit (5F.15)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    gotoMock.mockClear();
    document.cookie = "csrftoken=TOKEN123";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("confirma, cria o hinário e navega pro detalhe", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          createHymnBookFromOcr: {
            __typename: "HymnBookType",
            id: "b1",
            name: "O Justiceiro",
            slug: "o-justiceiro",
          },
        },
      }),
    ) as unknown as typeof fetch;

    render(Page, { props: { data: pageData() } });
    await fireEvent.click(screen.getByTestId("conferir-submit"));

    await waitFor(() => expect(gotoMock).toHaveBeenCalledTimes(1));
    expect(gotoMock).toHaveBeenCalledWith("/hinarios/o-justiceiro/");
  });

  it("erro da mutation mostra mensagem e mantém a conferência na tela", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          createHymnBookFromOcr: {
            __typename: "ValidationError",
            message: "Task já consumida.",
            field: null,
          },
        },
      }),
    ) as unknown as typeof fetch;

    render(Page, { props: { data: pageData() } });
    await fireEvent.click(screen.getByTestId("conferir-submit"));

    await waitFor(() => expect(screen.getByTestId("conferir-submit-error")).toBeInTheDocument());
    expect(screen.getByTestId("conferir-submit-error")).toHaveTextContent("Task já consumida.");
    expect(gotoMock).not.toHaveBeenCalled();
    // O wizard continua ali: prévia, tabela e o botão pra tentar de novo.
    expect(screen.getByTestId("conferir-preview")).toBeInTheDocument();
    expect(screen.getAllByTestId("ocr-preview-row")).toHaveLength(2);
    expect(screen.getByTestId("conferir-submit")).toBeEnabled();
  });

  it("desabilita o botão enquanto envia", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    globalThis.fetch = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    ) as unknown as typeof fetch;

    render(Page, { props: { data: pageData() } });
    await fireEvent.click(screen.getByTestId("conferir-submit"));
    expect(screen.getByTestId("conferir-submit")).toBeDisabled();

    resolveFetch?.(jsonResponse({ data: { createHymnBookFromOcr: null } }));
    await waitFor(() => expect(screen.getByTestId("conferir-submit")).toBeEnabled());
  });
});
