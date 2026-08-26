"""
Marco 5.A½ · Tarefa B7 — casos de anônimo que faltavam.

`followUser`/`unfollowUser` não tinham teste de anônimo, `markAllNotificationsRead`
não tinha, e `logout` não tinha. Cada um responde de um jeito DIFERENTE de
propósito, então convém pinar as três formas:

- follow/unfollow → `PermissionDeniedError` (a ação exige identidade).
- markAllNotificationsRead → `0` (feed vazio é resposta natural, não erro).
- logout → `true` (idempotente; deslogar quem não está logado é no-op).
"""

from __future__ import annotations

import pytest

from apps.users.models import Notification, UserFollow

from ._helpers import gql

pytestmark = pytest.mark.django_db


FOLLOW = """
mutation($username: String!) {
  followUser(username: $username) {
    __typename
    ... on PermissionDeniedError { message }
    ... on NotFoundError { message }
  }
}
"""

UNFOLLOW = """
mutation($username: String!) {
  unfollowUser(username: $username) {
    __typename
    ... on PermissionDeniedError { message }
  }
}
"""

MARK_ALL = "mutation { markAllNotificationsRead }"
LOGOUT = "mutation { logout }"


def test_follow_user_blocks_anonymous(client, user_factory):
    alvo = user_factory(email="alvo@example.com")

    data = gql(client, FOLLOW, variables={"username": alvo.username})
    assert "errors" not in data, data
    result = data["data"]["followUser"]
    assert result["__typename"] == "PermissionDeniedError"
    assert result["message"] == "É preciso estar autenticado para seguir usuários."
    assert not UserFollow.objects.exists()
    assert not Notification.objects.exists()


def test_follow_user_anonymous_check_precedes_lookup(client):
    """Anônimo + username inexistente → PermissionDenied, não NotFound: o
    check de autenticação vem antes da busca nesta mutation."""
    data = gql(client, FOLLOW, variables={"username": "nao-existe"})
    assert "errors" not in data, data
    assert data["data"]["followUser"]["__typename"] == "PermissionDeniedError"


def test_unfollow_user_blocks_anonymous(client, user_factory):
    seguidor = user_factory(email="seguidor@example.com")
    alvo = user_factory(email="alvo@example.com")
    UserFollow.objects.create(follower=seguidor, followed=alvo)

    data = gql(client, UNFOLLOW, variables={"username": alvo.username})
    assert "errors" not in data, data
    result = data["data"]["unfollowUser"]
    assert result["__typename"] == "PermissionDeniedError"
    assert result["message"] == "É preciso estar autenticado."
    assert UserFollow.objects.count() == 1, "relação de terceiros não pode ser tocada"


def test_mark_all_notifications_read_returns_zero_for_anonymous(client, user_factory):
    outro = user_factory(email="outro@example.com")
    Notification.objects.create(recipient=outro, title="Oi", message="msg")

    data = gql(client, MARK_ALL)
    assert "errors" not in data, data
    assert data["data"]["markAllNotificationsRead"] == 0
    assert Notification.objects.filter(is_read=False).count() == 1


def test_logout_is_noop_for_anonymous(client):
    data = gql(client, LOGOUT)
    assert "errors" not in data, data
    assert data["data"]["logout"] is True


def test_logout_clears_session_for_authenticated(authenticated_client):
    """Contraparte: depois do logout, `currentUser` volta a ser null."""
    assert gql(authenticated_client, LOGOUT)["data"]["logout"] is True

    data = gql(authenticated_client, "{ currentUser { username } }")
    assert "errors" not in data, data
    assert data["data"]["currentUser"] is None
