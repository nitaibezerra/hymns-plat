"""
OCR service: thin adapter around `hymn_ocr.pdf_to_hymnbook` that produces
a dict in the shape expected by the upload wizard (matches yaml.safe_load
output for the hymn_book YAML format).

Also exposes a fire-and-forget thread launcher for asynchronous processing
backed by the OCRTask model.
"""

import os
import threading
from typing import Callable, Optional

from hymn_ocr import pdf_to_hymnbook


def run_ocr(
    pdf_path: str,
    *,
    name: str,
    owner_name: str,
    progress_callback: Optional[Callable[[int, int], None]] = None,
    cleanup: bool = True,
) -> dict:
    """
    Run OCR on a PDF and return a dict matching the YAML upload shape:

        {"hymn_book": {"name", "owner", "intro_name", "hymns": [...]}}

    Always removes the PDF when cleanup=True, even on failure.
    """
    try:
        hymnbook = pdf_to_hymnbook(
            pdf_path,
            name=name,
            owner_name=owner_name,
            progress_callback=progress_callback,
        )
        if not hymnbook.hymns:
            raise ValueError("Nenhum hino extraído do PDF.")
        return {
            "hymn_book": {
                "name": hymnbook.name,
                "owner": hymnbook.owner_name,
                "intro_name": hymnbook.intro_name or "",
                "hymns": [_hymn_to_dict(h) for h in hymnbook.hymns],
            }
        }
    finally:
        if cleanup and os.path.exists(pdf_path):
            os.remove(pdf_path)


def _hymn_to_dict(hymn) -> dict:
    """Pydantic model -> plain dict, dropping None fields and empty strings."""
    data = hymn.model_dump(exclude_none=True)
    # Filter out empty optional fields to keep the YAML/preview clean.
    return {k: v for k, v in data.items() if v != ""}


def launch_ocr_task(task_id, pdf_path: str, name: str, owner_name: str) -> None:
    """
    Spawn a daemon thread that processes the PDF and updates the OCRTask row.

    Uses raw .update() filtered by pk for progress so we don't hold an
    instance across the whole job (avoids stale connections in long runs).
    """
    from django.db import close_old_connections
    from django.utils import timezone

    from apps.hymns.models import OCRTask

    def worker():
        close_old_connections()
        try:
            OCRTask.objects.filter(pk=task_id).update(
                status=OCRTask.STATUS_PROCESSING,
                started_at=timezone.now(),
            )

            def on_progress(current: int, total: int):
                OCRTask.objects.filter(pk=task_id).update(
                    current_page=current,
                    total_pages=total,
                )

            data = run_ocr(
                pdf_path,
                name=name,
                owner_name=owner_name,
                progress_callback=on_progress,
                cleanup=True,
            )
            OCRTask.objects.filter(pk=task_id).update(
                status=OCRTask.STATUS_COMPLETED,
                result_data=data,
                finished_at=timezone.now(),
            )
        except Exception as e:
            OCRTask.objects.filter(pk=task_id).update(
                status=OCRTask.STATUS_FAILED,
                error_message=str(e)[:2000],
                finished_at=timezone.now(),
            )
        finally:
            close_old_connections()

    threading.Thread(target=worker, daemon=True).start()
