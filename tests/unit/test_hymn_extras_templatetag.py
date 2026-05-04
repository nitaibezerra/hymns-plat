"""
Testes da template tag `render_hymn_body` que desenha a letra do hino
com barras de repetição via CSS grid.
"""

import pytest
from django.template import Context, Template


def _render(hymn):
    tpl = Template("{% load hymn_extras %}{% render_hymn_body hymn %}")
    return tpl.render(Context({"hymn": hymn}))


@pytest.mark.django_db
class TestRenderHymnBody:
    def test_renders_grid_for_hymn_with_repetitions(self, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Teste Grid")
        hymn = hymn_factory(
            hymn_book=hb,
            number=1,
            title="H",
            text="V1\nV2\nV3\nV4",
            repetitions="1-2,3-4",
        )
        html = _render(hymn)
        assert "hymn-grid" in html
        assert "grid-template-columns" in html
        assert "repetition-bar" in html
        # duas barras esperadas
        assert html.count("repetition-bar") == 2

    def test_renders_plain_text_for_hymn_without_repetitions(self, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Sem Rep")
        hymn = hymn_factory(hymn_book=hb, number=1, title="H", text="V1\nV2", repetitions="")
        html = _render(hymn)
        assert "hymn-grid" not in html
        assert "repetition-bar" not in html
        assert "V1" in html
        assert "V2" in html

    def test_fallback_preserves_line_breaks(self, hymn_book_factory, hymn_factory):
        """Sem repetitions, o texto não pode virar uma única linha — quebras
        do `\\n` precisam ser preservadas pela renderização."""
        hb = hymn_book_factory(name="Quebras")
        hymn = hymn_factory(
            hymn_book=hb,
            number=1,
            title="H",
            text="primeira\nsegunda\nterceira",
            repetitions="",
        )
        html = _render(hymn)
        # Ou via <br>, ou via white-space: pre-* no inline style do wrapper.
        assert (
            "<br" in html or "pre-line" in html or "pre-wrap" in html
        ), f"Renderização perdeu quebras de linha: {html!r}"

    def test_renders_plain_text_for_invalid_repetitions(self, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Inválido")
        hymn = hymn_factory(hymn_book=hb, number=1, title="H", text="V1\nV2", repetitions="1-99")
        html = _render(hymn)
        assert "repetition-bar" not in html

    def test_preserves_empty_lines_as_stanza_gaps(self, hymn_book_factory, hymn_factory):
        """Linhas vazias entre estrofes devem aparecer na renderização."""
        hb = hymn_book_factory(name="Estrofes")
        hymn = hymn_factory(
            hymn_book=hb,
            number=1,
            title="H",
            text="V1\nV2\n\nV3\nV4",
            repetitions="1-2, 3-4",
        )
        html = _render(hymn)
        assert "V1" in html
        assert "V2" in html
        assert "V3" in html
        assert "V4" in html

    def test_escapes_html_in_text(self, hymn_book_factory, hymn_factory):
        """Texto é escapado para evitar XSS."""
        hb = hymn_book_factory(name="Esc")
        hymn = hymn_factory(
            hymn_book=hb,
            number=1,
            title="H",
            text="<script>alert(1)</script>",
            repetitions="",
        )
        html = _render(hymn)
        assert "<script>" not in html
        assert "&lt;script&gt;" in html

    def test_three_ranges_produce_three_bars(self, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Três")
        hymn = hymn_factory(
            hymn_book=hb,
            number=1,
            title="H",
            text="V1\nV2\nV3\nV4",
            repetitions="1-2, 3-4, 1-4",
        )
        html = _render(hymn)
        assert html.count("repetition-bar") == 3

    def test_grid_lines_carry_data_line_attribute(self, hymn_book_factory, hymn_factory):
        """Cada linha não-branca recebe `data-line="N"` (índice global da row),
        usado pelo editor para sincronizar caret↔prévia."""
        hb = hymn_book_factory(name="DL")
        hymn = hymn_factory(
            hymn_book=hb,
            number=1,
            title="H",
            text="V1\nV2\n\nV3",
            repetitions="1-2",
        )
        html = _render(hymn)
        # 3 linhas não-brancas → data-line="0", "1", "3" (linha em branco "ocupa" idx 2)
        assert 'data-line="0"' in html
        assert 'data-line="1"' in html
        assert 'data-line="3"' in html

    def test_fallback_lines_carry_data_line_attribute(self, hymn_book_factory, hymn_factory):
        """Mesmo no fallback (sem repetições), cada linha vira um div com
        data-line — uniformiza a estrutura para o caret tracking do editor."""
        hb = hymn_book_factory(name="FB-DL")
        hymn = hymn_factory(
            hymn_book=hb,
            number=1,
            title="H",
            text="primeira\nsegunda\n\nterceira",
            repetitions="",
        )
        html = _render(hymn)
        assert 'data-line="0"' in html
        assert 'data-line="1"' in html
        assert 'data-line="3"' in html
        # texto preservado
        assert "primeira" in html
        assert "segunda" in html
        assert "terceira" in html


class TestRenderHymnBodyForText:
    """O módulo expõe uma função `render_hymn_body_for_text(text, repetitions)`
    que devolve o mesmo HTML do template tag — sem precisar de um Hymn DB.
    Usada pelo endpoint `editor_preview_render` (live preview do editor)."""

    def test_function_exists_and_returns_html_string(self):
        from apps.hymns.templatetags.hymn_extras import render_hymn_body_for_text

        html = render_hymn_body_for_text("V1\nV2", "1-2")
        assert isinstance(html, str)
        assert "hymn-grid" in html
        assert "repetition-bar" in html
        assert html.count("repetition-bar") == 1

    @pytest.mark.django_db
    def test_function_matches_template_tag_output(self, hymn_book_factory, hymn_factory):
        """Idempotência: tag e função devem produzir HTML idêntico para os mesmos
        inputs (mesma fonte, sem deriva)."""
        from apps.hymns.templatetags.hymn_extras import render_hymn_body_for_text

        hb = hymn_book_factory(name="Match")
        hymn = hymn_factory(hymn_book=hb, number=1, title="H", text="V1\nV2\nV3\nV4", repetitions="1-2,3-4")
        tag_html = _render(hymn)
        fn_html = render_hymn_body_for_text("V1\nV2\nV3\nV4", "1-2,3-4")
        assert tag_html == fn_html

    def test_function_handles_empty_repetitions(self):
        from apps.hymns.templatetags.hymn_extras import render_hymn_body_for_text

        html = render_hymn_body_for_text("a\nb", "")
        assert "hymn-grid" not in html
        assert 'data-line="0"' in html
        assert 'data-line="1"' in html
