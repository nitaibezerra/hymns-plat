"""
Marco 4.A · Ciclo 4A.11.

`Query.notifications(unreadOnly: Boolean = False)`:
- anônimo recebe erro de permissão (não há feed pessoal sem login).
- usuário autenticado recebe somente as próprias notificações.
- `unreadOnly=True` filtra apenas `is_read=False`.
"""

from __future__ import annotations

import pytest

from ._helpers import gql

pytestmark = pytest.mark.django_db


def _make_notification(recipient, *, title="Algo", is_read=False):
    from apps.users.models import Notification

    return Notification.objects.create(
        recipient=recipient,
        title=title,
        message=f"Mensagem de {title}",
        is_read=is_read,
    )


def test_notifications_returns_for_current_user_only(client, user_factory):
    me = user_factory(email="me@example.com")
    other = user_factory(email="other@example.com")
    _make_notification(me, title="Minha A")
    _make_notification(me, title="Minha B", is_read=True)
    _make_notification(other, title="Alheia")

    client.force_login(me)
    data = gql(client, "{ notifications { id title } }")
    assert "errors" not in data, data
    titles = {row["title"] for row in data["data"]["notifications"]}
    assert titles == {"Minha A", "Minha B"}, titles


def test_notifications_unread_filter(client, user_factory):
    me = user_factory(email="me@example.com")
    _make_notification(me, title="Lida", is_read=True)
    unread = _make_notification(me, title="Não lida", is_read=False)

    client.force_login(me)
    data = gql(client, "{ notifications(unreadOnly: true) { id title } }")
    assert "errors" not in data, data
    rows = data["data"]["notifications"]
    assert len(rows) == 1
    assert rows[0]["title"] == "Não lida"
    assert rows[0]["id"] == str(unread.id)


def test_notifications_blocks_anon(client):
    data = gql(client, "{ notifications { id } }")
    # Anônimo: o campo deve falhar com erro (não retornar lista vazia silenciosa).
    assert "errors" in data, data
    msg = data["errors"][0]["message"].lower()
    assert "auten" in msg or "permiss" in msg, data["errors"]
