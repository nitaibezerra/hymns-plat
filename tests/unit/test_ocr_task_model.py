"""
Testes do model OCRTask (estado + progresso).
"""

import pytest
from django.utils import timezone

from apps.hymns.models import OCRTask


@pytest.fixture
def user(user_factory):
    return user_factory(email="ocr@example.com")


@pytest.mark.django_db
class TestOCRTaskModel:
    def test_starts_pending(self, user):
        t = OCRTask.objects.create(user=user)
        assert t.status == OCRTask.STATUS_PENDING
        assert t.current_page == 0
        assert t.total_pages == 0
        assert t.result_data is None
        assert t.error_message == ""
        assert t.started_at is None
        assert t.finished_at is None

    def test_progress_pct_zero_when_no_total(self, user):
        t = OCRTask.objects.create(user=user)
        assert t.progress_pct == 0

    def test_progress_pct_computed_from_pages(self, user):
        t = OCRTask.objects.create(user=user, current_page=42, total_pages=100)
        assert t.progress_pct == 42

    def test_progress_pct_clamped_to_100(self, user):
        # Defensive: if current somehow exceeds total
        t = OCRTask.objects.create(user=user, current_page=200, total_pages=100)
        assert t.progress_pct == 100

    def test_is_done_for_completed(self, user):
        t = OCRTask.objects.create(user=user, status=OCRTask.STATUS_COMPLETED)
        assert t.is_done is True

    def test_is_done_for_failed(self, user):
        t = OCRTask.objects.create(user=user, status=OCRTask.STATUS_FAILED)
        assert t.is_done is True

    def test_is_done_false_for_pending_processing(self, user):
        t = OCRTask.objects.create(user=user)
        assert t.is_done is False
        t.status = OCRTask.STATUS_PROCESSING
        assert t.is_done is False

    def test_stores_result_data_json(self, user):
        data = {"hymn_book": {"name": "X", "owner": "Y", "hymns": []}}
        t = OCRTask.objects.create(
            user=user,
            status=OCRTask.STATUS_COMPLETED,
            result_data=data,
            finished_at=timezone.now(),
        )
        t.refresh_from_db()
        assert t.result_data == data

    def test_user_relationship(self, user):
        OCRTask.objects.create(user=user)
        assert user.ocr_tasks.count() == 1
