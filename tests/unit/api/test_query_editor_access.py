"""
Marco 5.A½ · Tarefa B2 — guard `_has_editor_access` nos resolvers do workspace.

As views Django equivalentes (`editor_hymnbook_list`, `editor_pending_audios`)
bloqueiam quem não tem papel editorial. Via GraphQL isso vazava: um usuário
autenticado comum recebia os hinários que possui e seus áudios pendentes.

Decisão de formato de erro: query que devolve lista/objeto não-nulável não tem
como devolver union, então levantamos `GraphQLError` com a MESMA mensagem de
`apps.api.errors.PermissionDeniedError` (constante `PERMISSION_DENIED_MESSAGE`).
Precedente: `Query.notifications` já levanta GraphQLError pra anônimo.
"""

from __future__ import annotations

import pytest

from apps.api.errors import PERMISSION_DENIED_MESSAGE

from ._helpers import gql

pytestmark = pytest.mark.django_db


EDITOR_HYMNBOOKS = "{ editorHymnbooks { slug } }"
DASHBOARD_STATS = "{ editorDashboardStats { totalHinarios } }"
PENDING_AUDIOS = "{ pendingAudios { id } }"


def _assert_denied(data, field):
    assert "errors" in data, data
    assert data["errors"][0]["message"] == PERMISSION_DENIED_MESSAGE
    assert data["data"] is None or data["data"].get(field) is None


# ---------- editorHymnbooks ----------


def test_editor_hymnbooks_blocks_anonymous(client, hymn_book_factory):
    hymn_book_factory(name="A", slug="a")
    _assert_denied(gql(client, EDITOR_HYMNBOOKS), "editorHymnbooks")


def test_editor_hymnbooks_blocks_common_user(authenticated_client, hymn_book_factory):
    """Dono comum não é editor: o workspace não pode listar nada pra ele."""
    hymn_book_factory(name="Meu", slug="meu", owner_user=authenticated_client.user)
    _assert_denied(gql(authenticated_client, EDITOR_HYMNBOOKS), "editorHymnbooks")


def test_editor_hymnbooks_allows_editor(editor_client, hymn_book_factory):
    hymn_book_factory(name="A", slug="a")
    data = gql(editor_client, EDITOR_HYMNBOOKS)
    assert "errors" not in data, data
    assert [row["slug"] for row in data["data"]["editorHymnbooks"]] == ["a"]


def test_editor_hymnbooks_allows_superuser(admin_client, hymn_book_factory):
    hymn_book_factory(name="A", slug="a")
    data = gql(admin_client, EDITOR_HYMNBOOKS)
    assert "errors" not in data, data
    assert [row["slug"] for row in data["data"]["editorHymnbooks"]] == ["a"]


# ---------- editorDashboardStats ----------


def test_editor_dashboard_stats_blocks_anonymous(client):
    _assert_denied(gql(client, DASHBOARD_STATS), "editorDashboardStats")


def test_editor_dashboard_stats_blocks_common_user(authenticated_client, hymn_book_factory):
    hymn_book_factory(name="Meu", slug="meu", owner_user=authenticated_client.user)
    _assert_denied(gql(authenticated_client, DASHBOARD_STATS), "editorDashboardStats")


def test_editor_dashboard_stats_allows_editor(editor_client, hymn_book_factory):
    hymn_book_factory(name="A", slug="a")
    data = gql(editor_client, DASHBOARD_STATS)
    assert "errors" not in data, data
    assert data["data"]["editorDashboardStats"]["totalHinarios"] == 1


def test_editor_dashboard_stats_allows_superuser(admin_client, hymn_book_factory):
    hymn_book_factory(name="A", slug="a")
    data = gql(admin_client, DASHBOARD_STATS)
    assert "errors" not in data, data
    assert data["data"]["editorDashboardStats"]["totalHinarios"] == 1


# ---------- pendingAudios ----------


def test_pending_audios_blocks_anonymous(client):
    _assert_denied(gql(client, PENDING_AUDIOS), "pendingAudios")


def test_pending_audios_blocks_common_user(authenticated_client, hymn_book_factory, hymn_factory):
    from apps.hymns.models import HymnAudio

    book = hymn_book_factory(name="Meu", slug="meu", owner_user=authenticated_client.user)
    hymn = hymn_factory(hymn_book=book)
    HymnAudio.objects.create(hymn=hymn, audio_file="a.mp3", is_approved=False)
    _assert_denied(gql(authenticated_client, PENDING_AUDIOS), "pendingAudios")


def test_pending_audios_allows_editor(editor_client, hymn_book_factory, hymn_factory):
    from apps.hymns.models import HymnAudio

    book = hymn_book_factory(name="A", slug="a")
    hymn = hymn_factory(hymn_book=book)
    HymnAudio.objects.create(hymn=hymn, audio_file="a.mp3", is_approved=False)
    data = gql(editor_client, PENDING_AUDIOS)
    assert "errors" not in data, data
    assert len(data["data"]["pendingAudios"]) == 1


def test_pending_audios_allows_superuser(admin_client, hymn_book_factory, hymn_factory):
    from apps.hymns.models import HymnAudio

    book = hymn_book_factory(name="A", slug="a")
    hymn = hymn_factory(hymn_book=book)
    HymnAudio.objects.create(hymn=hymn, audio_file="a.mp3", is_approved=False)
    data = gql(admin_client, PENDING_AUDIOS)
    assert "errors" not in data, data
    assert len(data["data"]["pendingAudios"]) == 1
