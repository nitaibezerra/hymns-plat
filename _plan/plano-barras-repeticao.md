# Plano: Renderizar Barras de Repetição nos Hinos (TDD)

**Data:** 2026-04-21
**Abordagem:** Test-Driven Development (Red → Green → Refactor)
**Branch:** `feat/repetition-bars`

---

## Contexto

Hinos do Santo Daime trazem, à esquerda da letra, pequenas **barras verticais** que indicam grupos de versos a repetir. A plataforma já registra a informação no campo `Hymn.repetitions` com uma convenção textual:

- `"1-2,3-4"` → 2 barras, uma nos versos 1-2 e outra nos 3-4 (mesma coluna, sem sobreposição)
- `"3-4, 1-4"` → 2 barras, onde `1-4` engloba `3-4` → coluna à esquerda para `1-4`, coluna à direita para `3-4`
- `"1-2, 3-4, 1-4"` → 3 barras em 2 colunas (englobante à esquerda, aninhadas à direita)

Hoje essa string aparece só no rodapé "Informações" do detalhe do hino — útil para depuração, inútil para quem canta. Este plano transforma essa string em **barras visuais** ao lado da letra e remove a exibição textual.

**Hinos exemplo para verificação visual:**
- `http://localhost:8001/hinos/04339b04-a771-40b4-b6aa-aa4e3aaa8c27/` (Eu Estava Num Palácio, `1-2,3-4`)
- `http://localhost:8001/hinos/34038bac-7456-4653-a3e1-ab556abb57db/` (Vamos Meus Irmãos, `3-4, 1-4`)

**Definição de "verso":** cada **linha não-vazia** do campo `text` conta como um verso. Linhas em branco separam estrofes mas não entram na numeração. Confirmado inspecionando os dois hinos exemplo.

---

## Escopo

**Incluído:**
- Parser puro `parse_and_layout(text, repetitions) -> dict` em `apps/hymns/repetitions.py`
- Algoritmo de alocação em colunas (ranges englobantes à esquerda)
- Template tag Django que injeta grid CSS com barras posicionadas via `grid-row: span`
- Remover item "Repetições" da seção "Informações" em `hymn_detail.html`
- Testes unitários do parser (13 casos)

**Fora do escopo:**
- Mudança na convenção textual (continua o mesmo formato string)
- Ranges referenciando linhas físicas (só versos)
- Animação ou áudio sincronizado com barras
- Export PDF com barras

---

## Fases TDD

### Fase 1: Parser de repetições (RED → GREEN → REFACTOR)

**🔴 Red — `tests/unit/test_repetitions_parser.py`:**

| Teste | Input | Esperado |
|---|---|---|
| test_empty_repetitions | `("letra", "")` | `n_columns=0, bars=[]` |
| test_whitespace_only | `("letra", "  ")` | `n_columns=0, bars=[]` |
| test_invalid_repetitions | `("letra", "abc")` | `n_columns=0, bars=[]` |
| test_simple_single_column | 4 versos, `"1-2,3-4"` | `n_columns=1, bars=[col0:1-2, col0:3-4]` |
| test_englobante_two_columns | 4 versos, `"3-4, 1-4"` | `n_columns=2, bars=[col0:1-4, col1:3-4]` |
| test_three_ranges | 4 versos, `"1-2, 3-4, 1-4"` | `n_columns=2, bars=[col0:1-4, col1:1-2, col1:3-4]` |
| test_normalizes_reversed_range | 2+ versos, `"2-1"` | 1 barra cobrindo 1-2 |
| test_single_verse_as_number | 5+ versos, `"5-5"` | 1 barra no verso 5 |
| test_range_outside_verses | 4 versos, `"1-999"` | `bars=[]` (ignora) |
| test_duplicate_ranges_split_columns | 2+ versos, `"1-2,1-2"` | 2 barras em 2 colunas diferentes |
| test_rows_map_lines_preserving_empties | linhas com brancos | `rows` tem todas linhas + `is_verse=False` nas vazias |
| test_bars_have_row_indices | 4 versos, `"1-2"` | `bars[0].start_row=0, end_row=1` |
| test_ignores_whitespace_around_numbers | `" 1 - 2 , 3-4 "` | parsing correto |

**🟢 Green — `apps/hymns/repetitions.py`:**

```python
def parse_and_layout(text: str, repetitions: str) -> dict:
    """Return {n_columns, rows, bars}. Pure function, no Django deps."""
    lines = text.splitlines() if text else []
    verse_to_row = _map_verses(lines)
    ranges = _parse_ranges(repetitions, verse_to_row)
    columns = _allocate_columns(ranges)
    bars = _make_bars(columns, verse_to_row)
    rows = [{"text": line, "is_verse": bool(line.strip())} for line in lines]
    return {"n_columns": len(columns), "rows": rows, "bars": bars}
```

Helpers: `_map_verses`, `_parse_ranges`, `_allocate_columns` (sort por length desc, start asc; aloca na 1ª coluna sem overlap), `_make_bars`.

---

### Fase 2: Template tag (RED → GREEN)

**🔴 Red — `tests/unit/test_hymn_extras_templatetag.py`:**

- `test_tag_renders_grid_for_hymn_with_repetitions` — assert `grid-template-columns` e `repetition-bar` no output
- `test_tag_renders_plain_text_for_hymn_without_repetitions` — assert sem `grid` e sem `repetition-bar`
- `test_tag_preserves_empty_lines_as_stanza_gaps` — assert que linhas vazias geram espaço visual
- `test_tag_escapes_html_in_text` — assert que `<script>` no text é escapado

**🟢 Green:**

- `apps/hymns/templatetags/__init__.py` (vazio)
- `apps/hymns/templatetags/hymn_extras.py`:
  ```python
  from django import template
  from apps.hymns.repetitions import parse_and_layout

  register = template.Library()

  @register.inclusion_tag("hymns/_hymn_body.html")
  def render_hymn_body(hymn):
      data = parse_and_layout(hymn.text or "", hymn.repetitions or "")
      data["column_range"] = list(range(data["n_columns"]))
      data["hymn"] = hymn
      return data
  ```
- `templates/hymns/_hymn_body.html` — grid CSS com barras via `grid-row: span`. Fallback sem grid quando `n_columns == 0`.

---

### Fase 3: Integração no template + remoção do campo textual

**🔴 Red — estender `tests/unit/test_hymn_views.py`:**

- `test_hymn_detail_uses_render_hymn_body_tag` — GET /hinos/<pk>/ com `repetitions="1-2"` retorna HTML contendo `repetition-bar`
- `test_hymn_detail_hides_repetitions_text_field` — GET /hinos/<pk>/ com `repetitions="1-2"` **não** contém a label "Repetições" na seção Informações

**🟢 Green — `templates/hymns/hymn_detail.html`:**
1. Adicionar `{% load hymn_extras %}` no topo
2. Substituir `<section><div class="hymn-text">{{ hymn.text }}</div></section>` por `<section>{% render_hymn_body hymn %}</section>`
3. Remover o `{% if hymn.repetitions %}...{% endif %}` da seção Informações
4. Ajustar o `{% if %}` agregador da seção Informações retirando `hymn.repetitions`

---

## Arquivos

### Novos
- `apps/hymns/repetitions.py`
- `apps/hymns/templatetags/__init__.py`
- `apps/hymns/templatetags/hymn_extras.py`
- `templates/hymns/_hymn_body.html`
- `tests/unit/test_repetitions_parser.py`
- `tests/unit/test_hymn_extras_templatetag.py`

### Modificados
- `templates/hymns/hymn_detail.html`
- `tests/unit/test_hymn_views.py` (+2 testes de integração)

---

## Decisões de design

- **Lógica em Python puro, zero JS.** Parser e alocação testáveis isoladamente; funciona sem JS habilitado.
- **CSS Grid** com N colunas de 12px + 1 coluna 1fr para texto. Barras são `<span>` absolutos sobre o grid via `grid-column: <col>` e `grid-row: <start> / span <n>` — cada barra é um elemento único, contínuo, não fragmentado linha-a-linha.
- **Graceful degrade:** repetitions vazia/inválida → renderiza texto normal (igual ao atual).
- **Cor/espessura:** `3px solid #2c5282`, gap de 8px entre colunas, margem vertical de 3px para separar barras adjacentes de mesma coluna.

---

## Verificação End-to-End

1. **Testes unitários:**
   ```bash
   cd /Users/nitai/dev/hyms-platform/hymns-plat
   poetry run pytest tests/unit/test_repetitions_parser.py tests/unit/test_hymn_extras_templatetag.py -v
   poetry run pytest tests/unit/ 2>&1 | tail -3
   ```
   Esperado: 315 + ~19 novos, todos passando.

2. **Lint:**
   ```bash
   poetry run black --check . && poetry run isort --check-only . && poetry run ruff check .
   ```

3. **Browser (server em :8001):**
   - `/hinos/04339b04-a771-40b4-b6aa-aa4e3aaa8c27/` → 2 barras em coluna única (versos 1-2 e 3-4)
   - `/hinos/34038bac-7456-4653-a3e1-ab556abb57db/` → 2 colunas: `1-4` à esquerda englobando `3-4` à direita
   - Qualquer hino sem `repetitions` → render igual ao atual
   - Confirmar: seção "Informações" **não** mostra mais "Repetições"

---

## Critérios de Conclusão

- [ ] Parser com 13 testes passando
- [ ] Template tag com 4 testes passando
- [ ] Integração com 2 testes passando
- [ ] Suite completa passando (315 + ~19)
- [ ] Lint clean
- [ ] Verificação visual nos 2 hinos exemplo bate com as imagens de referência
- [ ] Campo "Repetições" removido da seção Informações
