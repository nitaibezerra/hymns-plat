"""
Testes do fluxo PDF: form, view de upload, processing view, status endpoint.
"""

from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from apps.hymns.models import OCRTask


def _pdf_upload_file(name="test.pdf", content=b"%PDF-1.4 dummy"):
    return SimpleUploadedFile(name, content, content_type="application/pdf")


@pytest.mark.django_db
class TestUploadFormPdf:
    def test_form_rejects_missing_pdf(self):
        from apps.hymns.forms import HymnBookPdfUploadForm

        form = HymnBookPdfUploadForm(data={"name": "X", "owner_name": "Y"}, files={})
        assert not form.is_valid()
        assert "pdf_file" in form.errors

    def test_form_requires_name_and_owner(self):
        from apps.hymns.forms import HymnBookPdfUploadForm

        form = HymnBookPdfUploadForm(data={}, files={"pdf_file": _pdf_upload_file()})
        assert not form.is_valid()
        assert "name" in form.errors
        assert "owner_name" in form.errors

    def test_form_valid_with_pdf_and_metadata(self):
        from apps.hymns.forms import HymnBookPdfUploadForm

        form = HymnBookPdfUploadForm(
            data={"name": "Hinário Teste", "owner_name": "Padrinho Teste"},
            files={"pdf_file": _pdf_upload_file()},
        )
        assert form.is_valid(), form.errors


@pytest.mark.django_db
class TestUploadViewPdf:
    @patch("apps.hymns.services.ocr.launch_ocr_task")
    def test_post_pdf_creates_task_and_redirects_to_processing(self, mock_launch, authenticated_client):
        url = reverse("users:upload")
        resp = authenticated_client.post(
            url,
            {"name": "Novo Hinário", "owner_name": "Padrinho X", "pdf_file": _pdf_upload_file()},
        )
        # Redirect to processing page
        assert resp.status_code == 302
        assert "/contribuir/processando/" in resp.url

        task = OCRTask.objects.get()
        assert task.user == authenticated_client.user
        assert task.status == OCRTask.STATUS_PENDING
        assert task.pdf_filename == "test.pdf"
        mock_launch.assert_called_once()

    def test_get_renders_form(self, authenticated_client):
        resp = authenticated_client.get(reverse("users:upload"))
        assert resp.status_code == 200


@pytest.mark.django_db
class TestUploadProcessingView:
    def test_renders_progress_for_pending_task(self, authenticated_client):
        task = OCRTask.objects.create(user=authenticated_client.user, total_pages=100, current_page=10)
        url = reverse("users:upload_processing")
        resp = authenticated_client.get(f"{url}?task={task.id}")
        assert resp.status_code == 200
        assert b"task" in resp.content.lower() or str(task.id).encode() in resp.content

    def test_redirects_to_preview_when_task_complete_no_dupes(self, authenticated_client):
        result = {
            "hymn_book": {
                "name": "Único Novo",
                "owner": "Dono Novo",
                "intro_name": "",
                "hymns": [{"number": 1, "title": "H1", "text": "L1"}],
            }
        }
        task = OCRTask.objects.create(
            user=authenticated_client.user, status=OCRTask.STATUS_COMPLETED, result_data=result
        )
        url = reverse("users:upload_processing")
        resp = authenticated_client.get(f"{url}?task={task.id}")
        assert resp.status_code == 302
        assert resp.url == reverse("users:upload_preview")
        # session populated like in YAML flow
        assert "upload_data" in authenticated_client.session

    def test_redirects_to_disambiguate_when_dupes(self, authenticated_client, hymn_book_factory):
        existing = hymn_book_factory(name="Existing Book", owner_name="Whoever")
        # Same name → exact match should be detected
        result = {
            "hymn_book": {
                "name": existing.name,
                "owner": "Some Owner",
                "intro_name": "",
                "hymns": [{"number": 1, "title": "H1", "text": "Letra 1"}],
            }
        }
        task = OCRTask.objects.create(
            user=authenticated_client.user, status=OCRTask.STATUS_COMPLETED, result_data=result
        )
        url = reverse("users:upload_processing")
        resp = authenticated_client.get(f"{url}?task={task.id}")
        assert resp.status_code == 302
        assert resp.url == reverse("users:upload_disambiguate")

    def test_shows_error_for_failed_task(self, authenticated_client):
        task = OCRTask.objects.create(
            user=authenticated_client.user, status=OCRTask.STATUS_FAILED, error_message="Boom"
        )
        url = reverse("users:upload_processing")
        resp = authenticated_client.get(f"{url}?task={task.id}")
        assert resp.status_code == 200
        assert b"Boom" in resp.content

    def test_404_for_unknown_task(self, authenticated_client):
        import uuid

        url = reverse("users:upload_processing")
        resp = authenticated_client.get(f"{url}?task={uuid.uuid4()}")
        assert resp.status_code == 404

    def test_403_for_other_user_task(self, authenticated_client, user_factory):
        other = user_factory(email="other@example.com")
        task = OCRTask.objects.create(user=other)
        url = reverse("users:upload_processing")
        resp = authenticated_client.get(f"{url}?task={task.id}")
        assert resp.status_code == 403


@pytest.mark.django_db
class TestUploadOcrStatusEndpoint:
    def test_returns_json_with_progress(self, authenticated_client):
        task = OCRTask.objects.create(
            user=authenticated_client.user,
            status=OCRTask.STATUS_PROCESSING,
            current_page=42,
            total_pages=100,
        )
        url = reverse("users:upload_ocr_status", kwargs={"task_id": task.id})
        resp = authenticated_client.get(url)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == OCRTask.STATUS_PROCESSING
        assert data["current"] == 42
        assert data["total"] == 100
        assert data["percent"] == 42
        assert data["ready"] is False

    def test_ready_true_when_completed(self, authenticated_client):
        task = OCRTask.objects.create(user=authenticated_client.user, status=OCRTask.STATUS_COMPLETED)
        url = reverse("users:upload_ocr_status", kwargs={"task_id": task.id})
        resp = authenticated_client.get(url)
        assert resp.json()["ready"] is True

    def test_403_for_other_user(self, authenticated_client, user_factory):
        other = user_factory(email="other2@example.com")
        task = OCRTask.objects.create(user=other)
        url = reverse("users:upload_ocr_status", kwargs={"task_id": task.id})
        resp = authenticated_client.get(url)
        assert resp.status_code == 403

    def test_login_required(self, client):
        import uuid

        url = reverse("users:upload_ocr_status", kwargs={"task_id": uuid.uuid4()})
        resp = client.get(url)
        assert resp.status_code in (302, 403)
