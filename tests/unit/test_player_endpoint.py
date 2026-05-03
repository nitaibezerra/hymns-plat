"""Player MVP — endpoint que serve a fila de hinos do hinário para o player.

Forma do JSON (estável, congelada por estes testes):
    {
      "book": {"slug": str, "name": str, "owner": str},
      "hymns": [
        {"n": int, "title": str, "style": str,
         "hasAudio": bool, "audioUrl": str|null, "duration": int|null}, ...
      ]
    }

`hymns` lista TODOS os hinos do livro em ordem `number` ASC. JS do player
filtra `hasAudio: true` para construir a queue de reprodução; o resto é usado
pela UI do índice (ícones ▶ / ⊘). `audioUrl` aponta para a primeira gravação
aprovada (`is_approved=True`), ordenada por `created_at`.
"""

from __future__ import annotations

import json

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse


def _make_audio_file():
    return SimpleUploadedFile("test.mp3", b"\xff\xfb\x90\x00" + b"\x00" * 100, content_type="audio/mpeg")


@pytest.mark.django_db
class TestQueueEndpoint:
    def test_returns_200_for_published(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="QTest Pub")
        hymn_factory(hymn_book=hb, number=1)
        url = reverse("hymns:hymnbook_queue_json", kwargs={"slug": hb.slug})
        resp = client.get(url)
        assert resp.status_code == 200

    def test_404_unpublished_anonymous(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="QTest Priv", is_published=False)
        hymn_factory(hymn_book=hb, number=1)
        url = reverse("hymns:hymnbook_queue_json", kwargs={"slug": hb.slug})
        resp = client.get(url)
        assert resp.status_code == 404

    def test_response_shape(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="QTest Shape", owner_name="Mestre X")
        hymn_factory(hymn_book=hb, number=1, title="A", style="Marcha")
        url = reverse("hymns:hymnbook_queue_json", kwargs={"slug": hb.slug})
        body = json.loads(client.get(url).content)
        assert "book" in body
        assert body["book"]["slug"] == hb.slug
        assert body["book"]["name"] == "QTest Shape"
        assert body["book"]["owner"] == "Mestre X"
        assert "hymns" in body
        h = body["hymns"][0]
        assert set(h.keys()) >= {"n", "title", "style", "hasAudio", "audioUrl", "duration"}

    def test_hymns_ordered_by_number(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="QTest Order")
        hymn_factory(hymn_book=hb, number=3, title="C")
        hymn_factory(hymn_book=hb, number=1, title="A")
        hymn_factory(hymn_book=hb, number=2, title="B")
        url = reverse("hymns:hymnbook_queue_json", kwargs={"slug": hb.slug})
        body = json.loads(client.get(url).content)
        nums = [h["n"] for h in body["hymns"]]
        assert nums == [1, 2, 3]

    def test_only_approved_audios_count_as_has_audio(self, client, hymn_book_factory, hymn_factory):
        from apps.hymns.models import HymnAudio

        hb = hymn_book_factory(name="QTest Approval")
        h = hymn_factory(hymn_book=hb, number=1, title="With pending audio")
        # áudio NÃO aprovado
        HymnAudio.objects.create(hymn=h, audio_file=_make_audio_file(), is_approved=False, duration=120)
        url = reverse("hymns:hymnbook_queue_json", kwargs={"slug": hb.slug})
        body = json.loads(client.get(url).content)
        assert body["hymns"][0]["hasAudio"] is False
        assert body["hymns"][0]["audioUrl"] is None

    def test_approved_audio_yields_has_audio_true_and_url(self, client, hymn_book_factory, hymn_factory):
        from apps.hymns.models import HymnAudio

        hb = hymn_book_factory(name="QTest Approved")
        h = hymn_factory(hymn_book=hb, number=1, title="With approved audio")
        HymnAudio.objects.create(hymn=h, audio_file=_make_audio_file(), is_approved=True, duration=240)
        url = reverse("hymns:hymnbook_queue_json", kwargs={"slug": hb.slug})
        body = json.loads(client.get(url).content)
        first = body["hymns"][0]
        assert first["hasAudio"] is True
        assert first["audioUrl"]
        assert first["duration"] == 240

    def test_picks_oldest_approved_audio_first(self, client, hymn_book_factory, hymn_factory):
        """Sem flag is_primary, o player usa a primeira gravação aprovada por
        created_at ASC."""
        from django.utils import timezone

        from apps.hymns.models import HymnAudio

        hb = hymn_book_factory(name="QTest Multiple")
        h = hymn_factory(hymn_book=hb, number=1)
        a_old = HymnAudio.objects.create(
            hymn=h,
            audio_file=_make_audio_file(),
            is_approved=True,
            duration=100,
            title="OLD",
        )
        a_old.created_at = timezone.now() - timezone.timedelta(days=10)
        a_old.save(update_fields=["created_at"])
        HymnAudio.objects.create(
            hymn=h,
            audio_file=_make_audio_file(),
            is_approved=True,
            duration=200,
            title="NEW",
        )
        url = reverse("hymns:hymnbook_queue_json", kwargs={"slug": hb.slug})
        body = json.loads(client.get(url).content)
        # primeiro = mais antigo (100s)
        assert body["hymns"][0]["duration"] == 100

    def test_owner_can_view_own_unpublished(self, client, user_factory, hymn_book_factory, hymn_factory):
        u = user_factory()
        hb = hymn_book_factory(name="QTest Owner", is_published=False, owner_user=u)
        hymn_factory(hymn_book=hb, number=1)
        client.force_login(u)
        url = reverse("hymns:hymnbook_queue_json", kwargs={"slug": hb.slug})
        resp = client.get(url)
        assert resp.status_code == 200
