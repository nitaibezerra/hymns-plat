"""
Testes do serviço de geração de waveform e do signal que popula
`HymnAudio.waveform_peaks` ao criar um áudio.
"""

from pathlib import Path
from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.hymns.models import HymnAudio
from apps.hymns.services.audio import (
    compute_waveform_peaks,
    extract_duration_seconds,
)

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "audio" / "silence-2s.mp3"


def _audio_upload(name="a.mp3"):
    return SimpleUploadedFile(name, FIXTURE.read_bytes(), content_type="audio/mpeg")


@pytest.mark.skipif(not FIXTURE.exists(), reason="fixture missing")
class TestExtractDuration:
    def test_returns_int_for_valid_mp3(self):
        d = extract_duration_seconds(FIXTURE)
        assert isinstance(d, int)
        assert 1 <= d <= 3  # arquivo é de 2s

    def test_returns_none_for_invalid_file(self, tmp_path):
        bad = tmp_path / "broken.mp3"
        bad.write_bytes(b"not actually mp3")
        assert extract_duration_seconds(bad) is None

    def test_returns_none_for_missing_file(self, tmp_path):
        assert extract_duration_seconds(tmp_path / "nope.mp3") is None


@pytest.mark.skipif(not FIXTURE.exists(), reason="fixture missing")
class TestComputeWaveformPeaks:
    def test_returns_normalized_floats(self):
        peaks = compute_waveform_peaks(FIXTURE, num_samples=80)
        assert len(peaks) == 80
        for p in peaks:
            assert 0.0 <= p <= 1.0

    def test_max_peak_is_one(self):
        peaks = compute_waveform_peaks(FIXTURE, num_samples=80)
        # Sine wave constante deve produzir picos uniformes próximos do max.
        assert max(peaks) == pytest.approx(1.0, abs=0.01)

    def test_returns_empty_on_invalid_file(self, tmp_path):
        bad = tmp_path / "broken.mp3"
        bad.write_bytes(b"not actually mp3")
        assert compute_waveform_peaks(bad) == []

    def test_returns_empty_for_missing_file(self, tmp_path):
        assert compute_waveform_peaks(tmp_path / "nope.mp3") == []


@pytest.mark.django_db
@pytest.mark.skipif(not FIXTURE.exists(), reason="fixture missing")
class TestWaveformSignal:
    def test_post_save_populates_peaks_synchronously_when_patched(
        self, hymn_book_factory, hymn_factory
    ):
        """
        Em produção a geração ocorre em thread daemon (não bloqueia request).
        Aqui patcheamos `_run_in_thread` para rodar inline e validar que o peak
        chega no DB.
        """
        from apps.hymns.services import audio as audio_service

        hb = hymn_book_factory(name="X")
        h = hymn_factory(hymn_book=hb, number=1)

        with patch.object(audio_service, "_run_in_thread", lambda fn, *a, **kw: fn(*a, **kw)):
            audio = HymnAudio.objects.create(
                hymn=h,
                audio_file=_audio_upload("test.mp3"),
                title="Test",
                format="mp3",
                is_approved=True,
            )

        audio.refresh_from_db()
        assert audio.waveform_peaks
        assert len(audio.waveform_peaks) >= 60
        assert audio.duration is not None and audio.duration >= 1

    def test_post_save_skips_when_peaks_already_set(
        self, hymn_book_factory, hymn_factory
    ):
        hb = hymn_book_factory(name="X")
        h = hymn_factory(hymn_book=hb, number=1)
        audio = HymnAudio.objects.create(
            hymn=h,
            audio_file=_audio_upload(),
            title="Test",
            format="mp3",
            waveform_peaks=[0.5] * 10,
        )
        called = []
        from apps.hymns.services import audio as audio_service

        with patch.object(
            audio_service,
            "_run_in_thread",
            lambda fn, *a, **kw: called.append(1),
        ):
            audio.title = "Updated"
            audio.save()

        assert called == []  # signal não disparou geração de novo

    def test_loaddata_does_not_trigger_generation(self, hymn_book_factory, hymn_factory):
        from django.core.serializers.python import Deserializer

        hb = hymn_book_factory(name="X")
        h = hymn_factory(hymn_book=hb, number=1)

        called = []
        from apps.hymns.services import audio as audio_service

        with patch.object(
            audio_service,
            "_run_in_thread",
            lambda fn, *a, **kw: called.append(1),
        ):
            for obj in Deserializer(
                [
                    {
                        "model": "hymns.hymnaudio",
                        "pk": "00000000-0000-0000-0000-000000000099",
                        "fields": {
                            "hymn": str(h.pk),
                            "audio_file": "x.mp3",
                            "title": "raw",
                            "is_approved": False,
                            "allow_download": True,
                            "format": "mp3",
                            "waveform_peaks": [],
                            "created_at": "2026-04-29T00:00:00Z",
                            "updated_at": "2026-04-29T00:00:00Z",
                        },
                    }
                ]
            ):
                obj.save()

        assert called == []


@pytest.mark.django_db
@pytest.mark.skipif(not FIXTURE.exists(), reason="fixture missing")
class TestBackfillCommand:
    def test_processes_only_audios_without_peaks(
        self, hymn_book_factory, hymn_factory, monkeypatch
    ):
        from django.core.management import call_command

        from apps.hymns.services import audio as audio_service

        # Garante que o signal não vai gerar peaks no setup.
        monkeypatch.setattr(audio_service, "_run_in_thread", lambda fn, *a, **kw: None)

        hb = hymn_book_factory(name="X")
        h1 = hymn_factory(hymn_book=hb, number=1)
        h2 = hymn_factory(hymn_book=hb, number=2, title="t2")
        without = HymnAudio.objects.create(
            hymn=h1, audio_file=_audio_upload("a.mp3"), title="A", format="mp3"
        )
        with_existing = HymnAudio.objects.create(
            hymn=h2,
            audio_file=_audio_upload("b.mp3"),
            title="B",
            format="mp3",
            waveform_peaks=[0.1, 0.2, 0.3],
        )

        call_command("backfill_audio_waveforms")

        without.refresh_from_db()
        with_existing.refresh_from_db()
        assert without.waveform_peaks  # foi populado
        assert with_existing.waveform_peaks == [0.1, 0.2, 0.3]  # intacto
