"""
Marco 4.A · Ciclo 4A.4.

`HymnAudioType` precisa expor os campos usados pelo player do SPA:
`url` (FileField.url), `waveformPeaks`, `durationSeconds`, `uploadedBy`.
"""

from __future__ import annotations

import pytest

from ._helpers import gql

pytestmark = pytest.mark.django_db


def test_audio_exposes_waveform_url_duration_uploader(client, user_factory, hymn_book_factory, hymn_factory):
    from apps.hymns.models import HymnAudio

    uploader = user_factory(email="up@example.com")
    hb = hymn_book_factory(name="O Cruzeiro", slug="cruzeiro", is_published=True)
    h = hymn_factory(hymn_book=hb, number=1, title="Lua Branca")
    HymnAudio.objects.create(
        hymn=h,
        audio_file="hymns/audio/2026/05/sample.mp3",
        is_approved=True,
        waveform_peaks=[10, 20, 30, 40, 50],
        duration=125,
        uploaded_by=uploader,
    )

    data = gql(
        client,
        """
        {
          hymn(pk: "%s") {
            audios {
              id
              url
              waveformPeaks
              durationSeconds
              uploadedBy { username }
            }
          }
        }
        """
        % h.pk,
    )
    assert "errors" not in data, data
    audios = data["data"]["hymn"]["audios"]
    assert len(audios) == 1
    audio = audios[0]
    assert audio["waveformPeaks"] == [10, 20, 30, 40, 50]
    assert audio["url"].endswith("hymns/audio/2026/05/sample.mp3"), audio["url"]
    assert audio["durationSeconds"] == pytest.approx(125.0)
    assert audio["uploadedBy"] == {"username": "up"}
