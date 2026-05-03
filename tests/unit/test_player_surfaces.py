"""Player Surfaces (PR 3) — Queue Drawer + Work Mode + Sleep Timer + MediaSession.

Spec: `_design/PLAYER_DESIGN.md` §3.3, §3.4, §7.7-7.10.

Estes testes verificam markup estático no partial e markers JS — comportamento
runtime é validado via Playwright.
"""

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _read(rel: str) -> str:
    return (PROJECT_ROOT / rel).read_text(encoding="utf-8")


class TestQueueDrawerMarkup:
    """Drawer lateral 380px, lista de hinos com estados current/played/next."""

    def test_drawer_present(self):
        partial = _read("templates/hymns/_player_global.html")
        assert 'id="player-queue"' in partial

    def test_drawer_is_dialog(self):
        partial = _read("templates/hymns/_player_global.html")
        idx = partial.index('id="player-queue"')
        block = partial[idx : idx + 600]
        assert 'role="dialog"' in block
        assert "aria-modal" in block

    def test_drawer_has_close_button(self):
        partial = _read("templates/hymns/_player_global.html")
        assert "data-queue-close" in partial

    def test_drawer_has_list_container(self):
        partial = _read("templates/hymns/_player_global.html")
        assert "data-queue-list" in partial

    def test_bar_has_queue_toggle(self):
        partial = _read("templates/hymns/_player_global.html")
        assert "data-queue-toggle" in partial


class TestWorkModeMarkup:
    """Overlay full-screen z-55, sobrepõe TUDO inclusive a barra."""

    def test_workmode_overlay_present(self):
        partial = _read("templates/hymns/_player_global.html")
        assert 'id="player-workmode"' in partial

    def test_workmode_is_dialog(self):
        partial = _read("templates/hymns/_player_global.html")
        idx = partial.index('id="player-workmode"')
        block = partial[idx : idx + 800]
        assert 'role="dialog"' in block
        assert "aria-modal" in block

    def test_workmode_has_exit(self):
        partial = _read("templates/hymns/_player_global.html")
        assert "data-workmode-exit" in partial

    def test_bar_has_workmode_toggle(self):
        partial = _read("templates/hymns/_player_global.html")
        assert "data-workmode-toggle" in partial


class TestSleepTimerMarkup:
    """Menu pop-up no bar com 15/30/60 min options + opção 'desligado'."""

    def test_sleep_button_present(self):
        partial = _read("templates/hymns/_player_global.html")
        assert "data-sleep-toggle" in partial

    def test_sleep_menu_present(self):
        partial = _read("templates/hymns/_player_global.html")
        assert "data-sleep-menu" in partial

    def test_sleep_options(self):
        partial = _read("templates/hymns/_player_global.html")
        for v in ("15", "30", "60"):
            assert f'data-sleep-set="{v}"' in partial


class TestPlayerJsHandlers:
    def test_js_handles_queue_drawer(self):
        js = _read("static/js/player.js")
        assert "data-queue-toggle" in js or "openQueue" in js
        assert "data-queue-close" in js or "closeQueue" in js

    def test_js_handles_workmode(self):
        js = _read("static/js/player.js")
        assert "data-workmode-toggle" in js or "workMode" in js
        assert "data-workmode-exit" in js or "exitWorkMode" in js

    def test_js_handles_sleep_timer(self):
        js = _read("static/js/player.js")
        assert "sleepTimer" in js or "data-sleep-set" in js
        assert "setTimeout" in js

    def test_js_uses_mediasession(self):
        js = _read("static/js/player.js")
        # MediaSession API for lockscreen / Bluetooth controls
        assert "mediaSession" in js
        assert "MediaMetadata" in js
