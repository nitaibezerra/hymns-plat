"""
Marco 5.A — Ciclos 5A.10 a 5A.14.

Mutations sobre HymnAudio: upload (multipart), aprovar/rejeitar/revisar/deletar.
`uploadAudio` é a única que precisa do multipart spec do GraphQL — as outras
usam JSON normal. O signal `_generate_waveform_for_audio` é o que dispara
extração de waveform em background; aqui só verificamos que o áudio fica
gravado em DB.
"""

from __future__ import annotations

import json

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.hymns.models import HymnAudio

from ._helpers import gql

pytestmark = pytest.mark.django_db


# ---------- Ciclo 5A.10 — uploadAudio (multipart) ----------

UPLOAD_MUTATION = """
mutation($hymnPk: ID!, $file: Upload!, $title: String) {
  uploadAudio(hymnPk: $hymnPk, file: $file, title: $title) {
    __typename
    ... on HymnAudioType { id }
    ... on PermissionDeniedError { message }
    ... on NotFoundError { message }
    ... on ValidationError { message field }
  }
}
"""


def _post_upload(client, hymn_pk: str, file: SimpleUploadedFile, *, title: str | None = None):
    """Helper para POST multipart conforme `graphql-multipart-request-spec`.

    `operations` é o JSON da operação com placeholder `null` no `file`;
    `map` indica que o arquivo no field "0" mapeia para `variables.file`.
    """
    variables = {"hymnPk": hymn_pk, "file": None}
    if title is not None:
        variables["title"] = title
    operations = json.dumps({"query": UPLOAD_MUTATION, "variables": variables})
    map_ = json.dumps({"0": ["variables.file"]})
    response = client.post(
        "/graphql/",
        data={"operations": operations, "map": map_, "0": file},
    )
    assert response.status_code == 200, response.content
    return response.json()


def _mp3_file(name="audio.mp3", size=1024):
    """SimpleUploadedFile com payload trivial — não precisa ser MP3 válido pra
    passar pelo HymnAudioUploadForm (que valida extensão + tamanho)."""
    return SimpleUploadedFile(name, b"\x00" * size, content_type="audio/mpeg")


def test_upload_audio_authenticated_succeeds(authenticated_client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory()
    h = hymn_factory(hymn_book=hb)
    file = _mp3_file()

    data = _post_upload(authenticated_client, str(h.pk), file, title="Minha gravação")
    assert "errors" not in data, data
    result = data["data"]["uploadAudio"]
    assert result["__typename"] == "HymnAudioType"
    audio_id = result["id"]
    audio = HymnAudio.objects.get(pk=audio_id)
    assert audio.hymn_id == h.pk
    assert audio.uploaded_by_id == authenticated_client.user.pk
    assert audio.title == "Minha gravação"


def test_upload_audio_validates_size_25mb(authenticated_client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory()
    h = hymn_factory(hymn_book=hb)
    # 25MB + 1 byte
    big_file = SimpleUploadedFile("big.mp3", b"\x00" * (25 * 1024 * 1024 + 1), content_type="audio/mpeg")

    data = _post_upload(authenticated_client, str(h.pk), big_file)
    assert "errors" not in data, data
    result = data["data"]["uploadAudio"]
    assert result["__typename"] == "ValidationError"
    assert result["field"] == "audio_file"


def test_upload_audio_validates_format(authenticated_client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory()
    h = hymn_factory(hymn_book=hb)
    bad_file = SimpleUploadedFile("not_audio.txt", b"hello", content_type="text/plain")

    data = _post_upload(authenticated_client, str(h.pk), bad_file)
    assert "errors" not in data, data
    result = data["data"]["uploadAudio"]
    assert result["__typename"] == "ValidationError"
    assert result["field"] == "audio_file"


def test_upload_audio_anon_blocked(client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory()
    h = hymn_factory(hymn_book=hb)
    data = _post_upload(client, str(h.pk), _mp3_file())
    assert "errors" not in data, data
    assert data["data"]["uploadAudio"]["__typename"] == "PermissionDeniedError"
    assert not HymnAudio.objects.filter(hymn=h).exists()


# ---------- Ciclo 5A.11 — approveAudio ----------

APPROVE_MUTATION = """
mutation($pk: ID!) {
  approveAudio(pk: $pk) {
    __typename
    ... on HymnAudioType { id }
    ... on PermissionDeniedError { message }
    ... on NotFoundError { message }
  }
}
"""


def _make_audio(hymn, *, is_approved=False, uploaded_by=None):
    return HymnAudio.objects.create(hymn=hymn, audio_file="x.mp3", is_approved=is_approved, uploaded_by=uploaded_by)


def test_approve_audio_editor_succeeds(editor_client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory()
    h = hymn_factory(hymn_book=hb)
    a = _make_audio(h, is_approved=False)

    data = gql(editor_client, APPROVE_MUTATION, variables={"pk": str(a.pk)})
    assert "errors" not in data, data
    assert data["data"]["approveAudio"]["__typename"] == "HymnAudioType"
    a.refresh_from_db()
    assert a.is_approved is True


def test_approve_audio_non_editor_blocked(authenticated_client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory()
    h = hymn_factory(hymn_book=hb)
    a = _make_audio(h, is_approved=False)
    data = gql(authenticated_client, APPROVE_MUTATION, variables={"pk": str(a.pk)})
    assert "errors" not in data, data
    assert data["data"]["approveAudio"]["__typename"] == "PermissionDeniedError"
    a.refresh_from_db()
    assert a.is_approved is False


# ---------- Ciclo 5A.12 — rejectAudio ----------

REJECT_MUTATION = """
mutation($pk: ID!) {
  rejectAudio(pk: $pk) {
    __typename
    ... on DeleteResult { ok deletedId }
    ... on PermissionDeniedError { message }
    ... on NotFoundError { message }
  }
}
"""


def test_reject_audio_editor_succeeds_and_deletes(editor_client, hymn_book_factory, hymn_factory):
    """Paridade com editor_reject_audio: rejeitar = deletar o áudio."""
    hb = hymn_book_factory()
    h = hymn_factory(hymn_book=hb)
    a = _make_audio(h, is_approved=False)
    pk = str(a.pk)

    data = gql(editor_client, REJECT_MUTATION, variables={"pk": pk})
    assert "errors" not in data, data
    result = data["data"]["rejectAudio"]
    assert result["__typename"] == "DeleteResult"
    assert result["ok"] is True
    assert result["deletedId"] == pk
    assert not HymnAudio.objects.filter(pk=pk).exists()


def test_reject_audio_non_editor_blocked(authenticated_client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory()
    h = hymn_factory(hymn_book=hb)
    a = _make_audio(h, is_approved=False)

    data = gql(authenticated_client, REJECT_MUTATION, variables={"pk": str(a.pk)})
    assert "errors" not in data, data
    assert data["data"]["rejectAudio"]["__typename"] == "PermissionDeniedError"
    assert HymnAudio.objects.filter(pk=a.pk).exists()


# ---------- Ciclo 5A.13 — reviewAudio ----------

REVIEW_MUTATION = """
mutation($pk: ID!, $input: AudioReviewInput!) {
  reviewAudio(pk: $pk, input: $input) {
    __typename
    ... on HymnAudioType { id isApproved isMatch qualityRating qualityObservations mismatchReason }
    ... on PermissionDeniedError { message }
    ... on NotFoundError { message }
  }
}
"""


def test_review_audio_match_sets_is_approved_true(editor_client, hymn_book_factory, hymn_factory):
    """is_match=True com quality_rating preenchido: áudio fica aprovado."""
    hb = hymn_book_factory()
    h = hymn_factory(hymn_book=hb)
    a = _make_audio(h, is_approved=False)

    data = gql(
        editor_client,
        REVIEW_MUTATION,
        variables={
            "pk": str(a.pk),
            "input": {
                "isMatch": True,
                "qualityRating": 4,
                "qualityObservations": ["Excelente captação"],
            },
        },
    )
    assert "errors" not in data, data
    result = data["data"]["reviewAudio"]
    assert result["__typename"] == "HymnAudioType"
    assert result["isMatch"] is True
    assert result["qualityRating"] == 4
    a.refresh_from_db()
    assert a.is_match is True
    assert a.quality_rating == 4
    assert "Excelente captação" in a.quality_observations
    assert a.reviewed_by_id == editor_client.user.pk


def test_review_audio_mismatch_forces_unapproval(editor_client, hymn_book_factory, hymn_factory):
    """is_match=False: save() do model força is_approved=False e zera quality."""
    hb = hymn_book_factory()
    h = hymn_factory(hymn_book=hb)
    a = _make_audio(h, is_approved=True)
    a.quality_rating = 5
    a.save()

    data = gql(
        editor_client,
        REVIEW_MUTATION,
        variables={
            "pk": str(a.pk),
            "input": {"isMatch": False, "mismatchReason": "other_hymn"},
        },
    )
    assert "errors" not in data, data
    result = data["data"]["reviewAudio"]
    assert result["isApproved"] is False
    assert result["mismatchReason"] == "other_hymn"
    assert result["qualityRating"] is None  # zerado pelo save()
    a.refresh_from_db()
    assert a.is_approved is False
    assert a.mismatch_reason == "other_hymn"


def test_review_audio_non_editor_blocked(authenticated_client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory()
    h = hymn_factory(hymn_book=hb)
    a = _make_audio(h)
    data = gql(
        authenticated_client,
        REVIEW_MUTATION,
        variables={"pk": str(a.pk), "input": {"isMatch": True}},
    )
    assert "errors" not in data, data
    assert data["data"]["reviewAudio"]["__typename"] == "PermissionDeniedError"


# ---------- Ciclo 5A.14 — deleteAudio ----------

DELETE_AUDIO_MUTATION = """
mutation($pk: ID!) {
  deleteAudio(pk: $pk) {
    __typename
    ... on DeleteResult { ok deletedId }
    ... on PermissionDeniedError { message }
    ... on NotFoundError { message }
  }
}
"""


def test_delete_audio_editor_succeeds(editor_client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory()
    h = hymn_factory(hymn_book=hb)
    a = _make_audio(h)
    pk = str(a.pk)

    data = gql(editor_client, DELETE_AUDIO_MUTATION, variables={"pk": pk})
    assert "errors" not in data, data
    assert data["data"]["deleteAudio"]["__typename"] == "DeleteResult"
    assert not HymnAudio.objects.filter(pk=pk).exists()


def test_delete_audio_uploader_can_delete_own(client, user_factory, hymn_book_factory, hymn_factory):
    """Uploader pode deletar seu próprio áudio (mesmo sem ser editor)."""
    hb = hymn_book_factory()
    h = hymn_factory(hymn_book=hb)
    uploader = user_factory(email="uploader@x.com")
    a = _make_audio(h, uploaded_by=uploader)

    client.force_login(uploader)
    data = gql(client, DELETE_AUDIO_MUTATION, variables={"pk": str(a.pk)})
    assert "errors" not in data, data
    assert data["data"]["deleteAudio"]["__typename"] == "DeleteResult"


def test_delete_audio_other_user_blocked(client, user_factory, hymn_book_factory, hymn_factory):
    """Outro usuário (não-editor, não-uploader) é bloqueado."""
    hb = hymn_book_factory()
    h = hymn_factory(hymn_book=hb)
    uploader = user_factory(email="up@x.com")
    other = user_factory(email="other@x.com")
    a = _make_audio(h, uploaded_by=uploader)

    client.force_login(other)
    data = gql(client, DELETE_AUDIO_MUTATION, variables={"pk": str(a.pk)})
    assert "errors" not in data, data
    assert data["data"]["deleteAudio"]["__typename"] == "PermissionDeniedError"
    assert HymnAudio.objects.filter(pk=a.pk).exists()


_ = gql  # silenciar import não-usado (mantemos pra outros ciclos do arquivo)
