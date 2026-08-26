/**
 * Marco 5.B — Ciclo 5B.5.
 *
 * Sort multi-critério da fila do editor. Porte fiel de
 * `apps/hymns/editor_views.py:117-157` (`_parse_sort`, `_toggle_sort`,
 * `_encode_sort` + a pré-montagem das chips que a view fazia em Python).
 *
 * O contrato de vocabulário vem do 5.A½: as colunas aceitas por
 * `SortInput.column` são `review`, `comp`, `audio` e `recent` — nomes de
 * MÉTRICA, não de campo do ORM (não existe `review_pct` aqui).
 *
 * Duas invariantes que a UI depende e por isso estão travadas em teste:
 *
 * 1. A ORDEM dos pares é a prioridade do ORDER BY. Clique mais antigo
 *    vence, e métrica nova entra no FIM da lista — quem acabou de clicar
 *    espera "ordene por isto DEPOIS do que eu já pedi".
 * 2. `parseSort` é defensiva e nunca levanta. A URL é editável pelo
 *    usuário; token inválido é descartado em silêncio e a tela cai nos
 *    defaults, igual à view Django.
 */

export type SortDirection = "asc" | "desc";
export type SortPair = [string, SortDirection];
export type SortState = "off" | SortDirection;

export interface SortMetric {
  key: string;
  label: string;
}

export interface SortChip {
  key: string;
  label: string;
  state: SortState;
  /** 1-based, só preenchido quando há 2+ sorts combinados. */
  position: number | null;
  /** `sort` já codificado pro estado DEPOIS do próximo clique. */
  nextSort: string;
}

/** As 4 métricas, na ordem em que aparecem como chips. */
export const SORT_METRICS: readonly SortMetric[] = [
  { key: "review", label: "Revisão" },
  { key: "comp", label: "Estilo + Reps" },
  { key: "audio", label: "Áudios" },
  { key: "recent", label: "Recentes" },
];

const SORT_KEYS = new Set(SORT_METRICS.map((m) => m.key));
const SORT_DIRS = new Set<string>(["asc", "desc"]);

/**
 * `review:asc,audio:desc` → `[["review","asc"], ["audio","desc"]]`.
 *
 * Ignora token inválido, mantém ordem de aparição e deduplica métrica
 * (1ª ocorrência vence). Nunca levanta.
 */
export function parseSort(raw: string | null | undefined): SortPair[] {
  const out: SortPair[] = [];
  const seen = new Set<string>();

  for (const chunk of (raw ?? "").split(",")) {
    const token = chunk.trim();
    if (!token.includes(":")) continue;

    const separator = token.indexOf(":");
    const metric = token.slice(0, separator).trim().toLowerCase();
    const direction = token.slice(separator + 1).trim().toLowerCase();

    if (seen.has(metric) || !SORT_KEYS.has(metric) || !SORT_DIRS.has(direction)) continue;
    seen.add(metric);
    out.push([metric, direction as SortDirection]);
  }
  return out;
}

/**
 * Ciclo tri-estado off → asc → desc → off para `metric` dentro de `pairs`.
 *
 * Métrica ausente entra no fim como `asc`; `asc` vira `desc` no lugar (a
 * prioridade não muda ao inverter a direção); `desc` sai da lista.
 * Devolve uma lista nova — não muta a recebida.
 */
export function toggleSort(pairs: SortPair[], metric: string): SortPair[] {
  const index = pairs.findIndex(([m]) => m === metric);
  if (index === -1) {
    return [...pairs, [metric, "asc"]];
  }
  if (pairs[index][1] === "asc") {
    const next = [...pairs];
    next[index] = [metric, "desc"];
    return next;
  }
  return pairs.filter((_, i) => i !== index);
}

/** Inversa de `parseSort`. Lista vazia → string vazia (sem `?sort=` órfão). */
export function encodeSort(pairs: SortPair[]): string {
  return pairs.map(([m, d]) => `${m}:${d}`).join(",");
}

/**
 * Traduz pares pro shape de `SortInput` do GraphQL. Devolve `null` quando
 * não há sort — o argumento é opcional no schema e mandar `[]` faria o
 * backend perder o default de prioridade.
 */
export function toSortInputs(
  pairs: SortPair[],
): { column: string; direction: SortDirection }[] | null {
  if (pairs.length === 0) return null;
  return pairs.map(([column, direction]) => ({ column, direction }));
}

/**
 * Pré-monta as 4 chips com estado, numeração de prioridade e o `sort` do
 * próximo clique — a mesma pré-montagem que a view Django fazia, para que o
 * componente não precise reimplementar o ciclo.
 */
export function buildSortChips(pairs: SortPair[]): SortChip[] {
  const index = new Map<string, { position: number; direction: SortDirection }>();
  pairs.forEach(([metric, direction], i) => index.set(metric, { position: i + 1, direction }));
  const multi = pairs.length >= 2;

  return SORT_METRICS.map(({ key, label }) => {
    const active = index.get(key);
    return {
      key,
      label,
      state: active ? active.direction : "off",
      position: active && multi ? active.position : null,
      nextSort: encodeSort(toggleSort(pairs, key)),
    };
  });
}
