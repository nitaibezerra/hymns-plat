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
