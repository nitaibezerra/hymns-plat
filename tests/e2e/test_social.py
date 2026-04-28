"""
E2E tests for social features.

NOTE: These tests run against a live server on localhost:9000.
Requires existing hymns in the database.
"""

import pytest
from playwright.sync_api import Page, expect


@pytest.mark.e2e
class TestSocialFeatures:
    """Tests for social features."""

    def test_hymn_detail_shows_social_buttons_when_authenticated(self, authenticated_page: Page, base_url: str):
        """Social buttons are visible on hymn detail when authenticated."""
        # First get a hymn ID from the hymnbook list
        authenticated_page.goto(f"{base_url}/hinarios/")
        authenticated_page.locator("a[href*='/hinarios/']").first.click()
        authenticated_page.wait_for_load_state("networkidle")

        hymn_link = authenticated_page.locator("a[href*='/hino/']").first
        if hymn_link.is_visible():
            hymn_link.click()
            authenticated_page.wait_for_load_state("networkidle")

            # Favorite button should be visible
            fav_button = authenticated_page.locator('[data-action="toggle-favorite"], button:has-text("Favorit")')
            expect(fav_button).to_be_visible()

    def test_notifications_page_loads(self, authenticated_page: Page, base_url: str):
        """Notifications page loads for authenticated user."""
        authenticated_page.goto(f"{base_url}/notificacoes/")

        authenticated_page.wait_for_load_state("networkidle")
        expect(authenticated_page.get_by_role("heading", name="Notificações")).to_be_visible()

    def test_profile_page_loads(self, authenticated_page: Page, base_url: str):
        """User profile page loads."""
        authenticated_page.goto(f"{base_url}/perfil/teste2e/")

        authenticated_page.wait_for_load_state("networkidle")
        # Profile should show username or name
        content = authenticated_page.content()
        assert "teste2e" in content.lower() or "perfil" in content.lower()
