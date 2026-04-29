"""
Marco 1.6 — propagação do `source=OCR` no fluxo de upload.

Hinos importados via OCR devem ter `source=OCR` e `review_status=NOT_REVIEWED`;
o hinário criado deve entrar como `is_published=False`. Garante que a fila do
editor (Marco 1.5) recebe esses hinos para revisão antes da publicação.
"""

import pytest
from django.urls import reverse

from apps.hymns.models import Hymn, HymnBook


def _seed_session_with_ocr_data(client):
    """Coloca `upload_data` na sessão simulando OCR completo."""
    payload = {
        "hymn_book": {
            "name": "Teste OCR",
            "owner": "Importado",
            "intro_name": "Teste",
            "hymns": [
                {"number": 1, "title": "Lua", "text": "linha"},
                {"number": 2, "title": "Sol", "text": "outra linha"},
            ],
        }
    }
    session = client.session
    session["upload_data"] = {
        "yaml_content": repr(payload),
        "yaml_filename": "ocr.pdf",
        "name": "Teste OCR",
        "hymns_count": 2,
        "source": "pdf",
    }
    session.save()


@pytest.mark.django_db
class TestOCRPreviewCreatesAuditableData:
    def test_creates_hymnbook_unpublished(self, authenticated_client):
        _seed_session_with_ocr_data(authenticated_client)
        resp = authenticated_client.post(reverse("users:upload_preview"))
        assert resp.status_code == 302
        hb = HymnBook.objects.get(name="Teste OCR")
        assert hb.is_published is False

    def test_creates_hymns_with_source_ocr(self, authenticated_client):
        _seed_session_with_ocr_data(authenticated_client)
        authenticated_client.post(reverse("users:upload_preview"))
        hb = HymnBook.objects.get(name="Teste OCR")
        for h in hb.hymns.all():
            assert h.source == Hymn.Source.OCR

    def test_creates_hymns_not_reviewed(self, authenticated_client):
        _seed_session_with_ocr_data(authenticated_client)
        authenticated_client.post(reverse("users:upload_preview"))
        hb = HymnBook.objects.get(name="Teste OCR")
        for h in hb.hymns.all():
            assert h.review_status == Hymn.ReviewStatus.NOT_REVIEWED
