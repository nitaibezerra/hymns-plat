"""
Marco 5.A½ · Tarefa B1 — `UserType.isEditor`.

O guard `web/src/routes/(editor)/+layout.ts` (sub-marco 5.B) precisa saber se
o usuário logado tem papel editorial; `currentUser != null` não serve. O campo
delega em `apps.hymns.permissions._is_editor_or_admin` — mesma regra das views.
"""

from __future__ import annotations

import pytest

from ._helpers import gql

pytestmark = pytest.mark.django_db


CURRENT_USER = """
{
  currentUser {
    username
    isEditor
  }
}
"""


def test_current_user_is_editor_true_for_editor(editor_client):
    data = gql(editor_client, CURRENT_USER)
    assert "errors" not in data, data
    assert data["data"]["currentUser"]["isEditor"] is True


def test_current_user_is_editor_false_for_common_user(authenticated_client):
    data = gql(authenticated_client, CURRENT_USER)
    assert "errors" not in data, data
    assert data["data"]["currentUser"]["isEditor"] is False


def test_current_user_is_editor_true_for_superuser(admin_client):
    data = gql(admin_client, CURRENT_USER)
    assert "errors" not in data, data
    assert data["data"]["currentUser"]["isEditor"] is True
