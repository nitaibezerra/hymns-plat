/**
 * Marco 4.G — Ciclo 4G.1.
 *
 * Load function da página de busca. Comportamento esperado:
 *
 *   - Com `?q=<termo>` na URL, chama `Query.search(q, kind: ALL)` via GraphQL.
 *   - Sem `q` (ou `q` vazio) NÃO chama o backend; devolve `{hymns: [], hymnbooks: []}`.
 *   - Propaga erros HTTP/GraphQL via `data.error`.
 *   - Echo do termo em `data.query` para o componente pré-popular o input.
 */

import { describe, expect, it, vi } from "vitest";

import { _loadSearch } from "./+page";

function fakeFetch<T>(payload: T, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function urlWithQuery(q: string | null): URL {
  const u = new URL("http://localhost/busca");
  if (q !== null) u.searchParams.set("q", q);
  return u;
}

describe("busca load function", () => {
  it("chama Query.search quando há ?q=...", async () => {
    const fetchFn = fakeFetch({
      data: {
        search: {
          hymns: [
            { id: "h1", number: 1, title: "Estrela Brilhante", reviewStatus: "REVIEWED" },
          ],
          hymnbooks: [
            { id: "b1", name: "O Cruzeiro", slug: "cruzeiro", isPublished: true },
          ],
        },
      },
    });
    const result = await _loadSearch({ fetch: fetchFn, url: urlWithQuery("estrela") });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [, init] = fetchFn.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.query).toMatch(/search\s*\(\s*q\s*:\s*\$q/);
    expect(body.variables).toEqual({ q: "estrela", kind: "ALL" });

    expect(result.query).toBe("estrela");
    expect(result.results.hymns).toHaveLength(1);
    expect(result.results.hymnbooks).toHaveLength(1);
    expect(result.error).toBeNull();
  });

  it("não chama GraphQL e devolve resultados vazios quando q ausente", async () => {
    const fetchFn = vi.fn();
    const result = await _loadSearch({ fetch: fetchFn, url: urlWithQuery(null) });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result.query).toBe("");
    expect(result.results).toEqual({ hymns: [], hymnbooks: [] });
    expect(result.error).toBeNull();
  });

  it("não chama GraphQL quando q está vazio ou só whitespace", async () => {
    const fetchFn = vi.fn();
    const result = await _loadSearch({ fetch: fetchFn, url: urlWithQuery("   ") });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result.query).toBe("");
    expect(result.results).toEqual({ hymns: [], hymnbooks: [] });
  });

  it("propaga erros HTTP via data.error", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    const result = await _loadSearch({ fetch: fetchFn, url: urlWithQuery("foo") });
    expect(result.results).toEqual({ hymns: [], hymnbooks: [] });
    expect(result.error).toMatch(/HTTP 500/);
    expect(result.query).toBe("foo");
  });
});
