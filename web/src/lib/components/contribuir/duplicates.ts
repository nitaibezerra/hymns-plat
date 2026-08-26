/**
 * Sub-marco 5.F — Ciclo 5F.12.
 *
 * Tipos da desambiguação, num módulo importável por `$lib` para que os
 * componentes não precisem alcançar `src/routes/` com caminho relativo. A
 * camada de acesso (`routes/contribuir/ocr-duplicates.ts`) reexporta daqui.
 *
 * Os scores vêm do backend como fração 0..1 (é o que
 * `find_duplicates_with_content` devolve); o Django exibia
 * `int(score * 100)`. `scoreToPercent` guarda essa conversão num lugar só.
 */

export interface DuplicateBook {
  id: string;
  name: string;
  slug: string;
  ownerName: string;
  hymnsTotal: number;
}

export interface SimilarBook {
  hymnbook: DuplicateBook;
  nameScore: number;
  contentScore: number;
}

/** Fração 0..1 → inteiro 0..100, truncando como o `int()` do Python. */
export function scoreToPercent(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.trunc(Math.max(0, Math.min(1, score)) * 100);
}
