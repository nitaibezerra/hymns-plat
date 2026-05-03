"""Header simplificado: apenas `N - Título` em uma linha — sem eyebrow do
hinário (`HINO N · LIVRO`) e sem régua horizontal. Aplicado nas 3 telas de
leitura do hino (hymn_detail, corrido, carrossel).

Footer com metadata (`Recebido / Estilo / Oferecido`) permanece quando os
campos estão preenchidos.

A classe `.hymn-title` continua existindo (display serif 28-32px); o CSS de
`.hymn-num` / `.title-rule` permanece no components.css mas não é mais
referenciado pelos templates.
"""

from datetime import date
from pathlib import Path

import pytest
from django.urls import reverse

PROJECT_ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.django_db
class TestHymnDetailSimplifiedHeader:
    def test_title_format_is_number_dash_title(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Cruzeiro Test")
        h = hymn_factory(hymn_book=hb, number=7, title="Estrela Brilhante")
        body = client.get(reverse("hymns:hymn_detail", kwargs={"pk": h.pk})).content.decode()
        # Título contém "7 - Estrela Brilhante"
        idx = body.find('class="hymn-title"')
        assert idx >= 0
        snippet = body[idx : idx + 200]
        assert "7 - Estrela Brilhante" in snippet

    def test_no_eyebrow_with_hymnbook_name(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Cruzeiro Test 2")
        h = hymn_factory(hymn_book=hb, number=7, title="Estrela Brilhante")
        body = client.get(reverse("hymns:hymn_detail", kwargs={"pk": h.pk})).content.decode()
        # Não tem mais a classe .hymn-num e o nome do hinário em uppercase no card.
        # (Restringe a busca ao card do hino para não pegar referências em breadcrumb/header.)
        article_idx = body.find('class="hymn-page')
        assert article_idx >= 0
        # Próximo </article> termina o card.
        end_idx = body.find("</article>", article_idx)
        card = body[article_idx:end_idx]
        assert 'class="hymn-num"' not in card
        assert "HINO 07 · CRUZEIRO TEST 2" not in card

    def test_no_title_rule(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Cruzeiro Test 3")
        h = hymn_factory(hymn_book=hb, number=1)
        body = client.get(reverse("hymns:hymn_detail", kwargs={"pk": h.pk})).content.decode()
        article_idx = body.find('class="hymn-page')
        end_idx = body.find("</article>", article_idx)
        card = body[article_idx:end_idx]
        assert 'class="title-rule"' not in card

    def test_meta_row_still_renders_when_fields_present(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Cruzeiro Test 4")
        h = hymn_factory(
            hymn_book=hb,
            number=1,
            style="Mazurca",
            received_at=date(1934, 5, 12),
            offered_to="N. Sra. Conceição",
        )
        body = client.get(reverse("hymns:hymn_detail", kwargs={"pk": h.pk})).content.decode()
        assert 'class="hymn-meta-row"' in body
        assert "Mazurca" in body
        assert "Conceição" in body

    def test_meta_row_omitted_when_empty(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Cruzeiro Test 5")
        h = hymn_factory(hymn_book=hb, number=1, style="", offered_to="")
        body = client.get(reverse("hymns:hymn_detail", kwargs={"pk": h.pk})).content.decode()
        assert 'class="hymn-meta-row"' not in body


@pytest.mark.django_db
class TestHymnbookCorridoSimplifiedHeader:
    def test_title_format_and_no_clutter(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Corrido Test")
        hymn_factory(hymn_book=hb, number=3, title="Lua Branca")
        url = reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}) + "?mode=corrido"
        body = client.get(url).content.decode()
        idx = body.find('data-mode-pane="corrido"')
        assert idx >= 0
        section = body[idx : idx + 8000]
        # Título com formato N - Título
        assert "3 - Lua Branca" in section
        # Sem eyebrow + sem régua dentro do pane.
        assert 'class="hymn-num"' not in section
        assert 'class="title-rule"' not in section
        assert "HINO 03 · CORRIDO TEST" not in section


@pytest.mark.django_db
class TestHymnbookCarrosselSimplifiedHeader:
    def test_title_format_and_no_clutter(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Carrossel Test")
        hymn_factory(hymn_book=hb, number=12, title="Sol da Verdade")
        url = reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}) + "?mode=carrossel"
        body = client.get(url).content.decode()
        idx = body.find('data-mode-pane="carrossel"')
        assert idx >= 0
        section = body[idx : idx + 8000]
        assert "12 - Sol da Verdade" in section
        assert 'class="hymn-num"' not in section
        assert 'class="title-rule"' not in section
        assert "HINO 12 · CARROSSEL TEST" not in section


class TestComponentsCssRetainsClasses:
    """Regras CSS de `.hymn-page` family permanecem (mesmo que templates não
    as referenciem mais) — futuro pode reusar e queremos evitar oscilação no
    components.css."""

    def _css(self) -> str:
        return (PROJECT_ROOT / "static/css/components.css").read_text(encoding="utf-8")

    def test_hymn_title_class_still_defined(self):
        css = self._css()
        assert ".hymn-page .hymn-title" in css

    def test_hymn_meta_row_class_still_defined(self):
        css = self._css()
        assert ".hymn-page .hymn-meta-row" in css

    def test_hymn_title_uses_body_serif_not_display(self):
        """Título e corpo compartilham a face (Source Serif 4 / --font-serif)
        — espelha a página impressa do cantador. Cormorant Garamond
        (--font-display) NÃO deve ser usada aqui."""
        css = self._css()
        idx = css.index(".hymn-page .hymn-title")
        block = css[idx : idx + 600]
        assert "font-family: var(--font-serif)" in block
        assert "var(--font-display)" not in block

    def test_hymn_title_weight_matches_design(self):
        """Design (`fase2-bundle/.../components.css` linha 198) define
        font-weight: 500. Não usar 600 (peso original do display) com a serif."""
        css = self._css()
        idx = css.index(".hymn-page .hymn-title")
        block = css[idx : idx + 400]
        assert "font-weight: 500" in block


class TestHymnBodyLineHeight:
    """Espaçamento entre versos: design `.hymn-body` line-height = 1.55.
    Antes estava em 1.8 (hardcoded em hymn_extras.LINE_HEIGHT_EM), o que
    deixava o hino esparso demais — longe de página de cantador impresso."""

    def test_line_height_matches_design(self):
        from apps.hymns.templatetags.hymn_extras import LINE_HEIGHT_EM

        assert 1.4 <= LINE_HEIGHT_EM <= 1.6, f"line-height={LINE_HEIGHT_EM}"
