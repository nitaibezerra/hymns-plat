"""Marco Fase 2 — service que monta a prévia carrossel-style do hino para a
tela de revisão (07 · Revisar Hino).

Quebra o texto em estrofes (split por linhas em branco), atribui um índice
global por linha não-branca, e calcula posições absolutas das barrinhas de
repetição parseadas do campo `repetitions` ("1-2,3-4" → 2 barras).
"""

import pytest

from apps.hymns.services.preview import build_preview_stanzas


class TestBuildPreviewStanzas:
    def test_single_stanza_no_blanks(self):
        result = build_preview_stanzas("a\nb\nc", "")
        assert len(result["stanzas"]) == 1
        st = result["stanzas"][0]
        assert [ln["text"] for ln in st["lines"]] == ["a", "b", "c"]
        assert [ln["global_idx"] for ln in st["lines"]] == [0, 1, 2]
        assert st["repetition_bars"] == []

    def test_two_stanzas_split_by_blank(self):
        result = build_preview_stanzas("a\nb\n\nc\nd", "")
        assert len(result["stanzas"]) == 2
        assert [ln["text"] for ln in result["stanzas"][0]["lines"]] == ["a", "b"]
        assert [ln["text"] for ln in result["stanzas"][1]["lines"]] == ["c", "d"]
        # Global idx pula a linha em branco (idx 2).
        assert [ln["global_idx"] for ln in result["stanzas"][1]["lines"]] == [3, 4]

    def test_repetition_bar_for_simple_range(self):
        # "1-2" → 1 barra cobrindo as 2 primeiras linhas (não-brancas).
        result = build_preview_stanzas("a\nb\nc", "1-2")
        bars = result["stanzas"][0]["repetition_bars"]
        assert len(bars) == 1
        assert bars[0]["from_line"] == 0
        assert bars[0]["to_line"] == 1

    def test_repetition_bar_two_ranges_in_same_stanza(self):
        # "1-2,3-4" + estrofe de 4 linhas → 2 barras.
        result = build_preview_stanzas("a\nb\nc\nd", "1-2,3-4")
        bars = result["stanzas"][0]["repetition_bars"]
        assert len(bars) == 2
        assert bars[0]["from_line"] == 0 and bars[0]["to_line"] == 1
        assert bars[1]["from_line"] == 2 and bars[1]["to_line"] == 3

    def test_repetition_bar_cross_stanza_ignored(self):
        # "1-3" mas estrofe 1 tem 2 linhas, estrofe 2 tem 1 linha.
        # Range cruza fronteira → ignorado.
        result = build_preview_stanzas("a\nb\n\nc", "1-3")
        for st in result["stanzas"]:
            assert st["repetition_bars"] == []

    def test_repetition_garbage_ignored(self):
        result = build_preview_stanzas("a\nb", "x-y, abc, 999-1")
        for st in result["stanzas"]:
            assert st["repetition_bars"] == []

    def test_repetition_bar_top_height_use_line_height(self):
        # Com line_height_px=20: barra cobrindo linhas 0 e 1 deve ter top=4
        # e height = 2*20 - 8 = 32.
        result = build_preview_stanzas("a\nb\nc", "1-2", line_height_px=20)
        bar = result["stanzas"][0]["repetition_bars"][0]
        assert bar["top_px"] == 4
        assert bar["height_px"] == 32

    def test_empty_text_returns_no_stanzas(self):
        result = build_preview_stanzas("", "")
        assert result["stanzas"] == []

    def test_only_blanks_returns_no_stanzas(self):
        result = build_preview_stanzas("\n\n\n", "")
        assert result["stanzas"] == []

    @pytest.mark.parametrize("reps", ["1-2", " 1-2 ", "1 - 2", "1-2,"])
    def test_repetition_parsing_tolerates_whitespace_and_trailing_comma(self, reps):
        result = build_preview_stanzas("a\nb", reps)
        assert len(result["stanzas"][0]["repetition_bars"]) == 1
