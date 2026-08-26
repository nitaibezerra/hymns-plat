"""
Marco 5.A½ · Tarefa B5 — `NotificationType.sender`.

As Notifications são criadas COM sender (`mutations.py::follow_user`), mas o
campo não era exposto: o feed não conseguia mostrar quem gerou a notificação
nem linkar para o perfil dessa pessoa.
"""

from __future__ import annotations

import pytest

from apps.users.models import Notification

from ._helpers import gql

pytestmark = pytest.mark.django_db


NOTIFICATIONS = """
{
  notifications {
    title
    sender { username }
  }
}
"""

FOLLOW = """
mutation($username: String!) {
  followUser(username: $username) {
    __typename
  }
}
"""


def test_notification_exposes_sender(authenticated_client, user_factory):
    outro = user_factory(email="outro@example.com")
    Notification.objects.create(
        recipient=authenticated_client.user,
        sender=outro,
        notification_type=Notification.TYPE_FOLLOW,
        title="Novo seguidor",
        message=f"{outro.username} começou a seguir você",
    )

    data = gql(authenticated_client, NOTIFICATIONS)
    assert "errors" not in data, data
    assert data["data"]["notifications"][0]["sender"] == {"username": outro.username}


def test_notification_sender_is_null_when_system_generated(authenticated_client):
    """`sender` é nullable (FK null=True) — notificação de sistema não tem autor."""
    Notification.objects.create(
        recipient=authenticated_client.user,
        notification_type=Notification.TYPE_AUDIO_APPROVED,
        title="Áudio aprovado",
        message="Seu áudio foi aprovado",
    )

    data = gql(authenticated_client, NOTIFICATIONS)
    assert "errors" not in data, data
    assert data["data"]["notifications"][0]["sender"] is None


def test_follow_user_notification_sender_is_the_follower(client, user_factory):
    """Fecha o ciclo: quem seguiu aparece como sender no feed do seguido."""
    follower = user_factory(email="seguidor@example.com")
    followed = user_factory(email="seguido@example.com")

    client.force_login(follower)
    assert (
        gql(client, FOLLOW, variables={"username": followed.username})["data"]["followUser"]["__typename"]
        == "UserProfileType"
    )

    client.force_login(followed)
    data = gql(client, NOTIFICATIONS)
    assert "errors" not in data, data
    assert data["data"]["notifications"][0]["sender"] == {"username": follower.username}
