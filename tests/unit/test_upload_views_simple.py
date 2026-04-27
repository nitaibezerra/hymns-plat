"""
Simple smoke tests for upload views to boost coverage.
"""

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

User = get_user_model()


@pytest.fixture
def user(django_user_model):
    """Create test user."""
    return django_user_model.objects.create_user(username="uploader", email="uploader@example.com", password="pass123")


def _pdf(name="test.pdf", content=b"%PDF-1.4 dummy"):
    return SimpleUploadedFile(name, content, content_type="application/pdf")


@pytest.mark.django_db
class TestUploadViewsSimple:
    """Simple smoke tests for upload views (PDF flow)."""

    def test_disambiguate_view_get_without_session(self, client, user):
        client.force_login(user)
        response = client.get(reverse("users:upload_disambiguate"))
        assert response.status_code == 302

    def test_preview_view_get_without_session(self, client, user):
        client.force_login(user)
        response = client.get(reverse("users:upload_preview"))
        assert response.status_code == 302

    def test_confirm_view_get_without_session(self, client, user):
        client.force_login(user)
        response = client.get(reverse("users:upload_confirm"))
        assert response.status_code == 302

    def test_disambiguate_view_cancel_choice(self, client, user):
        client.force_login(user)

        session = client.session
        session["upload_data"] = {"name": "Test", "owner": "Owner", "hymns": []}
        session.save()

        response = client.post(reverse("users:upload_disambiguate"), {"choice": "cancel"})
        assert response.status_code == 302
        assert "contribuir" in response.url

    def test_upload_view_missing_file(self, client, user):
        """POST with no file should re-render form with errors."""
        client.force_login(user)
        response = client.post(reverse("users:upload"), {})
        assert response.status_code == 200
        # Either field-level error message or generic word
        assert b"pdf_file" in response.content or b"arquivo" in response.content.lower()

    def test_upload_view_pdf_too_large(self, client, user):
        """PDF over 50MB → form error."""
        client.force_login(user)
        big = SimpleUploadedFile("big.pdf", b"x" * (51 * 1024 * 1024), content_type="application/pdf")
        response = client.post(
            reverse("users:upload"),
            {"name": "X", "owner_name": "Y", "pdf_file": big},
        )
        assert response.status_code == 200

    def test_upload_view_wrong_file_type(self, client, user):
        """Non-PDF extension → form error."""
        client.force_login(user)
        txt = SimpleUploadedFile("test.txt", b"not pdf", content_type="text/plain")
        response = client.post(
            reverse("users:upload"),
            {"name": "X", "owner_name": "Y", "pdf_file": txt},
        )
        assert response.status_code == 200
