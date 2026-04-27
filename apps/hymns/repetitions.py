"""
Parser de repetições de hinos.

Converte a convenção textual (ex: "1-2,3-4" ou "3-4, 1-4") em estrutura
pronta para renderizar como barras verticais à esquerda do texto do hino.

Convenções:
- Os números referenciam VERSOS (linhas não-vazias do texto).
- A coluna "col 0" é a ADJACENTE ao texto (mais à direita visualmente).
- Ranges são alocados preferindo col 0. Quando conflitam, empurram para col 1, 2,
  ... (mais à esquerda). Isso preenche "da direita para a esquerda".
- Como efeito natural, ranges englobantes (que conflitam com tudo) acabam à
  esquerda.
"""

from __future__ import annotations


def parse_and_layout(text: str, repetitions: str) -> dict:
    """
    Parse o texto do hino e a string de repetições em estrutura para render.

    Returns:
        {
            "n_columns": int,
            "rows": [{"text": str, "is_verse": bool}, ...],
            "bars": [
                {"column": int, "start_verse": int, "end_verse": int,
                 "start_row": int, "end_row": int},
                ...
            ],
        }

    Se repetitions for vazio, inválido, ou referenciar versos inexistentes,
    retorna n_columns=0 e bars=[] (graceful degrade para texto sem barras).
    """
    lines = text.splitlines() if text else []
    rows = [{"text": line, "is_verse": bool(line.strip())} for line in lines]
    verse_to_row = _map_verses_to_rows(lines)
    ranges = _parse_ranges(repetitions, verse_to_row)
    columns = _allocate_columns(ranges)
    bars = _make_bars(columns, verse_to_row)
    return {"n_columns": len(columns), "rows": rows, "bars": bars}


def _map_verses_to_rows(lines: list[str]) -> dict[int, int]:
    """Mapeia número do verso (1-based) → índice da linha (0-based). Só linhas não-vazias."""
    verse_to_row = {}
    verse_num = 0
    for row_idx, line in enumerate(lines):
        if line.strip():
            verse_num += 1
            verse_to_row[verse_num] = row_idx
    return verse_to_row


def _parse_ranges(repetitions: str, verse_to_row: dict[int, int]) -> list[tuple[int, int]]:
    """Parse 'a-b, c-d, e' em [(a,b), (c,d), (e,e)], filtrando inválidos."""
    ranges: list[tuple[int, int]] = []
    for chunk in (repetitions or "").split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        parts = [p.strip() for p in chunk.split("-")]
        try:
            start = int(parts[0])
            end = int(parts[-1])
        except (ValueError, IndexError):
            continue
        if start > end:
            start, end = end, start
        if start in verse_to_row and end in verse_to_row:
            ranges.append((start, end))
    return ranges


def _allocate_columns(ranges: list[tuple[int, int]]) -> list[list[tuple[int, int]]]:
    """
    Aloca cada range na coluna 0 (adjacente ao texto) se não houver conflito;
    caso contrário, tenta col 1, 2, ... (mais à esquerda).

    Processa ranges locais (menores) primeiro para que englobantes (que
    conflitam com tudo) sejam empurrados para colunas mais à esquerda.
    """
    ordered = sorted(ranges, key=lambda r: (r[1] - r[0], r[0]))
    columns: list[list[tuple[int, int]]] = []
    for rng in ordered:
        for col in columns:
            if not any(_overlaps(rng, other) for other in col):
                col.append(rng)
                break
        else:
            columns.append([rng])
    return columns


def _overlaps(a: tuple[int, int], b: tuple[int, int]) -> bool:
    return not (a[1] < b[0] or b[1] < a[0])


def _make_bars(
    columns: list[list[tuple[int, int]]],
    verse_to_row: dict[int, int],
) -> list[dict]:
    bars = []
    for col_idx, col_ranges in enumerate(columns):
        for start_v, end_v in col_ranges:
            bars.append(
                {
                    "column": col_idx,
                    "start_verse": start_v,
                    "end_verse": end_v,
                    "start_row": verse_to_row[start_v],
                    "end_row": verse_to_row[end_v],
                }
            )
    return bars
