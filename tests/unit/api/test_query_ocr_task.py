"""
Marco 5.A½ · Tarefa B7 — cobertura de `Query.ocrTask`.

A query foi mergeada no Marco 5.A sem NENHUM teste (nem happy-path). Aqui
fixamos o contrato: dono da task ou editor/admin veem; anônimo, terceiro e id
inexistente recebem `None` (a query é nullable de propósito — não vaza a
existência de uma task alheia com mensagem de permissão).
"""

from __future__ import annotations

import uuid

import pytest

from apps.hymns.models import OCRTask

from ._helpers import gql

pytestmark = pytest.mark.django_db


OCR_TASK = """
query($id: ID!) {
  ocrTask(id: $id) {
    id
    status
    currentPage
    totalPages
    progressPct
    pdfFilename
    errorMessage
    resultData
  }
}
"""


@pytest.fixture
def ocr_task(user_factory):
    owner = user_factory(email="uploader@example.com")
    task = OCRTask.objects.create(
        user=owner,
        status=OCRTask.STATUS_PROCESSING,
        current_page=3,
        total_pages=12,
        pdf_filename="o-justiceiro.pdf",
        result_data={"hymns": []},
    )
    return task


def test_ocr_task_returns_snapshot_for_its_uploader(client, ocr_task):
    client.force_login(ocr_task.user)
    data = gql(client, OCR_TASK, variables={"id": str(ocr_task.pk)})
    assert "errors" not in data, data
    row = data["data"]["ocrTask"]
    assert row["id"] == str(ocr_task.pk)
    assert row["status"] == OCRTask.STATUS_PROCESSING
    assert row["currentPage"] == 3
    assert row["totalPages"] == 12
    assert row["progressPct"] == 25
    assert row["pdfFilename"] == "o-justiceiro.pdf"
    assert row["errorMessage"] == ""
    assert row["resultData"] == {"hymns": []}


def test_ocr_task_visible_to_editor(editor_client, ocr_task):
    """Editor precisa acompanhar OCR de terceiros pra destravar importação."""
    data = gql(editor_client, OCR_TASK, variables={"id": str(ocr_task.pk)})
    assert "errors" not in data, data
    assert data["data"]["ocrTask"]["id"] == str(ocr_task.pk)


def test_ocr_task_visible_to_superuser(admin_client, ocr_task):
    data = gql(admin_client, OCR_TASK, variables={"id": str(ocr_task.pk)})
    assert "errors" not in data, data
    assert data["data"]["ocrTask"]["id"] == str(ocr_task.pk)


def test_ocr_task_hidden_from_other_authenticated_user(authenticated_client, ocr_task):
    """Terceiro sem papel editorial não vê a task de outro uploader."""
    data = gql(authenticated_client, OCR_TASK, variables={"id": str(ocr_task.pk)})
    assert "errors" not in data, data
    assert data["data"]["ocrTask"] is None


def test_ocr_task_hidden_from_anonymous(client, ocr_task):
    data = gql(client, OCR_TASK, variables={"id": str(ocr_task.pk)})
    assert "errors" not in data, data
    assert data["data"]["ocrTask"] is None


def test_ocr_task_nonexistent_id_returns_null(admin_client):
    data = gql(admin_client, OCR_TASK, variables={"id": str(uuid.uuid4())})
    assert "errors" not in data, data
    assert data["data"]["ocrTask"] is None


def test_ocr_task_progress_pct_zero_when_total_pages_unknown(client, user_factory):
    owner = user_factory(email="uploader2@example.com")
    task = OCRTask.objects.create(user=owner, status=OCRTask.STATUS_PENDING)
    client.force_login(owner)

    data = gql(client, OCR_TASK, variables={"id": str(task.pk)})
    assert "errors" not in data, data
    assert data["data"]["ocrTask"]["progressPct"] == 0
