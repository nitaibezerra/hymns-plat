"""
E2E tests for public navigation.

NOTE: These tests run against a live server on localhost:9000.
Start the server before running: poetry run python manage.py runserver 9000
"""

import pytest
from playwright.sync_api import Page, expect


@pytest.mark.e2e
class TestPublicNavigation:
    """Tests for public navigation (no login required)."""

    def test_home_page_loads(self, page: Page, base_url: str):
        """Home page loads with title and statistics."""
        page.goto(base_url)

        title = page.title()
        assert "Hinaria" in title or "Hinários" in title or "Hinário" in title

        # Main heading should be visible
        expect(page.locator("h1").first).to_be_visible()

    def test_hymnbook_list_shows_hymnbooks(self, page: Page, base_url: str):
        """Hymnbook list page shows registered hymnbooks."""
        page.goto(f"{base_url}/hinarios/")

        # Page should load - use get_by_role with exact=True for precise selection
        expect(page.get_by_role("heading", name="Hinários", exact=True)).to_be_visible()

        # Should have at least one hymnbook card (Phase 2 markup uses <article>)
        cards = page.locator("a[href^='/hinarios/'] article")
        expect(cards.first).to_be_visible()

    def test_hymnbook_detail_shows_hymns(self, page: Page, base_url: str):
        """Hymnbook detail page shows list of hymns."""
        page.goto(f"{base_url}/hinarios/")

        # Click on first hymnbook link (Ver Hinário or the card itself)
        hymnbook_link = page.locator("a[href*='/hinarios/'][href$='/']").first
        hymnbook_link.click()

        page.wait_for_load_state("networkidle")

        # Should show hymn list (table or cards)
        content = page.content()
        assert "hino" in content.lower() or "hymn" in content.lower()

    def test_hymn_detail_shows_lyrics(self, page: Page, base_url: str):
        """Hymn detail page shows full lyrics."""
        # Go to a known hymn detail page
        page.goto(f"{base_url}/hinarios/")

        # Click on hymnbook
        page.locator("a[href*='/hinarios/']").first.click()
        page.wait_for_load_state("networkidle")

        # Click on a hymn row/link
        hymn_link = page.locator("a[href*='/hino/']").first
        if hymn_link.is_visible():
            hymn_link.click()
            page.wait_for_load_state("networkidle")
            # Should show hymn text
            expect(page.locator(".hymn-text")).to_be_visible()

    def test_search_page_loads(self, page: Page, base_url: str):
        """Search page loads and accepts input."""
        page.goto(f"{base_url}/busca/")

        # Phase 2: header has a global search input AND the page renders its own
        # form. Disambiguate by selecting the autofocused page input.
        search_input = page.locator('input[name="q"][autofocus]')
        expect(search_input).to_be_visible()
