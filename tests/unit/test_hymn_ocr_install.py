"""
Smoke test: hymn-ocr installed and importable as a library.
"""


def test_can_import_hymn_ocr():
    from hymn_ocr import pdf_to_hymnbook  # noqa: F401
    from hymn_ocr.models import Hymn, HymnBook  # noqa: F401


def test_pdf_to_hymnbook_accepts_progress_callback():
    """The signature must include progress_callback (we depend on it for the UI)."""
    import inspect

    from hymn_ocr import pdf_to_hymnbook

    sig = inspect.signature(pdf_to_hymnbook)
    assert "progress_callback" in sig.parameters
