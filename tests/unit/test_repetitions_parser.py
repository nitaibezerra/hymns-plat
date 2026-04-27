"""
Testes do parser de repetições de hinos.

Convenção:
- Ranges referenciam VERSOS (linhas não-vazias do texto).
- col 0 = adjacente ao texto (direita); cols crescentes ficam à esquerda.
- Ranges preferem col 0; só "sobem" (col 1, 2, ...) quando conflitam.
"""

from apps.hymns.repetitions import parse_and_layout

FOUR_VERSES = "Verso 1\nVerso 2\nVerso 3\nVerso 4"
FOUR_VERSES_WITH_STANZAS = "Verso 1\nVerso 2\n\nVerso 3\nVerso 4"


class TestEmptyOrInvalidInput:
    def test_empty_repetitions(self):
        result = parse_and_layout("qualquer", "")
        assert result["n_columns"] == 0
        assert result["bars"] == []

    def test_whitespace_only(self):
        result = parse_and_layout("qualquer", "   ")
        assert result["n_columns"] == 0
        assert result["bars"] == []

    def test_invalid_repetitions(self):
        result = parse_and_layout(FOUR_VERSES, "abc")
        assert result["n_columns"] == 0
        assert result["bars"] == []


class TestColumnAllocation:
    def test_simple_single_column(self):
        """`1-2,3-4` → 2 ranges sem sobreposição → 1 coluna."""
        result = parse_and_layout(FOUR_VERSES, "1-2,3-4")
        assert result["n_columns"] == 1
        cols_by_verse = [(b["column"], b["start_verse"], b["end_verse"]) for b in result["bars"]]
        assert (0, 1, 2) in cols_by_verse
        assert (0, 3, 4) in cols_by_verse

    def test_englobante_two_columns(self):
        """`3-4, 1-4` → local em col 0 (adjacente texto), englobante empurrada para col 1."""
        result = parse_and_layout(FOUR_VERSES, "3-4, 1-4")
        assert result["n_columns"] == 2
        cols = [(b["column"], b["start_verse"], b["end_verse"]) for b in result["bars"]]
        assert (0, 3, 4) in cols
        assert (1, 1, 4) in cols

    def test_three_ranges(self):
        """`1-2, 3-4, 1-4` → locais em col 0, englobante empurrada para col 1."""
        result = parse_and_layout(FOUR_VERSES, "1-2, 3-4, 1-4")
        assert result["n_columns"] == 2
        cols = [(b["column"], b["start_verse"], b["end_verse"]) for b in result["bars"]]
        assert (0, 1, 2) in cols
        assert (0, 3, 4) in cols
        assert (1, 1, 4) in cols

    def test_fill_right_to_left(self):
        """`1-2,1-2,1-2,3-4,5-6` → 3 colunas; ranges sem conflito ficam em col 0."""
        text = "\n".join(f"V{i}" for i in range(1, 7))
        result = parse_and_layout(text, "1-2,1-2,1-2,3-4,5-6")
        assert result["n_columns"] == 3
        cols = [(b["column"], b["start_verse"], b["end_verse"]) for b in result["bars"]]
        # 3-4 e 5-6 não conflitam com nada em col 0 → ambas em col 0 (adjacente ao texto)
        assert (0, 3, 4) in cols
        assert (0, 5, 6) in cols
        # As 3 duplicatas de 1-2 se distribuem em col 0, 1, 2
        ones = sorted(c[0] for c in cols if (c[1], c[2]) == (1, 2))
        assert ones == [0, 1, 2]

    def test_duplicate_ranges_split_columns(self):
        """Duplicatas precisam ir para colunas diferentes (sempre sobrepõem)."""
        result = parse_and_layout(FOUR_VERSES, "1-2,1-2")
        assert result["n_columns"] == 2
        cols = [(b["column"], b["start_verse"], b["end_verse"]) for b in result["bars"]]
        assert sorted(cols) == [(0, 1, 2), (1, 1, 2)]


class TestRangeNormalization:
    def test_normalizes_reversed_range(self):
        """`2-1` deve virar (1,2)."""
        result = parse_and_layout(FOUR_VERSES, "2-1")
        assert result["n_columns"] == 1
        assert result["bars"][0]["start_verse"] == 1
        assert result["bars"][0]["end_verse"] == 2

    def test_single_verse_as_single_number(self):
        """`5` (sem hífen) significa verso 5 apenas."""
        text = "\n".join(f"V{i}" for i in range(1, 7))
        result = parse_and_layout(text, "5")
        assert result["n_columns"] == 1
        assert result["bars"][0]["start_verse"] == 5
        assert result["bars"][0]["end_verse"] == 5

    def test_single_verse_as_range(self):
        """`5-5` também é válido."""
        text = "\n".join(f"V{i}" for i in range(1, 7))
        result = parse_and_layout(text, "5-5")
        assert result["n_columns"] == 1
        assert result["bars"][0]["start_verse"] == 5
        assert result["bars"][0]["end_verse"] == 5

    def test_ignores_whitespace_around_numbers(self):
        """Espaços ao redor dos números não quebram parsing."""
        result = parse_and_layout(FOUR_VERSES, "  1 - 2 ,  3-4  ")
        assert result["n_columns"] == 1
        assert len(result["bars"]) == 2


class TestOutOfRangeHandling:
    def test_range_outside_verses(self):
        """Range referenciando verso inexistente é ignorado silenciosamente."""
        result = parse_and_layout(FOUR_VERSES, "1-999")
        assert result["n_columns"] == 0
        assert result["bars"] == []

    def test_partial_out_of_range(self):
        """Se só um lado está fora, ignora inteiro."""
        result = parse_and_layout(FOUR_VERSES, "1-2, 3-99")
        # 1-2 deve aparecer, 3-99 ignorado
        assert result["n_columns"] == 1
        assert len(result["bars"]) == 1
        assert result["bars"][0]["start_verse"] == 1


class TestRowsMapping:
    def test_rows_preserve_empty_lines(self):
        """As linhas vazias (separadoras de estrofes) aparecem em `rows` com is_verse=False."""
        result = parse_and_layout(FOUR_VERSES_WITH_STANZAS, "")
        rows = result["rows"]
        assert len(rows) == 5  # 4 versos + 1 linha vazia
        assert rows[0]["is_verse"] is True
        assert rows[1]["is_verse"] is True
        assert rows[2]["is_verse"] is False  # linha vazia
        assert rows[3]["is_verse"] is True
        assert rows[4]["is_verse"] is True
        assert rows[0]["text"] == "Verso 1"
        assert rows[2]["text"] == ""

    def test_bars_have_row_indices_mapping_verses(self):
        """Bars devem ter start_row/end_row em índices de linha (0-based), não de verso."""
        # Linhas: V1(0), V2(1), vazia(2), V3(3), V4(4)
        result = parse_and_layout(FOUR_VERSES_WITH_STANZAS, "1-2, 3-4")
        bars = {(b["start_verse"], b["end_verse"]): (b["start_row"], b["end_row"]) for b in result["bars"]}
        assert bars[(1, 2)] == (0, 1)
        assert bars[(3, 4)] == (3, 4)

    def test_bars_skip_empty_lines_in_span(self):
        """Range 1-3 com linha vazia no meio: start_row cobre desde V1 até V3 (inclusive a vazia)."""
        # Linhas: V1(0), V2(1), vazia(2), V3(3)
        text = "V1\nV2\n\nV3"
        result = parse_and_layout(text, "1-3")
        bar = result["bars"][0]
        assert bar["start_row"] == 0  # linha de V1
        assert bar["end_row"] == 3  # linha de V3
