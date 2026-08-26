/**
 * Marco 5.B — Ciclo 5B.5.
 *
 * Porte para TypeScript da lógica de sort multi-critério que vivia em
 * `apps/hymns/editor_views.py:117-157` (`_parse_sort` / `_toggle_sort` /
 * `_encode_sort` + a pré-montagem das chips).
 *
 * O vocabulário é `review` / `comp` / `audio` / `recent` — o MESMO que o
 * backend aceita em `SortInput.column` (5.A½). Não existe `review_pct` aqui.
 *
 * Regras que os testes fixam (idênticas às da view Django):
 *   - `parseSort` é defensiva: nunca levanta, ignora token inválido,
 *     deduplica métrica (1ª ocorrência vence), preserva ordem de aparição —
 *     e a ORDEM é a prioridade do ORDER BY.
 *   - `toggleSort` cicla off → asc → desc → off. Métrica nova entra no FIM
 *     (clique mais recente tem MENOR prioridade).
 *   - `encodeSort` é a inversa de `parseSort` para entradas válidas.
 */

import { describe, expect, it } from "vitest";

import {
  SORT_METRICS,
  buildSortChips,
  encodeSort,
  parseSort,
  toSortInputs,
  toggleSort,
} from "./editor-sort";

import type { SortPair } from "./editor-sort";

describe("SORT_METRICS (5B.5)", () => {
  it("são as 4 métricas do vocabulário do backend, com rótulo PT-BR", () => {
    expect(SORT_METRICS.map((m) => m.key)).toEqual(["review", "comp", "audio", "recent"]);
    expect(SORT_METRICS.map((m) => m.label)).toEqual([
      "Revisão",
      "Estilo + Reps",
      "Áudios",
      "Recentes",
    ]);
  });

  it("não usa o vocabulário antigo de coluna do ORM (`review_pct` e cia.)", () => {
    expect(SORT_METRICS.map((m) => m.key).join(",")).not.toMatch(/_pct/);
  });
});

describe("parseSort (5B.5)", () => {
  it("lê pares na ordem de aparição — a ordem É a prioridade", () => {
    expect(parseSort("review:asc,audio:desc")).toEqual([
      ["review", "asc"],
      ["audio", "desc"],
    ]);
  });

  it("aceita espaços em volta dos tokens", () => {
    expect(parseSort(" review : asc , audio : desc ")).toEqual([
      ["review", "asc"],
      ["audio", "desc"],
    ]);
  });

  it("normaliza caixa", () => {
    expect(parseSort("REVIEW:ASC")).toEqual([["review", "asc"]]);
  });

  it("ignora métrica desconhecida", () => {
    expect(parseSort("bogus:asc,review:asc")).toEqual([["review", "asc"]]);
  });

  it("ignora direção inválida", () => {
    expect(parseSort("review:sideways")).toEqual([]);
  });

  it("ignora token sem dois-pontos", () => {
    expect(parseSort("review,audio:asc")).toEqual([["audio", "asc"]]);
  });

  it("deduplica métrica repetida — a 1ª ocorrência vence", () => {
    expect(parseSort("review:asc,review:desc")).toEqual([["review", "asc"]]);
  });

  it("vazio, nulo e indefinido caem pra lista vazia sem levantar", () => {
    expect(parseSort("")).toEqual([]);
    expect(parseSort(null)).toEqual([]);
    expect(parseSort(undefined)).toEqual([]);
  });

  it("URL maldosa não derruba a página", () => {
    expect(() => parseSort(":::,,,:asc:desc,review:")).not.toThrow();
    expect(parseSort(":::,,,:asc:desc,review:")).toEqual([]);
  });

  it("aceita as 4 métricas do vocabulário", () => {
    expect(parseSort("review:asc,comp:desc,audio:asc,recent:desc")).toEqual([
      ["review", "asc"],
      ["comp", "desc"],
      ["audio", "asc"],
      ["recent", "desc"],
    ]);
  });
});

describe("toggleSort (5B.5)", () => {
  it("off → asc, entrando no FIM da lista (clique novo = menor prioridade)", () => {
    const pairs: SortPair[] = [["review", "asc"]];
    expect(toggleSort(pairs, "audio")).toEqual([
      ["review", "asc"],
      ["audio", "asc"],
    ]);
  });

  it("asc → desc, mantendo a posição na prioridade", () => {
    const pairs: SortPair[] = [
      ["review", "asc"],
      ["audio", "asc"],
    ];
    expect(toggleSort(pairs, "review")).toEqual([
      ["review", "desc"],
      ["audio", "asc"],
    ]);
  });

  it("desc → off, removendo da lista", () => {
    const pairs: SortPair[] = [
      ["review", "desc"],
      ["audio", "asc"],
    ];
    expect(toggleSort(pairs, "review")).toEqual([["audio", "asc"]]);
  });

  it("ciclo completo off → asc → desc → off volta ao início", () => {
    let pairs: SortPair[] = [];
    pairs = toggleSort(pairs, "review");
    expect(pairs).toEqual([["review", "asc"]]);
    pairs = toggleSort(pairs, "review");
    expect(pairs).toEqual([["review", "desc"]]);
    pairs = toggleSort(pairs, "review");
    expect(pairs).toEqual([]);
  });

  it("não muta a lista recebida", () => {
    const pairs: SortPair[] = [["review", "asc"]];
    toggleSort(pairs, "review");
    toggleSort(pairs, "audio");
    expect(pairs).toEqual([["review", "asc"]]);
  });
});

describe("encodeSort (5B.5)", () => {
  it("serializa no formato que a URL e o backend esperam", () => {
    expect(
      encodeSort([
        ["review", "asc"],
        ["audio", "desc"],
      ]),
    ).toBe("review:asc,audio:desc");
  });

  it("lista vazia vira string vazia (nada de `?sort=` órfão)", () => {
    expect(encodeSort([])).toBe("");
  });

  it("é a inversa de parseSort", () => {
    const raw = "review:desc,comp:asc,recent:desc";
    expect(encodeSort(parseSort(raw))).toBe(raw);
  });
});

describe("toSortInputs (5B.5)", () => {
  it("traduz pares pro shape de SortInput { column, direction } do GraphQL", () => {
    expect(
      toSortInputs([
        ["review", "asc"],
        ["audio", "desc"],
      ]),
    ).toEqual([
      { column: "review", direction: "asc" },
      { column: "audio", direction: "desc" },
    ]);
  });

  it("sem sort nenhum devolve null — o argumento é opcional no schema", () => {
    expect(toSortInputs([])).toBeNull();
  });
});

describe("buildSortChips (5B.5)", () => {
  it("devolve as 4 chips sempre, mesmo sem sort ativo", () => {
    const chips = buildSortChips([]);
    expect(chips).toHaveLength(4);
    expect(chips.every((c) => c.state === "off")).toBe(true);
  });

  it("marca o estado de cada métrica ativa", () => {
    const chips = buildSortChips([
      ["review", "asc"],
      ["audio", "desc"],
    ]);
    expect(chips.find((c) => c.key === "review")?.state).toBe("asc");
    expect(chips.find((c) => c.key === "audio")?.state).toBe("desc");
    expect(chips.find((c) => c.key === "comp")?.state).toBe("off");
  });

  it("numera a prioridade SÓ quando há 2+ sorts combinados", () => {
    const single = buildSortChips([["review", "asc"]]);
    expect(single.find((c) => c.key === "review")?.position).toBeNull();

    const multi = buildSortChips([
      ["review", "asc"],
      ["audio", "desc"],
    ]);
    expect(multi.find((c) => c.key === "review")?.position).toBe(1);
    expect(multi.find((c) => c.key === "audio")?.position).toBe(2);
  });

  it("cada chip já carrega o `sort` codificado do PRÓXIMO clique", () => {
    const chips = buildSortChips([["review", "asc"]]);
    expect(chips.find((c) => c.key === "review")?.nextSort).toBe("review:desc");
    expect(chips.find((c) => c.key === "audio")?.nextSort).toBe("review:asc,audio:asc");
  });
});
