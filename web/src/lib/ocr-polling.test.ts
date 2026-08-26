/**
 * Sub-marco 5.F — Ciclo 5F.9a.
 *
 * Polling da `OCRTask` isolado da tela, testado com timer fake. O que está
 * pinado aqui:
 *
 *   - primeira consulta é imediata (o usuário não espera 1,8 s por nada);
 *   - intervalo de 1,8 s entre consultas, igual ao do template Django
 *     (`templates/users/upload_processing.html`);
 *   - para em `failed` e em `completed` **com** `resultData`;
 *   - `completed` sem `resultData` NÃO é fim: é o estado transitório que
 *     existe porque `OCRTaskType.resultData` é `JSON` nulável e o modelo
 *     grava o resultado depois de mudar o status. Espelha o
 *     `if task.status == COMPLETED and task.result_data` da
 *     `upload_processing_view`. Com tolerância esgotada, reporta erro em
 *     vez de girar pra sempre;
 *   - erro de rede não mata a tela: reporta e continua tentando;
 *   - `stop()` cancela o próximo tick e ignora resposta em vôo.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OCR_POLL_INTERVAL_MS, isOcrFinalStatus, isOcrTaskReady, startOcrPolling } from "./ocr-polling";

import type { OcrFetchResult, OcrTaskSnapshot } from "./ocr-polling";

function task(overrides: Partial<OcrTaskSnapshot> = {}): OcrTaskSnapshot {
  return {
    id: "task-1",
    status: "processing",
    currentPage: 2,
    totalPages: 10,
    progressPct: 20,
    errorMessage: "",
    pdfFilename: "hinario.pdf",
    resultData: null,
    ...overrides,
  };
}

function ok(overrides: Partial<OcrTaskSnapshot> = {}): OcrFetchResult {
  return { kind: "task", task: task(overrides) };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("isOcrFinalStatus (5F.9a)", () => {
  it("reconhece os dois status terminais do modelo Django", () => {
    expect(isOcrFinalStatus("completed")).toBe(true);
    expect(isOcrFinalStatus("failed")).toBe(true);
    expect(isOcrFinalStatus("pending")).toBe(false);
    expect(isOcrFinalStatus("processing")).toBe(false);
  });
});

describe("isOcrTaskReady (5F.9a)", () => {
  it("completed com resultData está pronta", () => {
    expect(isOcrTaskReady(task({ status: "completed", resultData: { hymn_book: {} } }))).toBe(true);
  });

  it("completed sem resultData ainda não está pronta", () => {
    expect(isOcrTaskReady(task({ status: "completed", resultData: null }))).toBe(false);
  });

  it("failed nunca está 'pronta' (é o ramo de erro)", () => {
    expect(isOcrTaskReady(task({ status: "failed" }))).toBe(false);
  });
});

describe("startOcrPolling (5F.9a)", () => {
  it("consulta imediatamente, sem esperar o primeiro intervalo", async () => {
    const fetchTask = vi.fn().mockResolvedValue(ok());
    startOcrPolling({ fetchTask });
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchTask).toHaveBeenCalledTimes(1);
  });

  it("repete a cada 1,8 s enquanto a task não termina", async () => {
    const fetchTask = vi.fn().mockResolvedValue(ok());
    const handle = startOcrPolling({ fetchTask });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(OCR_POLL_INTERVAL_MS);
    expect(fetchTask).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(OCR_POLL_INTERVAL_MS);
    expect(fetchTask).toHaveBeenCalledTimes(3);
    handle.stop();
  });

  it("o intervalo default é 1800 ms", () => {
    expect(OCR_POLL_INTERVAL_MS).toBe(1800);
  });

  it("não consulta antes de completar o intervalo", async () => {
    const fetchTask = vi.fn().mockResolvedValue(ok());
    const handle = startOcrPolling({ fetchTask });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(OCR_POLL_INTERVAL_MS - 1);
    expect(fetchTask).toHaveBeenCalledTimes(1);
    handle.stop();
  });

  it("informa cada atualização de progresso", async () => {
    const onUpdate = vi.fn();
    const fetchTask = vi.fn().mockResolvedValue(ok({ currentPage: 3, progressPct: 30 }));
    const handle = startOcrPolling({ fetchTask, onUpdate });
    await vi.advanceTimersByTimeAsync(0);
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ currentPage: 3, progressPct: 30 }));
    handle.stop();
  });

  it("para em completed com resultData e avisa onDone", async () => {
    const onDone = vi.fn();
    const fetchTask = vi
      .fn()
      .mockResolvedValueOnce(ok())
      .mockResolvedValue(ok({ status: "completed", progressPct: 100, resultData: { hymn_book: {} } }));
    startOcrPolling({ fetchTask, onDone });

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(OCR_POLL_INTERVAL_MS);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone.mock.calls[0][0]).toMatchObject({ status: "completed" });

    await vi.advanceTimersByTimeAsync(OCR_POLL_INTERVAL_MS * 3);
    expect(fetchTask).toHaveBeenCalledTimes(2);
  });

  it("para em failed e avisa onDone com a mensagem de erro da task", async () => {
    const onDone = vi.fn();
    const fetchTask = vi
      .fn()
      .mockResolvedValue(ok({ status: "failed", errorMessage: "PDF ilegível" }));
    startOcrPolling({ fetchTask, onDone });

    await vi.advanceTimersByTimeAsync(0);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone.mock.calls[0][0]).toMatchObject({ status: "failed", errorMessage: "PDF ilegível" });

    await vi.advanceTimersByTimeAsync(OCR_POLL_INTERVAL_MS * 3);
    expect(fetchTask).toHaveBeenCalledTimes(1);
  });

  it("completed com resultData nulo continua o polling (não chama onDone)", async () => {
    const onDone = vi.fn();
    const fetchTask = vi.fn().mockResolvedValue(ok({ status: "completed", resultData: null }));
    const handle = startOcrPolling({ fetchTask, onDone, emptyResultTolerance: 5 });

    await vi.advanceTimersByTimeAsync(0);
    expect(onDone).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(OCR_POLL_INTERVAL_MS);
    expect(fetchTask).toHaveBeenCalledTimes(2);
    expect(onDone).not.toHaveBeenCalled();
    handle.stop();
  });

  it("resultData nulo além da tolerância reporta erro em PT-BR e para", async () => {
    const onError = vi.fn();
    const onDone = vi.fn();
    const fetchTask = vi.fn().mockResolvedValue(ok({ status: "completed", resultData: null }));
    startOcrPolling({ fetchTask, onError, onDone, emptyResultTolerance: 2 });

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(OCR_POLL_INTERVAL_MS);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toMatch(/resultado/i);
    expect(onDone).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(OCR_POLL_INTERVAL_MS * 3);
    expect(fetchTask).toHaveBeenCalledTimes(2);
  });

  it("erro de rede reporta e continua tentando (não mata a tela)", async () => {
    const onError = vi.fn();
    const fetchTask = vi
      .fn()
      .mockResolvedValueOnce({ kind: "error", message: "HTTP 502" })
      .mockResolvedValue(ok({ currentPage: 5 }));
    const onUpdate = vi.fn();
    const handle = startOcrPolling({ fetchTask, onError, onUpdate });

    await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledWith("HTTP 502");
    expect(onUpdate).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(OCR_POLL_INTERVAL_MS);
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ currentPage: 5 }));
    handle.stop();
  });

  it("exceção lançada pelo fetchTask não derruba o polling", async () => {
    const onError = vi.fn();
    const fetchTask = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue(ok());
    const handle = startOcrPolling({ fetchTask, onError });

    await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(OCR_POLL_INTERVAL_MS);
    expect(fetchTask).toHaveBeenCalledTimes(2);
    handle.stop();
  });

  it("task inexistente (ou sem permissão) para o polling e avisa onMissing", async () => {
    const onMissing = vi.fn();
    const fetchTask = vi.fn().mockResolvedValue({ kind: "missing" } as OcrFetchResult);
    startOcrPolling({ fetchTask, onMissing });

    await vi.advanceTimersByTimeAsync(0);
    expect(onMissing).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(OCR_POLL_INTERVAL_MS * 3);
    expect(fetchTask).toHaveBeenCalledTimes(1);
  });

  it("stop() cancela o próximo tick", async () => {
    const fetchTask = vi.fn().mockResolvedValue(ok());
    const handle = startOcrPolling({ fetchTask });
    await vi.advanceTimersByTimeAsync(0);
    handle.stop();
    await vi.advanceTimersByTimeAsync(OCR_POLL_INTERVAL_MS * 5);
    expect(fetchTask).toHaveBeenCalledTimes(1);
  });

  it("stop() durante a requisição descarta o resultado em vôo", async () => {
    let resolveFetch: ((value: OcrFetchResult) => void) | undefined;
    const fetchTask = vi.fn().mockImplementation(
      () =>
        new Promise<OcrFetchResult>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const onUpdate = vi.fn();
    const handle = startOcrPolling({ fetchTask, onUpdate });
    await vi.advanceTimersByTimeAsync(0);

    handle.stop();
    resolveFetch?.(ok());
    await vi.advanceTimersByTimeAsync(OCR_POLL_INTERVAL_MS * 2);

    expect(onUpdate).not.toHaveBeenCalled();
    expect(fetchTask).toHaveBeenCalledTimes(1);
  });

  it("stop() é idempotente", async () => {
    const fetchTask = vi.fn().mockResolvedValue(ok());
    const handle = startOcrPolling({ fetchTask });
    await vi.advanceTimersByTimeAsync(0);
    handle.stop();
    handle.stop();
    await vi.advanceTimersByTimeAsync(OCR_POLL_INTERVAL_MS * 2);
    expect(fetchTask).toHaveBeenCalledTimes(1);
  });
});
