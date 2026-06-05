/**
 * Marco 4.B — Ciclo 4B.7.
 *
 * `_loadLayout` é a load function global do shell. Roda em SSR + CSR, busca
 * o `currentUser` no GraphQL e propaga para todas as páginas (Header lê
 * data.currentUser para decidir entre avatar/Entrar).
 *
 * Erros HTTP / GraphQL não derrubam o layout — tratam graciosamente
 * devolvendo `{ currentUser: null }`. Usuário anônimo é o caso mais comum
 * e o backend retorna `currentUser: null` num 200, o que também resulta
 * em `{ currentUser: null }` na saída.
 */

import { describe, expect, it, vi } from "vitest";

import { _loadLayout } from "./+layout";

function fakeFetch<T>(payload: T, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("_loadLayout", () => {
  it("retorna currentUser quando há sessão autenticada", async () => {
    const fetchFn = fakeFetch({
      data: { currentUser: { id: "u1", username: "ana", email: "ana@example.com" } },
    });
    const result = await _loadLayout({ fetch: fetchFn });
    expect(result.currentUser).toEqual({ id: "u1", username: "ana", email: "ana@example.com" });
  });

  it("retorna currentUser=null quando o usuário é anônimo", async () => {
    const fetchFn = fakeFetch({ data: { currentUser: null } });
    const result = await _loadLayout({ fetch: fetchFn });
    expect(result.currentUser).toBeNull();
  });

  it("retorna currentUser=null sem propagar quando há erro HTTP", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    const result = await _loadLayout({ fetch: fetchFn });
    expect(result.currentUser).toBeNull();
  });

  it("retorna currentUser=null sem propagar quando há erro GraphQL", async () => {
    const fetchFn = fakeFetch({ errors: [{ message: "boom" }] });
    const result = await _loadLayout({ fetch: fetchFn });
    expect(result.currentUser).toBeNull();
  });
});
