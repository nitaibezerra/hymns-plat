"""
Marco 2 — Ciclos 2.2 e 2.3.

Mutations de auth (`login`, `logout`) e query `currentUser`. A auth real continua
sendo session-based (allauth para o login web bonito); essas mutations existem
para alimentar (a) o cliente SvelteKit em E2E tests e (b) o futuro app mobile.
"""

from __future__ import annotations

import pytest

from ._helpers import gql

pytestmark = pytest.mark.django_db


# ---------- Ciclo 2.2: login ----------


def test_login_mutation_authenticates_valid_credentials(client, user_factory):
    user_factory(email="ana@example.com", password="senha-forte-123")

    data = gql(
        client,
        """
        mutation($u: String!, $p: String!) {
          login(username: $u, password: $p) {
            __typename
            ... on LoginSuccess { user { username } }
            ... on LoginError { message }
          }
        }
        """,
        variables={"u": "ana", "p": "senha-forte-123"},
    )
    assert "errors" not in data, data
    result = data["data"]["login"]
    assert result["__typename"] == "LoginSuccess", result
    assert result["user"]["username"] == "ana"


def test_login_mutation_returns_error_for_invalid_credentials(client, user_factory):
    user_factory(email="ana@example.com", password="senha-forte-123")

    data = gql(
        client,
        """
        mutation($u: String!, $p: String!) {
          login(username: $u, password: $p) {
            __typename
            ... on LoginSuccess { user { username } }
            ... on LoginError { message }
          }
        }
        """,
        variables={"u": "ana", "p": "errado"},
    )
    assert "errors" not in data, data
    result = data["data"]["login"]
    assert result["__typename"] == "LoginError"
    assert result["message"], "mensagem de erro precisa existir"


# ---------- Ciclo 2.3: currentUser + logout ----------


def test_current_user_returns_null_for_anon(client):
    data = gql(client, "{ currentUser { username } }")
    assert "errors" not in data, data
    assert data["data"]["currentUser"] is None


def test_current_user_returns_user_for_authenticated(authenticated_client):
    data = gql(authenticated_client, "{ currentUser { username } }")
    assert "errors" not in data, data
    assert data["data"]["currentUser"]["username"] == authenticated_client.user.username


def test_logout_mutation_clears_session(authenticated_client):
    # Sanity: começa logado
    before = gql(authenticated_client, "{ currentUser { username } }")
    assert before["data"]["currentUser"] is not None

    # Logout
    out = gql(authenticated_client, "mutation { logout }")
    assert out["data"]["logout"] is True

    # Após logout, currentUser volta a ser null
    after = gql(authenticated_client, "{ currentUser { username } }")
    assert after["data"]["currentUser"] is None
