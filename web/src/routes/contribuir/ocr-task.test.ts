/**
 * Sub-marco 5.F — Ciclo 5F.9.
 *
 * `fetchOcrTask` adapta `Query.ocrTask(id)` ao contrato do `ocr-polling`:
 *   - task encontrada → `{ kind: "task" }`;
 *   - `ocrTask: null` (inexistente ou sem permissão) → `{ kind: "missing" }`;
 *   - erro HTTP/GraphQL/rede → `{ kind: "error" }`, que o polling trata como
 *     transitório e tenta de novo.
 */

import { describe, expect, it, vi } from "vitest";

import { fetchOcrTask } from "./ocr-task";

const TASK_ID = "6f1c0d3e-9a52-4c81-bf0e-9a1a1c1d2e3f";

function fakeFetch<T>(payload: T, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("fetchOcrTask (5F.9)", () => {
  it("devolve o snapshot da task", async () => {
    const fetchFn = fakeFetch({
      data: {
        ocrTask: {
          id: TASK_ID,
          status: "processing",
          currentPage: 2,
          totalPages: 8,
          progressPct: 25,
          errorMessage: "",
          pdfFilename: "hinario.pdf",
          resultData: null,
        },
      },
    });
    const result = await fetchOcrTask(fetchFn, TASK_ID);
    expect(result).toMatchObject({ kind: "task" });
    expect(result).toMatchObject({ task: { id: TASK_ID, totalPages: 8 } });
  });

  it("ocrTask nulo é 'missing' (não existe ou sem permissão)", async () => {
    const fetchFn = fakeFetch({ data: { ocrTask: null } });
    await expect(fetchOcrTask(fetchFn, TASK_ID)).resolves.toEqual({ kind: "missing" });
  });

  it("erro GraphQL vira 'error' com a mensagem", async () => {
    const fetchFn = fakeFetch({ data: null, errors: [{ message: "Permission denied" }] });
    await expect(fetchOcrTask(fetchFn, TASK_ID)).resolves.toEqual({
      kind: "error",
      message: "Permission denied",
    });
  });

  it("erro HTTP vira 'error'", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 502 }));
    await expect(fetchOcrTask(fetchFn, TASK_ID)).resolves.toMatchObject({ kind: "error" });
  });

  it("exceção de rede vira 'error' em PT-BR", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const result = await fetchOcrTask(fetchFn, TASK_ID);
    expect(result.kind).toBe("error");
    expect((result as { message: string }).message).toMatch(/rede|conex/i);
  });
});
