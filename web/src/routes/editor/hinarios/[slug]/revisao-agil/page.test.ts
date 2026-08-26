/**
 * Sub-marco 5.E — Ciclo 5E.1.
 *
 * Load da revisão ágil: seleção do hino corrente por `?h=<number>`, com
 * default no primeiro INCOMPLETO (paridade com `editor_next_incomplete`, que
 * no Django é a porta de entrada e redireciona pro `editor_quick_review`
 * apontado no primeiro hino sem estilo ou sem repetições).
 */

import { describe, expect, it, vi } from "vitest";

import { _loadQuickReview } from "./+page";

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function fakeFetch(payload: unknown) {
  return vi.fn().mockResolvedValue(jsonResponse(payload));
}

function hymn(number: number, style: string, repetitions: string) {
  return {
    id: `h${number}`,
    number,
    title: `Hino ${number}`,
    body: `verso ${number}`,
    style,
    repetitions,
  };
}

/** 1 completo, 2 sem repetições, 3 sem estilo. */
const HYMNBOOK = {
  id: "hb1",
  name: "O Cruzeiro",
  slug: "cruzeiro",
  hymns: [hymn(1, "Marcha", "1-4"), hymn(2, "Valsa", ""), hymn(3, "", "1-4")],
};

function payload(hymnbook: unknown = HYMNBOOK) {
  return { data: { hymnbook } };
}

function event(search = "", slug = "cruzeiro") {
  return {
    fetch: fakeFetch(payload()),
    params: { slug },
    url: new URL(`http://x/editor/hinarios/${slug}/revisao-agil/${search}`),
  };
}

describe("/editor/hinarios/[slug]/revisao-agil — load (5E.1)", () => {
  it("busca o hinário pelo slug da rota", async () => {
    const ev = event();
    await _loadQuickReview(ev);
    const body = JSON.parse(ev.fetch.mock.calls[0][1].body as string);
    expect(body.variables).toEqual({ slug: "cruzeiro" });
  });

  it("seleciona o hino pedido em ?h=<number>", async () => {
    const result = await _loadQuickReview(event("?h=3"));
    expect(result.current?.number).toBe(3);
  });

  it("cai no primeiro INCOMPLETO quando ?h= não vem", async () => {
    const result = await _loadQuickReview(event());
    expect(result.current?.number).toBe(2);
  });

  it("cai no primeiro incompleto quando ?h= aponta pra número inexistente", async () => {
    const result = await _loadQuickReview(event("?h=99"));
    expect(result.current?.number).toBe(2);
  });

  it("cai no primeiro incompleto quando ?h= não é número", async () => {
    const result = await _loadQuickReview(event("?h=abc"));
    expect(result.current?.number).toBe(2);
  });

  it("respeita ?h= mesmo apontando pra um hino já completo", async () => {
    const result = await _loadQuickReview(event("?h=1"));
    expect(result.current?.number).toBe(1);
  });

  it("devolve o hinário e a lista ordenada por número", async () => {
    const result = await _loadQuickReview(event());
    expect(result.hymnbook.name).toBe("O Cruzeiro");
    expect(result.hymns.map((h) => h.number)).toEqual([1, 2, 3]);
  });

  it("ordena a lista por número mesmo se o backend devolver fora de ordem", async () => {
    const ev = {
      ...event(),
      fetch: fakeFetch(payload({ ...HYMNBOOK, hymns: [hymn(3, "", "1-4"), hymn(1, "Marcha", "1-4")] })),
    };
    const result = await _loadQuickReview(ev);
    expect(result.hymns.map((h) => h.number)).toEqual([1, 3]);
  });
});
