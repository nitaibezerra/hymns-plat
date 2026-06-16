/**
 * Marco 3 — Ciclo 3.4 (parte 2).
 *
 * A load function da home consome `globalStats` do GraphQL e expõe `stats`
 * + `error`. Quando a API responde 200 com dados, `stats` é preenchido.
 * Quando há erro HTTP/GraphQL, `error` carrega a mensagem.
 */

import { describe, expect, it, vi } from "vitest";

import { _loadHome } from "./+page";

function fakeFetch<T>(payload: T, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("home load function", () => {
  it("populates stats from a successful response", async () => {
    const fetchFn = fakeFetch({
      data: { globalStats: { hymnbooks: 7, hymns: 200, audios: 50, activeReviewers: 3 } },
    });
    const result = await _loadHome({ fetch: fetchFn });
    expect(result.stats).toEqual({ hymnbooks: 7, hymns: 200, audios: 50, activeReviewers: 3 });
    expect(result.error).toBeNull();
  });

  it("propagates HTTP errors in `error`", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    const result = await _loadHome({ fetch: fetchFn });
    expect(result.stats).toBeNull();
    expect(result.error).toMatch(/HTTP 500/);
  });
});
