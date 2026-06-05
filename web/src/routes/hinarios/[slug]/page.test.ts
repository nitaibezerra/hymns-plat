/**
 * Marco 4.D — Detalhe do hinário (3 modos: índice / corrido / carrossel).
 *
 * Load function `_loadHymnbook` busca um hinário pelo slug com seus hinos
 * (id, number, title, body) populados. O modo de leitura é lido do
 * `event.url.searchParams.mode` e validado contra uma whitelist; modo inválido
 * cai para `indice`. Modo default (sem `?mode=`) também é `indice`.
 */

import { describe, expect, it, vi } from "vitest";

import { _loadHymnbook } from "./+page";

function fakeFetch<T>(payload: T, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function makeEvent(slug: string, modeParam?: string) {
  const url = new URL(
    `http://localhost/hinarios/${slug}${modeParam !== undefined ? `?mode=${modeParam}` : ""}`,
  );
  return {
    fetch: undefined as unknown as typeof globalThis.fetch,
    params: { slug },
    url,
  };
}

const sampleHymnbook = {
  id: "hb-1",
  name: "O Justiceiro",
  slug: "justiceiro",
  isPublished: true,
  hymns: [
    { id: "h-1", number: 1, title: "Abertura", body: "Verso 1\nVerso 2" },
    { id: "h-2", number: 2, title: "Saudação", body: "Estrofe A\nEstrofe B" },
  ],
};

describe("hinarios/[slug] load function", () => {
  it("retorna hinário com hinos populados (id, number, title, body)", async () => {
    const fetchFn = fakeFetch({ data: { hymnbook: sampleHymnbook } });
    const event = { ...makeEvent("justiceiro"), fetch: fetchFn };
    const result = await _loadHymnbook(event);
    expect(result.hymnbook).not.toBeNull();
    expect(result.hymnbook?.slug).toBe("justiceiro");
    expect(result.hymnbook?.hymns).toHaveLength(2);
    expect(result.hymnbook?.hymns[0].id).toBe("h-1");
    expect(result.hymnbook?.hymns[0].number).toBe(1);
    expect(result.hymnbook?.hymns[0].title).toBe("Abertura");
    expect(result.hymnbook?.hymns[0].body).toBe("Verso 1\nVerso 2");
    expect(result.error).toBeNull();
  });

  it("modo default é 'indice' quando ?mode= ausente", async () => {
    const fetchFn = fakeFetch({ data: { hymnbook: sampleHymnbook } });
    const event = { ...makeEvent("justiceiro"), fetch: fetchFn };
    const result = await _loadHymnbook(event);
    expect(result.mode).toBe("indice");
  });

  it("propaga ?mode=corrido quando válido", async () => {
    const fetchFn = fakeFetch({ data: { hymnbook: sampleHymnbook } });
    const event = { ...makeEvent("justiceiro", "corrido"), fetch: fetchFn };
    const result = await _loadHymnbook(event);
    expect(result.mode).toBe("corrido");
  });

  it("propaga ?mode=carrossel quando válido", async () => {
    const fetchFn = fakeFetch({ data: { hymnbook: sampleHymnbook } });
    const event = { ...makeEvent("justiceiro", "carrossel"), fetch: fetchFn };
    const result = await _loadHymnbook(event);
    expect(result.mode).toBe("carrossel");
  });

  it("modo inválido (?mode=foo) cai pra 'indice'", async () => {
    const fetchFn = fakeFetch({ data: { hymnbook: sampleHymnbook } });
    const event = { ...makeEvent("justiceiro", "foo"), fetch: fetchFn };
    const result = await _loadHymnbook(event);
    expect(result.mode).toBe("indice");
  });

  it("retorna hinário nulo quando GraphQL responde null", async () => {
    const fetchFn = fakeFetch({ data: { hymnbook: null } });
    const event = { ...makeEvent("inexistente"), fetch: fetchFn };
    const result = await _loadHymnbook(event);
    expect(result.hymnbook).toBeNull();
    expect(result.error).toBeNull();
  });

  it("propaga erros HTTP", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    const event = { ...makeEvent("justiceiro"), fetch: fetchFn };
    const result = await _loadHymnbook(event);
    expect(result.hymnbook).toBeNull();
    expect(result.error).toMatch(/HTTP 500/);
  });
});
