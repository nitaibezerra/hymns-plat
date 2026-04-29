"""
Marco 2.0.1 — `Hymn.ocr_text` e `Hymn.ocr_avg_confidence`.

A tela "Revisar Hino" da Fase 2 exibe um diff visual entre o texto cru do OCR
e a versão atual; precisamos preservar o texto OCR e a confiança média no
banco para alimentar essa visualização.
"""

import pytest

from apps.hymns.models import Hymn


@pytest.mark.django_db
class TestHymnOCRMetadataFields:
    def test_ocr_text_default_blank(self, hymn):
        assert hymn.ocr_text == ""

    def test_ocr_avg_confidence_default_null(self, hymn):
        assert hymn.ocr_avg_confidence is None

    def test_can_persist_ocr_text(self, hymn_book):
        h = Hymn.objects.create(hymn_book=hymn_book, number=1, title="t", text="x", ocr_text="OCR cru")
        h.refresh_from_db()
        assert h.ocr_text == "OCR cru"

    def test_can_persist_ocr_avg_confidence(self, hymn_book):
        h = Hymn.objects.create(hymn_book=hymn_book, number=1, title="t", text="x", ocr_avg_confidence=87.5)
        h.refresh_from_db()
        assert abs(h.ocr_avg_confidence - 87.5) < 0.01


@pytest.mark.django_db
class TestOCRFlowPersistsMetadata:
    def _seed(self, client, with_confidence: bool = False):
        payload_hymn = {"number": 1, "title": "Lua", "text": "linha 1\nlinha 2"}
        if with_confidence:
            payload_hymn["ocr_avg_confidence"] = 87.5
        payload = {
            "hymn_book": {
                "name": "OCR Conf Test",
                "owner": "X",
                "intro_name": "T",
                "hymns": [payload_hymn],
            }
        }
        session = client.session
        session["upload_data"] = {
            "yaml_content": repr(payload),
            "yaml_filename": "ocr.pdf",
            "name": "OCR Conf Test",
            "hymns_count": 1,
            "source": "pdf",
        }
        session.save()

    def test_ocr_flow_persists_text_as_ocr_text(self, authenticated_client):
        from django.urls import reverse

        self._seed(authenticated_client)
        authenticated_client.post(reverse("users:upload_preview"))
        h = Hymn.objects.get(hymn_book__name="OCR Conf Test")
        assert h.ocr_text == "linha 1\nlinha 2"

    def test_ocr_flow_persists_confidence_when_present(self, authenticated_client):
        from django.urls import reverse

        self._seed(authenticated_client, with_confidence=True)
        authenticated_client.post(reverse("users:upload_preview"))
        h = Hymn.objects.get(hymn_book__name="OCR Conf Test")
        assert h.ocr_avg_confidence == 87.5

    def test_manual_hymn_has_no_ocr_text(self, hymn_book):
        h = Hymn.objects.create(hymn_book=hymn_book, number=99, title="manual", text="x")
        assert h.ocr_text == ""
        assert h.ocr_avg_confidence is None
