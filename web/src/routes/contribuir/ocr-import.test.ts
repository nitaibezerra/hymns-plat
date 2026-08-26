/**
 * Sub-marco 5.F — Ciclo 5F.15.
 *
 * As duas mutations que fecham o wizard. Contrato desta camada:
 *   - manda o CSRF token (mutation atravessa o `CsrfViewMiddleware`);
 *   - sucesso devolve o `slug` pra tela navegar pro detalhe do hinário;
 *   - erro tipado da união (`PermissionDeniedError` / `NotFoundError` /
 *     `ValidationError`) devolve a `message` do backend;
 *   - erro HTTP / de rede / de schema devolve mensagem em PT-BR — nunca
 *     exceção solta, porque a tela precisa continuar viva pro usuário tentar
 *     de novo sem perder a conferência.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createHymnBookFromOcr } from "./ocr-import";

const TASK_ID = "6f1c0d3e-9a52-4c81-bf0e-9a1a1c1d2e3f";

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  document.cookie = "csrftoken=TOKEN123";
});

describe("createHymnBookFromOcr (5F.15)", () => {
  it("chama a mutation com o taskId", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
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
    );
    await createHymnBookFromOcr(fetchFn, TASK_ID);
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.query).toMatch(/createHymnBookFromOcr\s*\(\s*taskId\s*:\s*\$taskId/);
    expect(body.variables).toEqual({ taskId: TASK_ID });
  });

  it("manda o CSRF token", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          createHymnBookFromOcr: { __typename: "HymnBookType", id: "b1", name: "N", slug: "s" },
        },
      }),
    );
    await createHymnBookFromOcr(fetchFn, TASK_ID);
    const headers = (fetchFn.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["X-CSRFToken"]).toBe("TOKEN123");
  });

  it("sucesso devolve slug e nome", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
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
    );
    await expect(createHymnBookFromOcr(fetchFn, TASK_ID)).resolves.toEqual({
      ok: true,
      slug: "o-justiceiro",
      name: "O Justiceiro",
    });
  });

  it("erro tipado da união devolve a mensagem do backend", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          createHymnBookFromOcr: {
            __typename: "PermissionDeniedError",
            message: "Você não tem acesso a essa tarefa.",
          },
        },
      }),
    );
    await expect(createHymnBookFromOcr(fetchFn, TASK_ID)).resolves.toEqual({
      ok: false,
      message: "Você não tem acesso a essa tarefa.",
    });
  });

  it("erro GraphQL (mutation ainda não existe no schema) devolve mensagem em PT-BR", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        data: null,
        errors: [{ message: "Cannot query field 'createHymnBookFromOcr' on type 'Mutation'." }],
      }),
    );
    const result = await createHymnBookFromOcr(fetchFn, TASK_ID);
    expect(result.ok).toBe(false);
    expect((result as { message: string }).message).toMatch(/não foi possível criar o hinário/i);
  });

  it("erro HTTP devolve mensagem em PT-BR", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    const result = await createHymnBookFromOcr(fetchFn, TASK_ID);
    expect(result.ok).toBe(false);
    expect((result as { message: string }).message).toMatch(/não foi possível criar o hinário/i);
  });

  it("erro de rede não vaza exceção", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const result = await createHymnBookFromOcr(fetchFn, TASK_ID);
    expect(result.ok).toBe(false);
    expect((result as { message: string }).message).toMatch(/rede|conex/i);
  });

  it("resposta sem payload devolve mensagem em PT-BR", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ data: { createHymnBookFromOcr: null } }));
    const result = await createHymnBookFromOcr(fetchFn, TASK_ID);
    expect(result.ok).toBe(false);
    expect((result as { message: string }).message).toBeTruthy();
  });
});
