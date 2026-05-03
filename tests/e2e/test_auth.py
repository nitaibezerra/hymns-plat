"""
E2E tests for authentication.

NOTE: These tests run against a live server on localhost:9000.
Start the server before running: poetry run python manage.py runserver 9000
"""

import pytest
from playwright.sync_api import Page, expect


@pytest.mark.e2e
class TestAuthentication:
    """Tests for user authentication.

    O site público é Google-only — não há login interno (email/senha).
    `/django-admin/` e `/admin/` (Wagtail) usam login próprio fora do allauth.
    """

    def test_login_page_shows_google_button_only(self, page: Page, base_url: str):
        """Login page mostra o botão Google e nenhum form de email/senha."""
        page.goto(f"{base_url}/accounts/login/")

        google_link = page.locator('a[href="/accounts/google/login/"]')
        expect(google_link).to_be_visible()
        expect(google_link).to_contain_text("Continuar com Google")
        expect(page.locator('input[name="login"]')).to_have_count(0)
        expect(page.locator('input[name="password"]')).to_have_count(0)

    def test_signup_url_renders_google_only_message(self, page: Page, base_url: str):
        """GET /accounts/signup/ → signup_closed (sem form, com botão Google)."""
        page.goto(f"{base_url}/accounts/signup/")

        expect(page.locator('input[name="password1"]')).to_have_count(0)
        expect(page.locator('a[href="/accounts/google/login/"]')).to_be_visible()

    def test_protected_page_redirects_to_login(self, page: Page, base_url: str):
        """Accessing protected page without login redirects to login."""
        page.goto(f"{base_url}/contribuir/")

        page.wait_for_load_state("networkidle")
        assert "/accounts/login/" in page.url
