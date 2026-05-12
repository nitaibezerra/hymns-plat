"""Player MVP — header do hinário ganha botão "Tocar hinário" e o índice
ganha ícones ▶/⊘ por linha.

- Botão sempre visível no header com `data-player-start="<slug>"`.
- Disabled (atributo + opacity) quando o hinário tem 0 áudios aprovados.
- No índice (modo `?mode=indice` default), cada linha tem `[data-player-play-hymn]`
  apontando pra slug+número se houver áudio aprovado, ou um glifo ⊘ desabilitado
  caso contrário.
"""

from __future__ import annotations

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse


def _audio():
    return SimpleUploadedFile("t.mp3", b"\xff\xfb\x90\x00" + b"\x00" * 100, content_type="audio/mpeg")


@pytest.mark.django_db
class TestHymnbookHeaderPlayButton:
    def test_button_present(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="PB Test")
        hymn_factory(hymn_book=hb, number=1)
        url = reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug})
        body = client.get(url).content.decode()
        assert f'data-player-start="{hb.slug}"' in body

    def test_button_label_idle(self, client, hymn_book_factory, hymn_factory):
        from apps.hymns.models import HymnAudio

        hb = hymn_book_factory(name="PB Idle")
        h = hymn_factory(hymn_book=hb, number=1)
        HymnAudio.objects.create(hymn=h, audio_file=_audio(), is_approved=True)
        body = client.get(reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug})).content.decode()
        assert "Tocar hinário" in body

    def test_button_disabled_when_no_audio(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="PB Empty")
        hymn_factory(hymn_book=hb, number=1)
        body = client.get(reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug})).content.decode()
        # Procurar a tag do botão e seu atributo disabled.
        idx = body.find("data-player-start=")
        snippet = body[idx : idx + 400]
        assert "disabled" in snippet


@pytest.mark.django_db
class TestIndiceRowPlayIcons:
    """Sumário do hinário (detail page) — botão ▶ por linha quando há áudio."""

    def test_row_with_audio_has_play_icon(self, client, hymn_book_factory, hymn_factory):
        from apps.hymns.models import HymnAudio

        hb = hymn_book_factory(name="IR Audio")
        h = hymn_factory(hymn_book=hb, number=1)
        HymnAudio.objects.create(hymn=h, audio_file=_audio(), is_approved=True)
        body = client.get(reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug})).content.decode()
        assert "data-player-play-hymn" in body

    def test_row_without_audio_has_no_play_icon(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="IR Silent")
        hymn_factory(hymn_book=hb, number=1)
        body = client.get(reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug})).content.decode()
        assert "data-player-play-hymn" not in body
