/**
 * Sub-marco 5.F — Ciclo 5F.9.
 *
 * Tela 2 do wizard. Substitui o polling inline do template Django (que batia
 * no JSON `contribuir/ocr-status/<id>/`) por `Query.ocrTask(id)`.
 *
 * Contrato da load function:
 *   - sem `?task=` → redirect pra `/contribuir/` (o Django faz
 *     `redirect("users:upload")`);
 *   - erro de auth/permissão → redirect pro login preservando o passo;
 *   - `ocrTask` nulo → 404 em PT-BR (o Django levanta `Http404`);
 *   - task existente → devolve o snapshot inicial (pro SSR já pintar a barra).
 *
 * Contrato da tela: renderiza o progresso vindo do polling.
 */

import { render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OCR_POLL_INTERVAL_MS } from "$lib/ocr-polling";

import Page from "./+page.svelte";
import { _loadProcessando } from "./+page";

const gotoMock = vi.fn();
vi.mock("$app/navigation", () => ({
  goto: (...args: unknown[]) => gotoMock(...args),
}));

const TASK_ID = "6f1c0d3e-9a52-4c81-bf0e-9a1a1c1d2e3f";

function fakeFetch<T>(payload: T, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function makeUrl(search = `?task=${TASK_ID}`) {
  return new URL(`http://localhost/contribuir/processando/${search}`);
}

function taskPayload(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      ocrTask: {
        id: TASK_ID,
        status: "processing",
        currentPage: 3,
        totalPages: 12,
        progressPct: 25,
        errorMessage: "",
        pdfFilename: "hinario.pdf",
        resultData: null,
        ...overrides,
      },
    },
  };
}

describe("processando load function (5F.9)", () => {
  it("consulta Query.ocrTask com o id da URL", async () => {
    const fetchFn = fakeFetch(taskPayload());
    await _loadProcessando({ fetch: fetchFn, url: makeUrl() });
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.query).toMatch(/ocrTask\s*\(\s*id\s*:\s*\$id/);
    expect(body.variables).toEqual({ id: TASK_ID });
  });

  it("devolve o snapshot inicial da task", async () => {
    const fetchFn = fakeFetch(taskPayload());
    const result = await _loadProcessando({ fetch: fetchFn, url: makeUrl() });
    expect(result.taskId).toBe(TASK_ID);
    expect(result.task).toMatchObject({ status: "processing", currentPage: 3, totalPages: 12 });
  });

  it("sem ?task= redireciona pra /contribuir/", async () => {
    const fetchFn = fakeFetch(taskPayload());
    await expect(_loadProcessando({ fetch: fetchFn, url: makeUrl("") })).rejects.toMatchObject({
      status: 302,
      location: "/contribuir/",
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("erro de auth redireciona pro login preservando o passo", async () => {
    const fetchFn = fakeFetch({
      data: { ocrTask: null },
      errors: [{ message: "User must be authenticated" }],
    });
    await expect(_loadProcessando({ fetch: fetchFn, url: makeUrl() })).rejects.toMatchObject({
      status: 302,
      location: "/login?next=/contribuir/processando/",
    });
  });

  it("ocrTask nulo devolve 404 em PT-BR", async () => {
    const fetchFn = fakeFetch({ data: { ocrTask: null } });
    await expect(_loadProcessando({ fetch: fetchFn, url: makeUrl() })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("erro HTTP não derruba a tela — vira data.error com a task nula", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    const result = await _loadProcessando({ fetch: fetchFn, url: makeUrl() });
    expect(result.error).toMatch(/HTTP 500/);
    expect(result.task).toBeNull();
  });
});

describe("processando page (5F.9)", () => {
  function pageData(overrides: Record<string, unknown> = {}) {
    return {
      currentUser: null,
      taskId: TASK_ID,
      task: {
        id: TASK_ID,
        status: "processing",
        currentPage: 4,
        totalPages: 16,
        progressPct: 25,
        errorMessage: "",
        pdfFilename: "hinario.pdf",
        resultData: null,
      },
      error: null,
      ...overrides,
    };
  }

  it("mostra o passo 2 do stepper", () => {
    render(Page, { props: { data: pageData() } });
    const steps = screen.getAllByTestId("upload-step");
    expect(steps[0]).toHaveAttribute("data-state", "done");
    expect(steps[1]).toHaveAttribute("data-state", "current");
  });

  it("renderiza 'Página N de M' do snapshot inicial", () => {
    render(Page, { props: { data: pageData() } });
    expect(screen.getByTestId("ocr-progress-text")).toHaveTextContent("Página 4 de 16");
  });

  it("renderiza a barra de progresso com o progressPct", () => {
    render(Page, { props: { data: pageData() } });
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
  });
});

describe("processando estados terminais (5F.10)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  function fetchReturning(payload: unknown) {
    return vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }

  it("task failed mostra o erro e para de consultar o backend", async () => {
    vi.useFakeTimers();
    const fetchSpy = fetchReturning(
      taskPayload({ status: "failed", errorMessage: "Nenhum hino extraído do PDF." }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    render(Page, { props: { data: { currentUser: null, taskId: TASK_ID, task: null, error: null } } });
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("ocr-failed")).toHaveTextContent("Nenhum hino extraído do PDF.");

    await vi.advanceTimersByTimeAsync(OCR_POLL_INTERVAL_MS * 3);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("task inexistente mostra erro definitivo e para de consultar", async () => {
    vi.useFakeTimers();
    const fetchSpy = fetchReturning({ data: { ocrTask: null } });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    render(Page, { props: { data: { currentUser: null, taskId: TASK_ID, task: null, error: null } } });
    await vi.advanceTimersByTimeAsync(0);

    expect(screen.getByTestId("ocr-fatal")).toHaveTextContent(/não encontrada/i);
    expect(screen.queryByTestId("ocr-network-error")).toBeNull();

    await vi.advanceTimersByTimeAsync(OCR_POLL_INTERVAL_MS * 3);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("erro de rede segue tentando e mantém a barra", async () => {
    vi.useFakeTimers();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 502 }))
      .mockResolvedValue(
        new Response(JSON.stringify(taskPayload({ currentPage: 7, totalPages: 9 })), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    render(Page, { props: { data: { currentUser: null, taskId: TASK_ID, task: null, error: null } } });
    await vi.advanceTimersByTimeAsync(0);
    expect(screen.getByTestId("ocr-network-error")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(OCR_POLL_INTERVAL_MS);
    expect(screen.getByTestId("ocr-progress-text")).toHaveTextContent("Página 7 de 9");
    expect(screen.queryByTestId("ocr-network-error")).toBeNull();
  });
});

describe("processando ramifica ao concluir (5F.11)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    gotoMock.mockClear();
  });

  function jsonResponse(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const completedTask = () =>
    taskPayload({
      status: "completed",
      progressPct: 100,
      resultData: { hymn_book: { name: "O Justiceiro", owner: "Padrinho", hymns: [] } },
    });

  function renderPage() {
    render(Page, { props: { data: { currentUser: null, taskId: TASK_ID, task: null, error: null } } });
  }

  it("com duplicatas navega pra desambiguar", async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(completedTask()))
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            ocrDuplicates: {
              exactMatch: null,
              highConfidence: [
                {
                  nameScore: 0.9,
                  contentScore: 0.95,
                  hymnbook: {
                    id: "b1",
                    name: "O Justiceiro",
                    slug: "o-justiceiro",
                    ownerName: "Padrinho",
                    stats: { hymnsTotal: 20 },
                  },
                },
              ],
            },
          },
        }),
      ) as unknown as typeof fetch;

    renderPage();
    await vi.advanceTimersByTimeAsync(0);

    expect(gotoMock).toHaveBeenCalledWith(`/contribuir/desambiguar/?task=${TASK_ID}`);
  });

  it("sem duplicatas navega direto pra conferir", async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(completedTask()))
      .mockResolvedValueOnce(
        jsonResponse({ data: { ocrDuplicates: { exactMatch: null, highConfidence: [] } } }),
      ) as unknown as typeof fetch;

    renderPage();
    await vi.advanceTimersByTimeAsync(0);

    expect(gotoMock).toHaveBeenCalledWith(`/contribuir/conferir/?task=${TASK_ID}`);
  });

  it("desambiguação indisponível no backend não trava: vai pra conferir", async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(completedTask()))
      .mockResolvedValueOnce(
        jsonResponse({ data: null, errors: [{ message: "Cannot query field 'ocrDuplicates'" }] }),
      ) as unknown as typeof fetch;

    renderPage();
    await vi.advanceTimersByTimeAsync(0);

    expect(gotoMock).toHaveBeenCalledWith(`/contribuir/conferir/?task=${TASK_ID}`);
  });

  it("task que falhou não navega pra nenhum passo", async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(taskPayload({ status: "failed", errorMessage: "erro" }))) as unknown as typeof fetch;

    renderPage();
    await vi.advanceTimersByTimeAsync(0);

    expect(gotoMock).not.toHaveBeenCalled();
  });

  it("completed sem resultData ainda não navega", async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(taskPayload({ status: "completed", resultData: null })),
      ) as unknown as typeof fetch;

    renderPage();
    await vi.advanceTimersByTimeAsync(0);

    expect(gotoMock).not.toHaveBeenCalled();
  });
});
