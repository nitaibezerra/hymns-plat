"""
Marco 5.A — Ciclos 5A.15 a 5A.18.

Mutations sociais: follow/unfollow + marcar notificação(es) como lida(s).
Paridade com `apps/users/views_social.py`.
"""

from __future__ import annotations

import pytest

from apps.users.models import Notification, UserFollow

from ._helpers import gql

pytestmark = pytest.mark.django_db


# ---------- Ciclo 5A.15 — followUser ----------

FOLLOW_MUTATION = """
mutation($username: String!) {
  followUser(username: $username) {
    __typename
    ... on UserProfileType { user { username } followersCount }
    ... on PermissionDeniedError { message }
    ... on NotFoundError { message }
  }
}
"""


def test_follow_user_creates_follow_and_notification(authenticated_client, user_factory):
    target = user_factory(email="target@x.com")
    follower = authenticated_client.user

    data = gql(authenticated_client, FOLLOW_MUTATION, variables={"username": target.username})
    assert "errors" not in data, data
    result = data["data"]["followUser"]
    assert result["__typename"] == "UserProfileType"
    assert result["user"]["username"] == target.username
    assert result["followersCount"] == 1
    assert UserFollow.objects.filter(follower=follower, followed=target).exists()
    # Notificação "novo seguidor" para o target
    assert Notification.objects.filter(
        recipient=target, sender=follower, notification_type=Notification.TYPE_FOLLOW
    ).exists()


def test_follow_already_following_no_dup(authenticated_client, user_factory):
    target = user_factory(email="target@x.com")
    follower = authenticated_client.user
    UserFollow.objects.create(follower=follower, followed=target)
    notifs_before = Notification.objects.filter(recipient=target).count()

    data = gql(authenticated_client, FOLLOW_MUTATION, variables={"username": target.username})
    assert "errors" not in data, data
    assert data["data"]["followUser"]["__typename"] == "UserProfileType"
    assert UserFollow.objects.filter(follower=follower, followed=target).count() == 1
    # Não cria notificação adicional pra follows duplicados
    assert Notification.objects.filter(recipient=target).count() == notifs_before


def test_follow_self_blocked(authenticated_client):
    data = gql(
        authenticated_client,
        FOLLOW_MUTATION,
        variables={"username": authenticated_client.user.username},
    )
    assert "errors" not in data, data
    assert data["data"]["followUser"]["__typename"] == "PermissionDeniedError"
    assert not UserFollow.objects.filter(
        follower=authenticated_client.user, followed=authenticated_client.user
    ).exists()
