/**
 * Sub-marco 5.F — Ciclo 5F.11.
 *
 * `fetchOcrDuplicates` embrulha `Query.ocrDuplicates(taskId)` — o resolver que
 * chama `find_duplicates_with_content(name, hymns, 0.7, 0.8)` no backend.
 *
 * Regra de degradação importante: se a consulta falhar (inclusive porque o
 * resolver ainda não existe — ciclos 5F.1–5F.3 são backend, fora do escopo
 * desta frente), devolvemos "sem duplicatas" com `unavailable: true`. O
 * wizard segue pra conferência em vez de travar; o Django só desvia pra
 * desambiguação **quando encontra** duplicata, então "não sei" e "não tem"
 * levam ao mesmo lugar.
 */

import { describe, expect, it, vi } from "vitest";

import { fetchOcrDuplicates } from "./ocr-duplicates";

const TASK_ID = "6f1c0d3e-9a52-4c81-bf0e-9a1a1c1d2e3f";

function fakeFetch<T>(payload: T, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function book(name: string, slug: string, hymnsTotal = 12) {
  return { id: `id-${slug}`, name, slug, ownerName: "Padrinho", stats: { hymnsTotal } };
}

describe("fetchOcrDuplicates (5F.11)", () => {
  it("consulta com o taskId", async () => {
    const fetchFn = fakeFetch({ data: { ocrDuplicates: { exactMatch: null, highConfidence: [] } } });
    await fetchOcrDuplicates(fetchFn, TASK_ID);
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.query).toMatch(/ocrDuplicates\s*\(\s*taskId\s*:\s*\$taskId/);
    expect(body.variables).toEqual({ taskId: TASK_ID });
  });

  it("match exato conta como duplicata", async () => {
    const fetchFn = fakeFetch({
      data: { ocrDuplicates: { exactMatch: book("O Justiceiro", "o-justiceiro"), highConfidence: [] } },
    });
    const result = await fetchOcrDuplicates(fetchFn, TASK_ID);
    expect(result.hasDuplicates).toBe(true);
    expect(result.exactMatch).toEqual({
      id: "id-o-justiceiro",
      name: "O Justiceiro",
      slug: "o-justiceiro",
      ownerName: "Padrinho",
      hymnsTotal: 12,
    });
  });

  it("similares contam como duplicata e trazem os dois scores", async () => {
    const fetchFn = fakeFetch({
      data: {
        ocrDuplicates: {
          exactMatch: null,
          highConfidence: [
            { nameScore: 0.82, contentScore: 0.91, hymnbook: book("O Cruzeiro", "o-cruzeiro", 132) },
          ],
        },
      },
    });
    const result = await fetchOcrDuplicates(fetchFn, TASK_ID);
    expect(result.hasDuplicates).toBe(true);
    expect(result.similar).toHaveLength(1);
    expect(result.similar[0]).toMatchObject({ nameScore: 0.82, contentScore: 0.91 });
    expect(result.similar[0].hymnbook.hymnsTotal).toBe(132);
  });

  it("sem match e sem similares não é duplicata", async () => {
    const fetchFn = fakeFetch({ data: { ocrDuplicates: { exactMatch: null, highConfidence: [] } } });
    const result = await fetchOcrDuplicates(fetchFn, TASK_ID);
    expect(result.hasDuplicates).toBe(false);
    expect(result.unavailable).toBe(false);
  });

  it("ocrDuplicates nulo não é duplicata", async () => {
    const fetchFn = fakeFetch({ data: { ocrDuplicates: null } });
    const result = await fetchOcrDuplicates(fetchFn, TASK_ID);
    expect(result.hasDuplicates).toBe(false);
  });

  it("erro GraphQL degrada pra 'sem duplicatas' marcando unavailable", async () => {
    const fetchFn = fakeFetch({
      data: null,
      errors: [{ message: "Cannot query field 'ocrDuplicates' on type 'Query'." }],
    });
    const result = await fetchOcrDuplicates(fetchFn, TASK_ID);
    expect(result.hasDuplicates).toBe(false);
    expect(result.unavailable).toBe(true);
  });

  it("erro HTTP degrada do mesmo jeito", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    const result = await fetchOcrDuplicates(fetchFn, TASK_ID);
    expect(result).toMatchObject({ hasDuplicates: false, unavailable: true });
  });

  it("exceção de rede degrada do mesmo jeito", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const result = await fetchOcrDuplicates(fetchFn, TASK_ID);
    expect(result).toMatchObject({ hasDuplicates: false, unavailable: true });
  });
});
