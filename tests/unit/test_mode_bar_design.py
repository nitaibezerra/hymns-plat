"""Chrome do Carrossel + toggle editorial corrido/carrossel na tela `/ler/`.

Após o refactor:
- O detail do hinário NÃO tem mais barra de "Modo de leitura" (era 3 botões
  índice/corrido/carrossel).
- A tela nova `/hinarios/<slug>/ler/?modo=corrido|carrossel` tem um toggle
  minimalista (2 anchors `reading-toggle`) sem o wrapper `mode-toggle-group`.
- Chrome do carrossel (pílula contador, 11 dots máx, helper text) migrou
  para `/ler/?modo=carrossel`.
- CSS legado `.mode-toggle-*` permanece em components.css (não referenciado
  por templates ativos — mantido para não oscilar tokens).
"""

from pathlib import Path

import pytest
from django.urls import reverse

PROJECT_ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.django_db
class TestCarouselCounterPill:
    """Pílula vive DENTRO de cada slide article (SSR estático)."""

    def test_one_pill_per_slide(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Pill Per Slide")
        for n in (1, 2, 3, 4, 5):
            hymn_factory(hymn_book=hb, number=n)
        url = reverse("hymns:hymnbook_read", kwargs={"slug": hb.slug}) + "?modo=carrossel"
        body = client.get(url).content.decode()
        assert body.count('class="carousel-counter-pill"') == 5

    def test_each_pill_has_correct_number(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Counter Format")
        for n in (1, 2, 3):
            hymn_factory(hymn_book=hb, number=n)
        url = reverse("hymns:hymnbook_read", kwargs={"slug": hb.slug}) + "?modo=carrossel"
        body = client.get(url).content.decode()
        assert "01 / 3" in body
        assert "02 / 3" in body
        assert "03 / 3" in body
        # Texto antigo eliminado
        assert "HINO 01 · DE" not in body

    def test_pill_no_longer_fixed_position(self):
        """CSS: a pílula não usa mais position:fixed (era overlay global)."""
        css = (PROJECT_ROOT / "static/css/components.css").read_text(encoding="utf-8")
        idx = css.index(".carousel-counter-pill")
        block = css[idx : idx + 500]
        assert "position: fixed" not in block


@pytest.mark.django_db
class TestCarouselDots:
    """Máximo 11 dots — janela proporcional pelo hinário inteiro."""

    def test_dots_max_11_for_large_book(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Dots Big")
        for n in range(1, 51):
            hymn_factory(hymn_book=hb, number=n)
        url = reverse("hymns:hymnbook_read", kwargs={"slug": hb.slug}) + "?modo=carrossel"
        body = client.get(url).content.decode()
        dots_idx = body.index("data-carousel-dots")
        dots_end = body.index("</div>", dots_idx)
        dots_block = body[dots_idx:dots_end]
        assert dots_block.count('class="carousel-dot"') == 11

    def test_dots_use_new_class_no_legacy(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Dots Class")
        for n in range(1, 6):
            hymn_factory(hymn_book=hb, number=n)
        url = reverse("hymns:hymnbook_read", kwargs={"slug": hb.slug}) + "?modo=carrossel"
        body = client.get(url).content.decode()
        dots_idx = body.index("data-carousel-dots")
        dots_end = body.index("</div>", dots_idx)
        dots_block = body[dots_idx:dots_end]
        assert "bg-ink/20" not in dots_block
        assert "bg-gold" not in dots_block
        assert "w-2 h-2" not in dots_block

    def test_dots_have_position_attr(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Dots Position")
        hymn_factory(hymn_book=hb, number=1)
        url = reverse("hymns:hymnbook_read", kwargs={"slug": hb.slug}) + "?modo=carrossel"
        body = client.get(url).content.decode()
        dots_idx = body.index("data-carousel-dots")
        dots_end = body.index("</div>", dots_idx)
        dots_block = body[dots_idx:dots_end]
        for pos in range(11):
            assert f'data-dot-position="{pos}"' in dots_block

    def test_footer_helper_text(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Footer Helper")
        hymn_factory(hymn_book=hb, number=1)
        url = reverse("hymns:hymnbook_read", kwargs={"slug": hb.slug}) + "?modo=carrossel"
        body = client.get(url).content.decode()
        assert "← → para navegar · espaço para tocar áudio" in body


@pytest.mark.django_db
class TestDetailHasNoModeBar:
    """O detail do hinário NÃO tem mais barra "Modo de leitura"."""

    def test_no_mode_toggle_group(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Detail Clean")
        hymn_factory(hymn_book=hb, number=1)
        body = client.get(reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug})).content.decode()
        assert 'class="mode-toggle-group"' not in body

    def test_no_legacy_helper_text(self, client, hymn_book_factory, hymn_factory):
        """Helper text per-modo (lista clicável, leitura contínua, etc.) saiu."""
        hb = hymn_book_factory(name="Detail Clean 2")
        hymn_factory(hymn_book=hb, number=1)
        body = client.get(reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug})).content.decode()
        assert "lista clicável · acesso rápido" not in body
        assert "leitura contínua · scroll vertical" not in body


class TestComponentsCssDefines:
    """Regras CSS dos componentes — legado `.mode-toggle-*` continua
    presente em components.css (não referenciado por templates ativos)."""

    def _css(self) -> str:
        return (PROJECT_ROOT / "static/css/components.css").read_text(encoding="utf-8")

    def test_reading_toggle_rule_present(self):
        css = self._css()
        assert ".reading-toggle" in css
        assert ".reading-toggle--active" in css

    def test_counter_pill_rule_present(self):
        css = self._css()
        assert ".carousel-counter-pill" in css

    def test_carousel_dot_rules(self):
        css = self._css()
        assert ".carousel-dot" in css
        idx = css.index('.carousel-dot[data-active="true"]')
        block = css[idx : idx + 400]
        assert "width: 24px" in block
        assert "var(--color-rust)" in block


class TestCarouselJsBehavior:
    """JS do carrossel não formata mais o contador (pílula é SSR por slide)."""

    def test_js_no_longer_formats_counter(self):
        js = (PROJECT_ROOT / "static/js/hymn-carousel.js").read_text(encoding="utf-8")
        assert "'HINO '" not in js
        assert "data-carousel-counter" not in js

    def test_js_uses_data_active_for_dots(self):
        js = (PROJECT_ROOT / "static/js/hymn-carousel.js").read_text(encoding="utf-8")
        assert "dataset.active" in js

    def test_js_caps_dots_at_11(self):
        js = (PROJECT_ROOT / "static/js/hymn-carousel.js").read_text(encoding="utf-8")
        assert "MAX_DOTS" in js
        assert "11" in js
        assert "dotPositionForIndex" in js or "Math.floor" in js
