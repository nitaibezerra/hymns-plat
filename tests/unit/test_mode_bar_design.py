"""Barra "Modo de Leitura" + chrome do Carrossel alinhados ao design Fase 2.

Estado-alvo:

- Barra `Modo de Leitura` é full-width sob o app bar e fica VISÍVEL nos 3
  modos (incluindo carrossel — substitui a barra de status antiga
  `← Índice / HINO N · DE M / ← → · Esc`).
- Os 3 botões ficam dentro de um wrapper `.mode-toggle-group` (border + bg
  paper + radius pill); botão ativo usa `.mode-toggle-btn[data-active="true"]`
  com fundo rust e texto cream.
- Helper text à direita muda por modo (verbatim do design JSX):
    indice    → "lista clicável · acesso rápido"
    corrido   → "leitura contínua · scroll vertical"
    carrossel → "um por vez · swipe ou setas"
- No carrossel: contador "01 / N" em pílula (`.carousel-counter-pill`)
  centralizada no topo. Dots são `.carousel-dot` (6×6 padrão; ativo 24×6
  rust). Helper "← → para navegar · espaço para tocar áudio" no rodapé.

Referência: `_design/fase2-bundle/project/screens/hymnbook-detail.jsx:56-86`
e `_design/fase2-bundle/project/screens/extras.jsx:174-205`.
"""

from pathlib import Path

import pytest
from django.urls import reverse

PROJECT_ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.django_db
class TestModeBarVisibleAcrossModes:
    """Barra de modo é full-width sob o app bar nos 3 modos — não fica mais
    `hidden` no carrossel."""

    @pytest.mark.parametrize("mode", ["indice", "corrido", "carrossel"])
    def test_mode_toggle_group_present(self, mode, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="MB Test")
        hymn_factory(hymn_book=hb, number=1)
        url = reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}) + f"?mode={mode}"
        body = client.get(url).content.decode()
        assert 'class="mode-toggle-group"' in body, f"missing toggle group in mode={mode}"

    def test_mode_toggle_section_not_hidden_in_carousel(self, client, hymn_book_factory, hymn_factory):
        """A `<section>` que abriga o toggle não tem mais a classe `hidden`
        condicional no carrossel."""
        hb = hymn_book_factory(name="MB Carrossel")
        hymn_factory(hymn_book=hb, number=1)
        url = reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}) + "?mode=carrossel"
        body = client.get(url).content.decode()
        idx = body.index('class="mode-toggle-group"')
        # Olhar 600 chars antes — não deve haver `hidden` na <section>
        # imediatamente envolvendo o toggle.
        before = body[max(0, idx - 600) : idx]
        section_start = before.rfind("<section")
        section_open = before[section_start:]
        assert "hidden" not in section_open, f"mode bar section should be visible in carousel, got: {section_open!r}"


@pytest.mark.django_db
class TestModeBarHelperText:
    @pytest.mark.parametrize(
        "mode,expected",
        [
            ("indice", "lista clicável · acesso rápido"),
            ("corrido", "leitura contínua · scroll vertical"),
            ("carrossel", "um por vez · swipe ou setas"),
        ],
    )
    def test_helper_per_mode(self, mode, expected, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name=f"Helper {mode}")
        hymn_factory(hymn_book=hb, number=1)
        url = reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}) + f"?mode={mode}"
        body = client.get(url).content.decode()
        assert expected in body


@pytest.mark.django_db
class TestModeToggleActiveState:
    @pytest.mark.parametrize("mode", ["indice", "corrido", "carrossel"])
    def test_only_active_mode_has_data_active(self, mode, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name=f"Active {mode}")
        hymn_factory(hymn_book=hb, number=1)
        url = reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}) + f"?mode={mode}"
        body = client.get(url).content.decode()
        # Restrição ao bloco do toggle group.
        idx = body.index('class="mode-toggle-group"')
        end = body.index("</div>", idx)
        block = body[idx:end]
        assert block.count('data-active="true"') == 1
        # E o ativo é o botão que aponta pro modo atual.
        assert f'href="?mode={mode}"' in block


@pytest.mark.django_db
class TestCarouselCounterPill:
    """Pílula vive DENTRO de cada slide article (SSR estático), não como overlay
    fixed global — usuário pediu 'fixo dentro do body do slide'."""

    def test_one_pill_per_slide(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Pill Per Slide")
        for n in (1, 2, 3, 4, 5):
            hymn_factory(hymn_book=hb, number=n)
        url = reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}) + "?mode=carrossel"
        body = client.get(url).content.decode()
        # 5 hinos → 5 pílulas (uma por slide)
        assert body.count('class="carousel-counter-pill"') == 5

    def test_each_pill_has_correct_number(self, client, hymn_book_factory, hymn_factory):
        """Cada slide mostra '<number> / <total>' do seu próprio hino."""
        hb = hymn_book_factory(name="Counter Format")
        for n in (1, 2, 3):
            hymn_factory(hymn_book=hb, number=n)
        url = reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}) + "?mode=carrossel"
        body = client.get(url).content.decode()
        # Procura cada slide e confere texto da pílula
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
    """Máximo 11 dots — janela proporcional pelo hinário inteiro. JS mapeia
    posição relativa do hino atual ao dot ativo (escala 0..10). Hinários com
    <11 hinos ficam 1:1 (excedentes ocultos via JS)."""

    def test_dots_max_11_for_large_book(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Dots Big")
        for n in range(1, 51):  # 50 hinos
            hymn_factory(hymn_book=hb, number=n)
        url = reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}) + "?mode=carrossel"
        body = client.get(url).content.decode()
        dots_idx = body.index("data-carousel-dots")
        dots_end = body.index("</div>", dots_idx)
        dots_block = body[dots_idx:dots_end]
        # SSR sempre renderiza 11 dots; JS oculta excedentes se total < 11.
        assert dots_block.count('class="carousel-dot"') == 11

    def test_dots_use_new_class_no_legacy(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Dots Class")
        for n in range(1, 6):
            hymn_factory(hymn_book=hb, number=n)
        url = reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}) + "?mode=carrossel"
        body = client.get(url).content.decode()
        dots_idx = body.index("data-carousel-dots")
        dots_end = body.index("</div>", dots_idx)
        dots_block = body[dots_idx:dots_end]
        # Classes Tailwind antigas não devem aparecer no bloco dos dots.
        assert "bg-ink/20" not in dots_block
        assert "bg-gold" not in dots_block
        assert "w-2 h-2" not in dots_block

    def test_dots_have_position_attr(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Dots Position")
        hymn_factory(hymn_book=hb, number=1)
        url = reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}) + "?mode=carrossel"
        body = client.get(url).content.decode()
        dots_idx = body.index("data-carousel-dots")
        dots_end = body.index("</div>", dots_idx)
        dots_block = body[dots_idx:dots_end]
        # Cada dot tem `data-dot-position` 0..10
        for pos in range(11):
            assert f'data-dot-position="{pos}"' in dots_block

    def test_footer_helper_text(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Footer Helper")
        hymn_factory(hymn_book=hb, number=1)
        url = reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}) + "?mode=carrossel"
        body = client.get(url).content.decode()
        assert "← → para navegar · espaço para tocar áudio" in body


@pytest.mark.django_db
class TestCarouselHeroVisible:
    """Hero do hinário (capa + descrição + badges) deve aparecer no carrossel
    também — usuário pediu paridade com modos índice e corrido."""

    def test_hero_visible_in_carousel(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Hero Carousel Test", owner_name="Mestre Hero")
        hymn_factory(hymn_book=hb, number=1)
        url = reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}) + "?mode=carrossel"
        body = client.get(url).content.decode()
        # O hero é o primeiro <section> com linear-gradient(140deg). Ele tinha
        # `{% if mode == 'carrossel' %} hidden{% endif %}` — não pode mais.
        assert "linear-gradient(140deg" in body
        section_start = body.index("<section")
        section_open_end = body.index(">", section_start) + 1
        section_open = body[section_start:section_open_end]
        # Extrai os tokens da `class="..."` e checa que `hidden` não está lá.
        import re

        m = re.search(r'class="([^"]+)"', section_open)
        classes = m.group(1).split() if m else []
        assert "hidden" not in classes, f"hero section should be visible in carousel, got classes: {classes}"
        # E o nome do hinário aparece (h1 do hero)
        assert "Hero Carousel Test" in body


class TestComponentsCssDefines:
    """As regras CSS dos novos componentes precisam estar em components.css."""

    def _css(self) -> str:
        return (PROJECT_ROOT / "static/css/components.css").read_text(encoding="utf-8")

    def test_mode_toggle_group_rule_present(self):
        css = self._css()
        assert ".mode-toggle-group" in css

    def test_mode_toggle_btn_rule_present(self):
        css = self._css()
        assert ".mode-toggle-btn" in css

    def test_active_btn_uses_rust(self):
        css = self._css()
        idx = css.index('.mode-toggle-btn[data-active="true"]')
        block = css[idx : idx + 400]
        assert "var(--color-rust)" in block

    def test_counter_pill_rule_present(self):
        css = self._css()
        assert ".carousel-counter-pill" in css

    def test_carousel_dot_rules(self):
        css = self._css()
        assert ".carousel-dot" in css
        # Estado ativo (24×6 + rust)
        idx = css.index('.carousel-dot[data-active="true"]')
        block = css[idx : idx + 400]
        assert "width: 24px" in block
        assert "var(--color-rust)" in block


class TestCarouselJsBehavior:
    """JS agora não formata mais o contador (pílula é SSR por slide). Mantém
    apenas a lógica dos dots (data-active) e mapeamento proporcional."""

    def test_js_no_longer_formats_counter(self):
        """Pílula é estática por slide — JS não precisa mais escrever label."""
        js = (PROJECT_ROOT / "static/js/hymn-carousel.js").read_text(encoding="utf-8")
        assert "'HINO '" not in js
        # Não há mais query por [data-carousel-counter]
        assert "data-carousel-counter" not in js

    def test_js_uses_data_active_for_dots(self):
        js = (PROJECT_ROOT / "static/js/hymn-carousel.js").read_text(encoding="utf-8")
        assert "dataset.active" in js

    def test_js_caps_dots_at_11(self):
        """Lógica de janela proporcional: até 11 dots."""
        js = (PROJECT_ROOT / "static/js/hymn-carousel.js").read_text(encoding="utf-8")
        assert "MAX_DOTS" in js
        assert "11" in js
        assert "dotPositionForIndex" in js or "Math.floor" in js
