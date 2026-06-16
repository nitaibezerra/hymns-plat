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


# ---------- Ciclo 5A.16 — unfollowUser ----------

UNFOLLOW_MUTATION = """
mutation($username: String!) {
  unfollowUser(username: $username) {
    __typename
    ... on UserProfileType { user { username } followersCount }
    ... on PermissionDeniedError { message }
    ... on NotFoundError { message }
  }
}
"""


def test_unfollow_user_removes_follow(authenticated_client, user_factory):
    target = user_factory(email="target@x.com")
    UserFollow.objects.create(follower=authenticated_client.user, followed=target)
    assert UserFollow.objects.filter(follower=authenticated_client.user, followed=target).exists()

    data = gql(authenticated_client, UNFOLLOW_MUTATION, variables={"username": target.username})
    assert "errors" not in data, data
    result = data["data"]["unfollowUser"]
    assert result["__typename"] == "UserProfileType"
    assert result["followersCount"] == 0
    assert not UserFollow.objects.filter(
        follower=authenticated_client.user, followed=target
    ).exists()


def test_unfollow_not_following_is_noop(authenticated_client, user_factory):
    """unfollow sem follow prévio retorna profile sem erro."""
    target = user_factory(email="target@x.com")
    assert not UserFollow.objects.filter(
        follower=authenticated_client.user, followed=target
    ).exists()

    data = gql(authenticated_client, UNFOLLOW_MUTATION, variables={"username": target.username})
    assert "errors" not in data, data
    assert data["data"]["unfollowUser"]["__typename"] == "UserProfileType"


# ---------- Ciclo 5A.17 — markNotificationRead ----------

MARK_READ_MUTATION = """
mutation($pk: ID!) {
  markNotificationRead(pk: $pk) {
    __typename
    ... on NotificationType { id isRead }
    ... on PermissionDeniedError { message }
    ... on NotFoundError { message }
  }
}
"""


def _make_notification(recipient, **kwargs):
    return Notification.objects.create(
        recipient=recipient,
        notification_type=Notification.TYPE_FAVORITE,
        title="t",
        message="m",
        **kwargs,
    )


def test_mark_notification_read_owner_succeeds(authenticated_client):
    n = _make_notification(authenticated_client.user, is_read=False)
    data = gql(authenticated_client, MARK_READ_MUTATION, variables={"pk": str(n.pk)})
    assert "errors" not in data, data
    result = data["data"]["markNotificationRead"]
    assert result["__typename"] == "NotificationType"
    assert result["isRead"] is True
    n.refresh_from_db()
    assert n.is_read is True


def test_mark_notification_read_other_user_blocked(client, user_factory):
    owner = user_factory(email="owner@x.com")
    other = user_factory(email="other@x.com")
    n = _make_notification(owner, is_read=False)
    client.force_login(other)

    data = gql(client, MARK_READ_MUTATION, variables={"pk": str(n.pk)})
    assert "errors" not in data, data
    # Não vaza existência de notificação alheia: NotFoundError, não Permission
    assert data["data"]["markNotificationRead"]["__typename"] == "NotFoundError"
    n.refresh_from_db()
    assert n.is_read is False


# ---------- Ciclo 5A.18 — markAllNotificationsRead ----------

MARK_ALL_READ_MUTATION = """
mutation { markAllNotificationsRead }
"""


def test_mark_all_notifications_read_marks_only_own(authenticated_client, user_factory):
    """Marca como lidas só as do usuário autenticado."""
    other = user_factory(email="other@x.com")
    own_unread = [
        _make_notification(authenticated_client.user, is_read=False) for _ in range(3)
    ]
    own_read = _make_notification(authenticated_client.user, is_read=True)
    other_unread = _make_notification(other, is_read=False)

    data = gql(authenticated_client, MARK_ALL_READ_MUTATION)
    assert "errors" not in data, data
    # Conta = só as não-lidas do user que mudaram
    assert data["data"]["markAllNotificationsRead"] == 3
    for n in own_unread:
        n.refresh_from_db()
        assert n.is_read is True
    own_read.refresh_from_db()
    assert own_read.is_read is True
    other_unread.refresh_from_db()
    assert other_unread.is_read is False
