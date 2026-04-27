"""
E2E tests for hymnbook upload.

NOTE: These tests run against a live server on localhost:9000.
Requires a test user to exist: teste2e@example.com / testpass123
"""

import pytest
from playwright.sync_api import Page, expect


@pytest.mark.e2e
class TestHymnbookUpload:
    """Tests for hymnbook upload functionality."""

    def test_upload_page_requires_authentication(self, page: Page, base_url: str):
        """Upload without login redirects to login."""
        page.goto(f"{base_url}/contribuir/")

        page.wait_for_load_state("networkidle")
        # Should redirect to login
        assert "/accounts/login/" in page.url

    def test_upload_page_loads_when_authenticated(self, authenticated_page: Page, base_url: str):
        """Upload page loads for authenticated user."""
        authenticated_page.goto(f"{base_url}/contribuir/")

        authenticated_page.wait_for_load_state("networkidle")
        # Should show PDF file input
        file_input = authenticated_page.locator('input[name="pdf_file"]')
        expect(file_input).to_be_visible()

    def test_upload_missing_metadata_shows_error(self, authenticated_page: Page, base_url: str, tmp_path):
        """Submitting the PDF form with missing required fields shows errors."""
        pdf_path = tmp_path / "small.pdf"
        pdf_path.write_bytes(b"%PDF-1.4 dummy")

        authenticated_page.goto(f"{base_url}/contribuir/")
        authenticated_page.set_input_files('input[name="pdf_file"]', str(pdf_path))
        # Don't fill name/owner — the form must complain
        authenticated_page.click('button[type="submit"]')

        authenticated_page.wait_for_load_state("networkidle")
        error_locator = authenticated_page.locator(".errorlist, .alert-danger, .error")
        expect(error_locator.first).to_be_visible()
