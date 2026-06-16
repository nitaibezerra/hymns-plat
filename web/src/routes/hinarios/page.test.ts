/**
 * Marco 3 — Ciclo 3.5.
 *
 * Load function da lista de hinários. Comportamentos:
 * - mapeia o array `hymnbooks` da resposta GraphQL pra `data.hymnbooks`
 * - retorna lista vazia (não null) em caso de resposta vazia
 * - propaga erros via `data.error`
 */

import { describe, expect, it, vi } from "vitest";

import { _loadHymnbooks } from "./+page";

function fakeFetch<T>(payload: T, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("hinarios load function", () => {
  it("returns the list of hymnbooks", async () => {
    const fetchFn = fakeFetch({
      data: {
        hymnbooks: [
          { id: "1", name: "O Cruzeiro", slug: "cruzeiro", isPublished: true },
          { id: "2", name: "O Justiceiro", slug: "justiceiro", isPublished: true },
        ],
      },
    });
    const result = await _loadHymnbooks({ fetch: fetchFn });
    expect(result.hymnbooks).toHaveLength(2);
    expect(result.hymnbooks[0].slug).toBe("cruzeiro");
    expect(result.error).toBeNull();
  });

  it("returns empty list when response has no hymnbooks", async () => {
    const fetchFn = fakeFetch({ data: { hymnbooks: [] } });
    const result = await _loadHymnbooks({ fetch: fetchFn });
    expect(result.hymnbooks).toEqual([]);
  });

  it("propagates HTTP errors", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    const result = await _loadHymnbooks({ fetch: fetchFn });
    expect(result.hymnbooks).toEqual([]);
    expect(result.error).toMatch(/HTTP 500/);
  });
});
