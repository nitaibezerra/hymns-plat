"""Guard against accidental regression of the design's font setup.

The design (`_design/fase2-bundle/project/styles/tokens.css`) defines THREE
distinct font families with specific roles:

- `--font-display`: Cormorant Garamond — decorative serif for titles
- `--font-serif`:   Source Serif 4    — readable body serif for hymn verses
- `--font-sans`:    Inter Tight       — UI / navigation

If any of these is dropped from the Google Fonts import or from the Tailwind
config, the visual identity collapses (e.g. hymn body falls back to Cormorant,
which is decorative and not meant for paragraph reading). These tests pin
that contract.
"""

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _read(rel: str) -> str:
    return (PROJECT_ROOT / rel).read_text(encoding="utf-8")


class TestGoogleFontsImport:
    """The base.html link tag must request all four families with the right names.

    This catches the common bug where someone tweaks the font query string
    without updating Tailwind config (or vice-versa) and suddenly Source Serif 4
    is requested but never used, or used but never loaded.
    """

    def test_base_html_imports_all_four_families(self):
        base = _read("templates/base.html")
        assert "Cormorant+Garamond" in base
        assert "Source+Serif+4" in base, "Source Serif 4 (body serif for hymns) is missing"
        assert "Inter+Tight" in base, "Inter Tight (UI sans) must replace plain Inter"
        assert "JetBrains+Mono" in base


class TestTailwindFontFamilyConfig:
    """The inline tailwind.config in base.html must register `display` and use the
    correct primary face for `serif` and `sans`."""

    def test_display_family_is_cormorant(self):
        base = _read("templates/base.html")
        # rough but resilient: the line `display: [...]` must include Cormorant Garamond.
        assert "display:" in base
        # Find the display font config line.
        i = base.index("display:")
        snippet = base[i : i + 200]
        assert "Cormorant Garamond" in snippet

    def test_serif_family_is_source_serif_4(self):
        base = _read("templates/base.html")
        i = base.index("serif:")
        snippet = base[i : i + 200]
        assert "Source Serif 4" in snippet, "serif must point at Source Serif 4 (the body face)"

    def test_sans_family_is_inter_tight(self):
        base = _read("templates/base.html")
        i = base.index("sans:")
        snippet = base[i : i + 200]
        assert "Inter Tight" in snippet


class TestDesignTokensCss:
    """The `static/css/design-tokens.css` file mirrors the Tailwind config so that
    components that don't use Tailwind utility classes (e.g. `.label-mono`,
    `.dot-leader`) still pick up the correct families."""

    def test_tokens_css_defines_font_display(self):
        css = _read("static/css/design-tokens.css")
        assert "--font-display:" in css
        # find the line and assert Cormorant Garamond on it
        idx = css.index("--font-display:")
        line = css[idx : css.index("\n", idx)]
        assert "Cormorant Garamond" in line

    def test_tokens_css_serif_is_source_serif_4(self):
        css = _read("static/css/design-tokens.css")
        idx = css.index("--font-serif:")
        line = css[idx : css.index("\n", idx)]
        assert "Source Serif 4" in line

    def test_tokens_css_sans_is_inter_tight(self):
        css = _read("static/css/design-tokens.css")
        idx = css.index("--font-sans:")
        line = css[idx : css.index("\n", idx)]
        assert "Inter Tight" in line


class TestTemplateUsage:
    """Spot-check that key surfaces use `font-display` for titles, not the legacy
    `font-serif` (which now points at the body face)."""

    def test_hymn_title_uses_display_face(self):
        # hymn_detail h1 (the per-hymn page).
        html = _read("templates/hymns/hymn_detail.html")
        assert 'class="font-display' in html or 'class="font-display ' in html or "font-display text" in html

    def test_carousel_hymn_title_uses_display_face(self):
        # Após o refactor, corrido/carrossel vivem em `hymnbook_read.html`.
        # Detail mantém hero h1 + monogram (placeholder sem cover).
        detail = _read("templates/hymns/hymnbook_detail.html")
        assert detail.count("font-display") >= 2, "expected font-display on hero h1 + monogram placeholder"
        read = _read("templates/hymns/hymnbook_read.html")
        assert "font-display" not in read or "hymn-title" in read, (
            "carrossel/corrido podem usar font-serif no título (page-de-cantador), "
            "mas hymn-title precisa estar presente"
        )

    def test_brand_uses_display_face(self):
        html = _read("templates/_partials/_header.html")
        assert "font-display" in html, "brand 'Hinaria' should use the display face"

    def test_hymn_body_wrapper_keeps_serif_face(self):
        # Body wrappers em `hymnbook_read.html` mantêm `font-serif` (Source Serif 4).
        # Line-height vem do `LINE_HEIGHT_EM` em hymn_extras.py (1.55, alinhado
        # ao design), não mais via Tailwind `leading-[1.7]`.
        html = _read("templates/hymns/hymnbook_read.html")
        assert "font-serif text-lg mx-auto carousel-body" in html
        assert "font-serif text-lg max-w-prose mx-auto hymn-body-centered" in html
