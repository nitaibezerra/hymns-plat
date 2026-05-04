"""
Aprovação de áudios pelo workspace do editor.

- GET /editor/audios/ lista pendentes (is_approved=False).
- POST /editor/audios/<pk>/aprovar/ marca is_approved=True.
- POST /editor/audios/<pk>/rejeitar/ deleta o registro.
- Editor (papel global) vê tudo; dono de hinário só vê áudios dos próprios hinos.
"""

import pytest
from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from apps.hymns.models import HymnAudio


def _make_editor(user):
    user.groups.add(Group.objects.get(name="editor"))
    return user


def _audio(hymn, *, approved=False, uploader=None, title="Gravação"):
    return HymnAudio.objects.create(
        hymn=hymn,
        audio_file=SimpleUploadedFile("a.mp3", b"binary", content_type="audio/mpeg"),
        title=title,
        is_approved=approved,
        uploaded_by=uploader,
        format="mp3",
    )


@pytest.mark.django_db
class TestPendingAudiosListView:
    def test_requires_login(self, client):
        resp = client.get(reverse("hymns:editor_pending_audios"))
        assert resp.status_code == 302
        assert "/accounts/login" in resp.url

    def test_random_user_sees_none(self, authenticated_client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="X")
        h = hymn_factory(hymn_book=hb, number=1)
        _audio(h, approved=False)
        resp = authenticated_client.get(reverse("hymns:editor_pending_audios"))
        # Usuário sem permissão e sem hinários próprios é redirecionado.
        assert resp.status_code == 302

    def test_editor_sees_all_pending(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb1 = hymn_book_factory(name="A")
        hb2 = hymn_book_factory(name="B")
        h1 = hymn_factory(hymn_book=hb1, number=1)
        h2 = hymn_factory(hymn_book=hb2, number=1)
        a1 = _audio(h1)
        a2 = _audio(h2)
        _audio(h1, approved=True)  # já aprovado, não deve aparecer

        resp = authenticated_client.get(reverse("hymns:editor_pending_audios"))
        assert resp.status_code == 200
        ids = {str(a.id) for a in resp.context["audios"]}
        assert str(a1.id) in ids
        assert str(a2.id) in ids
        assert len(ids) == 2

    def test_owner_who_is_not_editor_is_blocked(self, authenticated_client, hymn_book_factory, hymn_factory):
        # Política nova: ser dono não dá acesso ao workspace de áudios pendentes.
        own = hymn_book_factory(name="Mine", owner_user=authenticated_client.user)
        h_own = hymn_factory(hymn_book=own, number=1)
        _audio(h_own)

        resp = authenticated_client.get(reverse("hymns:editor_pending_audios"))
        assert resp.status_code == 302


@pytest.mark.django_db
class TestEditorListShowsPendingBadge:
    def test_shows_callout_when_pending_exists(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X")
        h = hymn_factory(hymn_book=hb, number=1)
        _audio(h)
        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_list"))
        assert resp.context["pending_audios_count"] == 1
        assert b"aguardando aprova" in resp.content.lower() or b"aguardando" in resp.content

    def test_no_callout_when_zero_pending(self, authenticated_client, hymn_book_factory):
        _make_editor(authenticated_client.user)
        hymn_book_factory(name="X")
        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_list"))
        assert resp.context["pending_audios_count"] == 0


@pytest.mark.django_db
class TestApproveAudioView:
    def test_owner_who_is_not_editor_cannot_approve(self, authenticated_client, hymn_book_factory, hymn_factory):
        # Política nova: ser dono não habilita aprovar áudios.
        hb = hymn_book_factory(name="X", owner_user=authenticated_client.user)
        h = hymn_factory(hymn_book=hb, number=1)
        a = _audio(h)
        url = reverse("hymns:editor_approve_audio", kwargs={"pk": a.pk})
        authenticated_client.post(url)
        a.refresh_from_db()
        assert a.is_approved is False

    def test_editor_can_approve_any(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="Other")
        h = hymn_factory(hymn_book=hb, number=1)
        a = _audio(h)
        url = reverse("hymns:editor_approve_audio", kwargs={"pk": a.pk})
        authenticated_client.post(url)
        a.refresh_from_db()
        assert a.is_approved is True

    def test_random_user_forbidden(self, authenticated_client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Foreign")
        h = hymn_factory(hymn_book=hb, number=1)
        a = _audio(h)
        url = reverse("hymns:editor_approve_audio", kwargs={"pk": a.pk})
        authenticated_client.post(url)
        a.refresh_from_db()
        assert a.is_approved is False


@pytest.mark.django_db
class TestRejectAudioView:
    def test_owner_who_is_not_editor_cannot_reject(self, authenticated_client, hymn_book_factory, hymn_factory):
        # Política nova: ser dono não habilita rejeitar áudios.
        hb = hymn_book_factory(name="X", owner_user=authenticated_client.user)
        h = hymn_factory(hymn_book=hb, number=1)
        a = _audio(h)
        url = reverse("hymns:editor_reject_audio", kwargs={"pk": a.pk})
        authenticated_client.post(url)
        assert HymnAudio.objects.filter(pk=a.pk).exists()

    def test_random_user_forbidden(self, authenticated_client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Foreign")
        h = hymn_factory(hymn_book=hb, number=1)
        a = _audio(h)
        url = reverse("hymns:editor_reject_audio", kwargs={"pk": a.pk})
        authenticated_client.post(url)
        assert HymnAudio.objects.filter(pk=a.pk).exists()
