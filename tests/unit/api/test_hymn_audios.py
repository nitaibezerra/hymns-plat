"""
Marco 4.A · Ciclo 4A.3.

`HymnType.audios(approvedOnly: Boolean = True)`:
- anon vê só áudios aprovados (independente do parâmetro).
- uploader vê seus próprios áudios pendentes quando `approvedOnly=False`.
- editor/admin vê tudo quando `approvedOnly=False`.

Reflete a gating das views REST (`apps/hymns/api_views.py`) e dos templates
(o player só lista aprovados; o workspace de revisão lista tudo).
"""

from __future__ import annotations

import pytest

from ._helpers import gql

pytestmark = pytest.mark.django_db


def _create_audio(hymn, *, is_approved, uploaded_by=None, title=""):
    from apps.hymns.models import HymnAudio

    return HymnAudio.objects.create(
        hymn=hymn,
        audio_file="x.mp3",
        is_approved=is_approved,
        uploaded_by=uploaded_by,
        title=title,
    )


def test_audios_filters_approved_for_anon(client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory(name="O Cruzeiro", slug="cruzeiro", is_published=True)
    h = hymn_factory(hymn_book=hb, number=1, title="Lua Branca")
    ok = _create_audio(h, is_approved=True, title="aprovado")
    _create_audio(h, is_approved=False, title="pendente")

    data = gql(client, '{ hymn(pk: "%s") { audios { id } } }' % h.pk)
    assert "errors" not in data, data
    ids = {row["id"] for row in data["data"]["hymn"]["audios"]}
    assert ids == {str(ok.id)}, ids

    # Mesmo passando approvedOnly=false, anon segue restrito a aprovados.
    data2 = gql(
        client,
        '{ hymn(pk: "%s") { audios(approvedOnly: false) { id } } }' % h.pk,
    )
    assert "errors" not in data2, data2
    ids2 = {row["id"] for row in data2["data"]["hymn"]["audios"]}
    assert ids2 == {str(ok.id)}, ids2


def test_audios_returns_pending_for_owner_or_editor(
    client, editor_client, user_factory, hymn_book_factory, hymn_factory
):
    hb = hymn_book_factory(name="O Cruzeiro", slug="cruzeiro", is_published=True)
    h = hymn_factory(hymn_book=hb, number=1, title="Lua Branca")
    uploader = user_factory(email="uploader@example.com")
    ok = _create_audio(h, is_approved=True, title="aprovado")
    mine = _create_audio(h, is_approved=False, uploaded_by=uploader, title="meu pendente")
    other = _create_audio(h, is_approved=False, title="alheio pendente")

    # Uploader pendente: vê seus próprios + aprovados; NÃO vê pendentes alheios.
    client.force_login(uploader)
    data = gql(
        client,
        '{ hymn(pk: "%s") { audios(approvedOnly: false) { id } } }' % h.pk,
    )
    assert "errors" not in data, data
    ids = {row["id"] for row in data["data"]["hymn"]["audios"]}
    assert ids == {str(ok.id), str(mine.id)}, ids

    # Editor: vê tudo. Re-login porque `client` e `editor_client` compartilham
    # a mesma instância de Client em pytest-django.
    editor_client.force_login(editor_client.user)
    data_editor = gql(
        editor_client,
        '{ hymn(pk: "%s") { audios(approvedOnly: false) { id } } }' % h.pk,
    )
    assert "errors" not in data_editor, data_editor
    ids_editor = {row["id"] for row in data_editor["data"]["hymn"]["audios"]}
    assert ids_editor == {str(ok.id), str(mine.id), str(other.id)}, ids_editor
