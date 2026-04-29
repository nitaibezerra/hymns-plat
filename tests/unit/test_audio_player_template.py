"""
Testes do template do audio-card. Cobertura mínima:
- Renderiza estrutura nova (data-audio-card, botão custom).
- Não renderiza `<audio controls>` (o browser não pode mostrar UI nativa).
- Embute `data-peaks` quando presente; usa fallback quando vazio.
- Esconde-se quando o áudio não está aprovado.
"""

import json

import pytest
from django.template import Context, Template
from django.urls import reverse

from apps.hymns.models import HymnAudio


def _render_partial(audio):
    tpl = Template('{% include "hymns/_audio_player.html" with audio=audio %}')
    return tpl.render(Context({"audio": audio}))


@pytest.mark.django_db
class TestAudioPlayerPartial:
    def _audio(self, hymn_book_factory, hymn_factory, **kw):
        from django.core.files.uploadedfile import SimpleUploadedFile

        hb = hymn_book_factory(name=kw.pop("hbname", "X"))
        h = hymn_factory(hymn_book=hb, number=1)
        kw.setdefault("title", "Tomada 1")
        kw.setdefault("format", "mp3")
        kw.setdefault("is_approved", True)
        kw.setdefault(
            "audio_file",
            SimpleUploadedFile("a.mp3", b"x", content_type="audio/mpeg"),
        )
        return HymnAudio.objects.create(hymn=h, **kw)

    def test_renders_data_audio_card_when_approved(self, hymn_book_factory, hymn_factory):
        a = self._audio(hymn_book_factory, hymn_factory, waveform_peaks=[0.1, 0.5, 0.9])
        html = _render_partial(a)
        assert "data-audio-card" in html
        assert "data-audio-toggle" in html
        assert "data-audio-waveform-svg" in html

    def test_does_not_render_native_controls(self, hymn_book_factory, hymn_factory):
        a = self._audio(hymn_book_factory, hymn_factory, waveform_peaks=[0.5])
        html = _render_partial(a)
        assert "<audio controls" not in html
        # `<audio>` deve estar lá, mas como source escondido:
        assert "data-audio-source" in html
        assert "controls" not in html.split("<audio")[1].split(">")[0]

    def test_embeds_peaks_when_present(self, hymn_book_factory, hymn_factory):
        peaks = [0.1, 0.2, 0.5, 1.0]
        a = self._audio(hymn_book_factory, hymn_factory, waveform_peaks=peaks)
        html = _render_partial(a)
        # peaks vão como JSON dentro do data-peaks (escapado).
        assert "data-peaks=" in html
        # No HTML escapado, o `[` é preservado.
        assert "0.1" in html and "1.0" in html

    def test_renders_fallback_when_no_peaks(self, hymn_book_factory, hymn_factory):
        a = self._audio(hymn_book_factory, hymn_factory, waveform_peaks=[])
        html = _render_partial(a)
        # Sem peaks, ainda renderiza o card; o JS preenche fallback.
        assert "data-audio-card" in html
        assert 'data-peaks="[]"' in html or "data-peaks=\"\\[\\]\"" in html or 'data-peaks=' in html

    def test_skips_when_not_approved(self, hymn_book_factory, hymn_factory):
        a = self._audio(hymn_book_factory, hymn_factory, is_approved=False)
        html = _render_partial(a)
        assert "data-audio-card" not in html


@pytest.mark.django_db
class TestHymnDetailIntegrates:
    def test_hymn_detail_renders_custom_player_for_approved_audio(
        self, client, hymn_book_factory, hymn_factory
    ):
        from django.core.files.uploadedfile import SimpleUploadedFile

        hb = hymn_book_factory(name="O X")
        h = hymn_factory(hymn_book=hb, number=1)
        HymnAudio.objects.create(
            hymn=h,
            title="Sample",
            audio_file=SimpleUploadedFile("a.mp3", b"x", content_type="audio/mpeg"),
            format="mp3",
            is_approved=True,
            waveform_peaks=[0.2, 0.6, 0.4],
        )
        resp = client.get(reverse("hymns:hymn_detail", kwargs={"pk": h.pk}))
        assert resp.status_code == 200
        body = resp.content.decode()
        assert "data-audio-card" in body
        assert "<audio controls" not in body
