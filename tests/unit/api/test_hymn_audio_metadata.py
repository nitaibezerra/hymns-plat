"""
Marco 5.A½ · Tarefa B5 — metadados de HymnAudioType.

A tela de áudios pendentes (5.D) recebe `[HymnAudioType]` e não tinha COMO
saber a que hino/hinário cada áudio pertence — nem mostrar créditos, fonte,
formato, tamanho, data de gravação ou quem revisou.
"""

from __future__ import annotations

import datetime

import pytest
from django.utils import timezone

from apps.hymns.models import HymnAudio

from ._helpers import gql

pytestmark = pytest.mark.django_db


PENDING_AUDIOS = """
{
  pendingAudios {
    credits
    source
    allowDownload
    format
    fileSize
    recordedAt
    createdAt
    reviewedAt
    reviewedBy { username }
    hymn { number title hymnBook { slug } }
  }
}
"""


def test_pending_audio_carries_hymn_and_hymnbook(editor_client, hymn_book_factory, hymn_factory):
    """O furo que motivou a tarefa: sem `hymn` a tela 5.D não identifica o áudio."""
    book = hymn_book_factory(name="O Cruzeiro", slug="o-cruzeiro")
    hymn = hymn_factory(hymn_book=book, number=12, title="Lua Branca")
    HymnAudio.objects.create(hymn=hymn, audio_file="a.mp3", is_approved=False)

    data = gql(editor_client, PENDING_AUDIOS)
    assert "errors" not in data, data
    row = data["data"]["pendingAudios"][0]
    assert row["hymn"] == {"number": 12, "title": "Lua Branca", "hymnBook": {"slug": "o-cruzeiro"}}


def test_pending_audio_exposes_upload_metadata(editor_client, hymn_book_factory, hymn_factory):
    book = hymn_book_factory(name="A", slug="a")
    hymn = hymn_factory(hymn_book=book)
    HymnAudio.objects.create(
        hymn=hymn,
        audio_file="a.flac",
        is_approved=False,
        credits="Cantado por Maria",
        source="Gravação de 1998",
        allow_download=False,
        format="FLAC",
        file_size=204800,
        recorded_at=datetime.date(1998, 3, 21),
    )

    data = gql(editor_client, PENDING_AUDIOS)
    assert "errors" not in data, data
    row = data["data"]["pendingAudios"][0]
    assert row["credits"] == "Cantado por Maria"
    assert row["source"] == "Gravação de 1998"
    assert row["allowDownload"] is False
    assert row["format"] == "FLAC"
    assert row["fileSize"] == 204800
    assert row["recordedAt"] == "1998-03-21"
    assert row["createdAt"] is not None


def test_pending_audio_review_metadata_null_before_review(editor_client, hymn_book_factory, hymn_factory):
    book = hymn_book_factory(name="A", slug="a")
    hymn = hymn_factory(hymn_book=book)
    HymnAudio.objects.create(hymn=hymn, audio_file="a.mp3", is_approved=False)

    data = gql(editor_client, PENDING_AUDIOS)
    assert "errors" not in data, data
    row = data["data"]["pendingAudios"][0]
    assert row["reviewedAt"] is None
    assert row["reviewedBy"] is None
    assert row["fileSize"] is None
    assert row["recordedAt"] is None


def test_pending_audio_exposes_reviewer(editor_client, hymn_book_factory, hymn_factory):
    book = hymn_book_factory(name="A", slug="a")
    hymn = hymn_factory(hymn_book=book)
    reviewed_at = timezone.now()
    HymnAudio.objects.create(
        hymn=hymn,
        audio_file="a.mp3",
        is_approved=False,
        reviewed_by=editor_client.user,
        reviewed_at=reviewed_at,
    )

    data = gql(editor_client, PENDING_AUDIOS)
    assert "errors" not in data, data
    row = data["data"]["pendingAudios"][0]
    assert row["reviewedBy"] == {"username": editor_client.user.username}
    assert row["reviewedAt"].startswith(reviewed_at.date().isoformat())
