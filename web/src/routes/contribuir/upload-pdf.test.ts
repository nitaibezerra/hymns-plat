/**
 * Sub-marco 5.F — Ciclo 5F.8.
 *
 * O upload multipart NÃO migra pra GraphQL (decisão fixa do Marco 5): a SPA
 * faz `fetch` com `FormData` contra o POST de `/contribuir/`
 * (`apps/users/views.py::upload_view`), que grava o tempfile, cria a
 * `OCRTask` e responde com redirect pra `processando/?task=<uuid>`.
 *
 * Contrato desta camada:
 *   - nomes dos campos idênticos aos de `HymnBookPdfUploadForm`
 *     (`name`, `owner_name`, `pdf_file`, `cover_image`);
 *   - cookie de sessão enviado (`credentials: include`) e CSRF no header;
 *   - o `taskId` sai do `?task=` da URL final do redirect;
 *   - falha devolve mensagem em PT-BR, nunca exceção solta.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { contribuirUploadUrl, extractTaskId, uploadPdfForOcr } from "./upload-pdf";

const TASK_ID = "6f1c0d3e-9a52-4c81-bf0e-9a1a1c1d2e3f";

function makeFile(filename: string, type = "application/pdf"): File {
  return new File(["conteúdo"], filename, { type });
}

function payload(coverImage: File | null = null) {
  return {
    name: "O Justiceiro",
    ownerName: "Padrinho Sebastião",
    pdfFile: makeFile("hinario.pdf"),
    coverImage,
  };
}

/** Resposta que simula o redirect seguido pelo browser. */
function redirectedResponse(taskId: string) {
  const response = new Response("<html>processando</html>", { status: 200 });
  Object.defineProperty(response, "url", {
    value: `http://localhost:8000/contribuir/processando/?task=${taskId}`,
  });
  Object.defineProperty(response, "redirected", { value: true });
  return response;
}

beforeEach(() => {
  document.cookie = "csrftoken=TOKEN123";
});

describe("contribuirUploadUrl (5F.8)", () => {
  it("aponta pro /contribuir/ do mesmo host do GraphQL", () => {
    expect(contribuirUploadUrl()).toMatch(/^https?:\/\/[^/]+\/contribuir\/$/);
  });
});

describe("extractTaskId (5F.8)", () => {
  it("lê o ?task= da URL do redirect", () => {
    expect(extractTaskId(`http://x/contribuir/processando/?task=${TASK_ID}`)).toBe(TASK_ID);
  });

  it("devolve null quando não há task na URL", () => {
    expect(extractTaskId("http://x/contribuir/")).toBeNull();
  });

  it("devolve null pra URL inválida em vez de estourar", () => {
    expect(extractTaskId("não-é-url")).toBeNull();
  });
});

describe("uploadPdfForOcr (5F.8)", () => {
  it("faz POST multipart com os nomes de campo do form Django", async () => {
    const fetchFn = vi.fn().mockResolvedValue(redirectedResponse(TASK_ID));
    await uploadPdfForOcr(fetchFn, payload());

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/contribuir\/$/);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");

    const body = init.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("name")).toBe("O Justiceiro");
    expect(body.get("owner_name")).toBe("Padrinho Sebastião");
    expect((body.get("pdf_file") as File).name).toBe("hinario.pdf");
    expect(body.get("cover_image")).toBeNull();
  });

  it("inclui a capa quando informada", async () => {
    const fetchFn = vi.fn().mockResolvedValue(redirectedResponse(TASK_ID));
    await uploadPdfForOcr(fetchFn, payload(makeFile("capa.jpg", "image/jpeg")));
    const body = (fetchFn.mock.calls[0][1] as RequestInit).body as FormData;
    expect((body.get("cover_image") as File).name).toBe("capa.jpg");
  });

  it("manda o CSRF token no header (o POST do Django é protegido)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(redirectedResponse(TASK_ID));
    await uploadPdfForOcr(fetchFn, payload());
    const headers = (fetchFn.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["X-CSRFToken"]).toBe("TOKEN123");
  });

  it("não define Content-Type — o browser precisa gerar o boundary", async () => {
    const fetchFn = vi.fn().mockResolvedValue(redirectedResponse(TASK_ID));
    await uploadPdfForOcr(fetchFn, payload());
    const headers = (fetchFn.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
  });

  it("devolve o taskId lido do redirect", async () => {
    const fetchFn = vi.fn().mockResolvedValue(redirectedResponse(TASK_ID));
    await expect(uploadPdfForOcr(fetchFn, payload())).resolves.toEqual({
      ok: true,
      taskId: TASK_ID,
    });
  });

  it("erro HTTP devolve mensagem em PT-BR", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    const result = await uploadPdfForOcr(fetchFn, payload());
    expect(result).toMatchObject({ ok: false });
    expect((result as { message: string }).message).toMatch(/não foi possível|falha/i);
  });

  it("resposta sem task devolve mensagem em PT-BR em vez de taskId vazio", async () => {
    const response = new Response("<html>formulário com erro</html>", { status: 200 });
    Object.defineProperty(response, "url", { value: "http://localhost:8000/contribuir/" });
    const fetchFn = vi.fn().mockResolvedValue(response);
    const result = await uploadPdfForOcr(fetchFn, payload());
    expect(result.ok).toBe(false);
    expect((result as { message: string }).message).toMatch(/recus|não foi possível|verifique/i);
  });

  it("erro de rede não vaza exceção", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const result = await uploadPdfForOcr(fetchFn, payload());
    expect(result.ok).toBe(false);
    expect((result as { message: string }).message).toMatch(/rede|conex/i);
  });
});
