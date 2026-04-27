"""
Testes do service wrapper run_ocr.
"""

import os
from unittest.mock import MagicMock, patch

import pytest

from apps.hymns.services.ocr import run_ocr


def _fake_hymnbook(num_hymns=2):
    """Build a fake hymn-ocr HymnBook for mocking."""
    from hymn_ocr.models import Hymn, HymnBook

    return HymnBook(
        name="Hinário Teste",
        owner_name="Dono",
        intro_name="Teste",
        hymns=[Hymn(number=i, title=f"Hino {i}", text=f"Letra {i}") for i in range(1, num_hymns + 1)],
    )


@pytest.fixture
def tmp_pdf(tmp_path):
    """Create a placeholder PDF file for cleanup tests."""
    p = tmp_path / "fake.pdf"
    p.write_bytes(b"%PDF-1.4 dummy")
    return str(p)


class TestRunOcr:
    def test_returns_upload_data_dict(self, tmp_pdf):
        with patch("apps.hymns.services.ocr.pdf_to_hymnbook", return_value=_fake_hymnbook()):
            result = run_ocr(tmp_pdf, name="Test", owner_name="Owner", cleanup=False)

        assert "hymn_book" in result
        hb = result["hymn_book"]
        assert hb["name"] == "Hinário Teste"
        assert hb["owner"] == "Dono"
        assert hb["intro_name"] == "Teste"
        assert len(hb["hymns"]) == 2
        assert hb["hymns"][0]["number"] == 1
        assert hb["hymns"][0]["title"] == "Hino 1"
        assert hb["hymns"][0]["text"] == "Letra 1"

    def test_passes_progress_callback(self, tmp_pdf):
        cb = MagicMock()
        with patch("apps.hymns.services.ocr.pdf_to_hymnbook", return_value=_fake_hymnbook()) as mock_p:
            run_ocr(tmp_pdf, name="X", owner_name="Y", progress_callback=cb, cleanup=False)

        kwargs = mock_p.call_args.kwargs
        assert kwargs["progress_callback"] is cb

    def test_passes_name_and_owner_to_hymn_ocr(self, tmp_pdf):
        with patch("apps.hymns.services.ocr.pdf_to_hymnbook", return_value=_fake_hymnbook()) as mock_p:
            run_ocr(tmp_pdf, name="Custom Name", owner_name="Custom Owner", cleanup=False)

        kwargs = mock_p.call_args.kwargs
        assert kwargs["name"] == "Custom Name"
        assert kwargs["owner_name"] == "Custom Owner"

    def test_strips_temp_pdf_after_success(self, tmp_pdf):
        assert os.path.exists(tmp_pdf)
        with patch("apps.hymns.services.ocr.pdf_to_hymnbook", return_value=_fake_hymnbook()):
            run_ocr(tmp_pdf, name="X", owner_name="Y", cleanup=True)
        assert not os.path.exists(tmp_pdf)

    def test_strips_temp_pdf_after_exception(self, tmp_pdf):
        assert os.path.exists(tmp_pdf)
        with patch("apps.hymns.services.ocr.pdf_to_hymnbook", side_effect=RuntimeError("boom")):
            with pytest.raises(RuntimeError):
                run_ocr(tmp_pdf, name="X", owner_name="Y", cleanup=True)
        assert not os.path.exists(tmp_pdf)

    def test_keeps_pdf_when_cleanup_false(self, tmp_pdf):
        with patch("apps.hymns.services.ocr.pdf_to_hymnbook", return_value=_fake_hymnbook()):
            run_ocr(tmp_pdf, name="X", owner_name="Y", cleanup=False)
        assert os.path.exists(tmp_pdf)

    def test_raises_when_no_hymns_extracted(self, tmp_pdf):
        # Pydantic itself enforces min_length=1 on hymns, so build a mock
        # object that bypasses validation to simulate an "empty" return.
        empty = MagicMock()
        empty.hymns = []
        with patch("apps.hymns.services.ocr.pdf_to_hymnbook", return_value=empty):
            with pytest.raises(ValueError, match="Nenhum hino"):
                run_ocr(tmp_pdf, name="X", owner_name="Y", cleanup=True)
        # Even on validation failure, pdf must be removed
        assert not os.path.exists(tmp_pdf)
