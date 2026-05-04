"""Render do hino para a coluna de prévia da tela 07 · Revisar Hino.

Produz o output que o template renderiza server-side e que `editor-preview.js`
re-renderiza no cliente quando o usuário edita o textarea ou muda o campo
`repetitions`. As duas implementações (Python aqui, JS no front) são pequenas
o bastante para co-existir; mantê-las em sincronia é responsabilidade do
desenvolvedor.

Saída:

    {
      "stanzas": [
        {
          "lines": [{"text": str, "global_idx": int}, ...],
          "repetition_bars": [{"from_line": int, "to_line": int,
                               "top_px": int, "height_px": int}, ...],
        },
        ...
      ]
    }

`global_idx` é o índice da linha **não-branca** dentro do hino inteiro
(começando em 0). É o que o textarea usa como caret-line target — quando o
cursor está em `global_idx=N`, JS aplica `.is-active` em `[data-line="N"]`.

`repetition_bars` listam as barras finas verticais que aparecem à esquerda
das linhas agrupadas (estilo Hinaria.com.br). Só são incluídas barras cujo
range cabe **inteiramente** dentro de uma estrofe — ranges que cruzam blank
lines (estrofes diferentes) são silenciosamente descartadas.
"""

from __future__ import annotations

import re

# Default empírico — Source Serif 4 a 17px com line-height 1.55.
DEFAULT_LINE_HEIGHT_PX = 26


def build_preview_stanzas(text: str, repetitions: str, line_height_px: int = DEFAULT_LINE_HEIGHT_PX) -> dict:
    stanzas_raw: list[list[dict]] = []
    current: list[dict] = []
    global_idx = 0
    for raw_line in (text or "").split("\n"):
        if raw_line.strip() == "":
            if current:
                stanzas_raw.append(current)
                current = []
            global_idx += 1
            continue
        current.append({"text": raw_line, "global_idx": global_idx})
        global_idx += 1
    if current:
        stanzas_raw.append(current)

    ranges = _parse_repetitions(repetitions)

    flat_positions: list[tuple[int, int]] = []
    for stanza_idx, stanza in enumerate(stanzas_raw):
        for line_in_stanza, _line in enumerate(stanza):
            flat_positions.append((stanza_idx, line_in_stanza))

    out_stanzas = []
    for stanza_idx, stanza in enumerate(stanzas_raw):
        bars = []
        for r_start, r_end in ranges:
            if r_start < 1 or r_end < r_start:
                continue
            if r_start - 1 >= len(flat_positions) or r_end - 1 >= len(flat_positions):
                continue
            start_pos = flat_positions[r_start - 1]
            end_pos = flat_positions[r_end - 1]
            if start_pos[0] != stanza_idx or end_pos[0] != stanza_idx:
                continue
            bars.append(
                {
                    "from_line": start_pos[1],
                    "to_line": end_pos[1],
                    "top_px": start_pos[1] * line_height_px + 4,
                    "height_px": (end_pos[1] - start_pos[1] + 1) * line_height_px - 8,
                }
            )
        out_stanzas.append({"lines": stanza, "repetition_bars": bars})

    return {"stanzas": out_stanzas}


_RANGE_RE = re.compile(r"^\s*(\d+)\s*-\s*(\d+)\s*$")


def _parse_repetitions(value: str) -> list[tuple[int, int]]:
    """Parse "1-2,3-4" → [(1, 2), (3, 4)]. Ignora segmentos malformados."""
    if not value or not value.strip():
        return []
    out = []
    for segment in value.split(","):
        m = _RANGE_RE.match(segment)
        if not m:
            continue
        a, b = int(m.group(1)), int(m.group(2))
        if a > 0 and b >= a:
            out.append((a, b))
    return out
