"""Player MVP — base.html carrega HTMX, marca o body como boosted, e inclui o
partial `_player_global.html` fora do <main> (para que ele sobreviva ao swap).

Estes testes verificam o markup estático (não exigem DB nem cliente).
"""

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _read(rel: str) -> str:
    return (PROJECT_ROOT / rel).read_text(encoding="utf-8")


class TestBaseHasHtmx:
    def test_loads_htmx_cdn(self):
        base = _read("templates/base.html")
        assert "htmx.org@" in base, "base.html must include htmx CDN script"

    def test_body_has_hx_boost(self):
        base = _read("templates/base.html")
        assert 'hx-boost="true"' in base, "body must opt into boost"

    def test_main_is_boost_target(self):
        base = _read("templates/base.html")
        assert 'id="main"' in base
        assert 'hx-target="#main"' in base or 'hx-target="this"' in base
        assert 'hx-select="#main"' in base, "must scope swap to #main so player partial outside <main> persists"

    def test_includes_player_partial(self):
        base = _read("templates/base.html")
        assert "hymns/_player_global.html" in base, "player_global partial must be included in base.html"

    def test_player_partial_outside_main(self):
        """Player must be rendered AFTER </main> so HTMX swap doesn't replace it."""
        base = _read("templates/base.html")
        main_close = base.index("</main>")
        partial = base.index("hymns/_player_global.html")
        assert partial > main_close, "player partial include must come AFTER </main>"


class TestPlayerGlobalPartial:
    def test_partial_file_exists(self):
        path = PROJECT_ROOT / "templates/hymns/_player_global.html"
        assert path.exists()

    def test_has_audio_element(self):
        partial = _read("templates/hymns/_player_global.html")
        assert "<audio" in partial
        assert 'id="player-audio"' in partial

    def test_has_player_bar(self):
        partial = _read("templates/hymns/_player_global.html")
        assert 'id="player-bar"' in partial

    def test_has_three_columns(self):
        partial = _read("templates/hymns/_player_global.html")
        # now-playing left + controls center + actions right
        assert "data-now" in partial or "player-now" in partial
        assert "data-controls" in partial or "player-controls" in partial
        assert "data-actions" in partial or "player-actions" in partial

    def test_has_play_pause_button(self):
        partial = _read("templates/hymns/_player_global.html")
        assert "data-play" in partial

    def test_has_prev_next_buttons(self):
        partial = _read("templates/hymns/_player_global.html")
        assert "data-prev" in partial
        assert "data-next" in partial

    def test_has_expand_button(self):
        partial = _read("templates/hymns/_player_global.html")
        assert "data-expand" in partial

    def test_has_expanded_overlay(self):
        partial = _read("templates/hymns/_player_global.html")
        assert 'id="player-expanded"' in partial

    def test_has_progress_seek(self):
        partial = _read("templates/hymns/_player_global.html")
        assert 'type="range"' in partial
        assert "data-seek" in partial


class TestPlayerStaticAssets:
    def test_player_js_exists(self):
        assert (PROJECT_ROOT / "static/js/player.js").exists()

    def test_player_js_has_state_and_storage(self):
        js = _read("static/js/player.js")
        assert "localStorage" in js
        assert "queue" in js
        assert "currentIdx" in js

    def test_player_js_handles_audio(self):
        js = _read("static/js/player.js")
        # references the audio element by id and has play/pause logic
        assert "player-audio" in js
        assert ".play()" in js
        assert ".pause()" in js

    def test_player_js_loaded_in_base(self):
        base = _read("templates/base.html")
        assert "js/player.js" in base

    def test_player_css_exists(self):
        assert (PROJECT_ROOT / "static/css/player.css").exists()

    def test_player_css_dark_chrome(self):
        css = _read("static/css/player.css")
        # Spotify-style chrome is always dark, hardcoded — not driven by theme.
        assert "rgba(20" in css and "18" in css

    def test_player_css_loaded_in_base(self):
        base = _read("templates/base.html")
        assert "css/player.css" in base


class TestPlayPauseToggleVisibility:
    """Bug fix: SVGElement não herda de HTMLElement, então `.hidden = true` é
    no-op. Trocamos pra controlar visibilidade via [data-state] no botão +
    CSS — funciona em qualquer Element (HTMLElement OR SVGElement)."""

    def test_pause_icon_has_no_hidden_attr(self):
        """Inicial: ambos SVGs renderizam; CSS oculta pause via display:none."""
        partial = _read("templates/hymns/_player_global.html")
        assert "data-icon-pause hidden" not in partial

    def test_css_hides_pause_by_default(self):
        css = _read("static/css/player.css")
        assert "[data-play] [data-icon-pause]" in css and "display: none" in css

    def test_css_swaps_via_data_state(self):
        css = _read("static/css/player.css")
        assert '[data-play][data-state="playing"] [data-icon-play]' in css

    def test_js_sets_data_state(self):
        js = _read("static/js/player.js")
        assert "btn.dataset.state" in js

    def test_js_handles_spacebar_shortcut(self):
        js = _read("static/js/player.js")
        # global toggle play/pause via spacebar
        assert "Space" in js or "' '" in js
        assert "togglePlay" in js


class TestIndexRowPauseIndicator:
    """Quando o hino tocando está visível na lista do índice, o ícone do
    botão `[data-player-play-hymn]` deve virar ⏸ no item atual."""

    def test_index_button_has_both_svgs(self):
        tpl = _read("templates/hymns/hymnbook_detail.html")
        idx = tpl.index("data-player-play-hymn")
        block = tpl[idx : idx + 800]
        assert "data-icon-play" in block
        assert "data-icon-pause" in block

    def test_css_handles_index_button_state(self):
        css = _read("static/css/player.css")
        assert "[data-player-play-hymn]" in css
        assert '[data-player-play-hymn][data-state="playing"]' in css

    def test_js_renders_index_button_state(self):
        js = _read("static/js/player.js")
        assert "data-player-play-hymn" in js
        # render() loop sets dataset.state on the index buttons
        assert "isCurrent" in js
