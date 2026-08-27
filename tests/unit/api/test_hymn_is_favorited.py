"""
Marco 5.A½ · Tarefa B5 — `HymnType.isFavorited`.

`toggleFavorite` existia sem leitura correspondente: o cliente favoritava e
não tinha como saber o estado ao recarregar a tela. Baseado no usuário da
sessão; anônimo vê `false` (não erro — coração apagado é resposta natural).
"""

from __future__ import annotations

import pytest

from apps.hymns.models import Favorite

from ._helpers import gql

pytestmark = pytest.mark.django_db


HYMN_QUERY = """
query($pk: ID!) {
  hymn(pk: $pk) { isFavorited }
}
"""

TOGGLE = """
mutation($pk: ID!) {
  toggleFavorite(hymnPk: $pk) {
    __typename
    ... on ToggleFavoriteSuccess { favorited }
  }
}
"""


def test_is_favorited_false_for_anonymous(client, hymn):
    data = gql(client, HYMN_QUERY, variables={"pk": str(hymn.pk)})
    assert "errors" not in data, data
    assert data["data"]["hymn"]["isFavorited"] is False


def test_is_favorited_false_when_not_favorited(authenticated_client, hymn):
    data = gql(authenticated_client, HYMN_QUERY, variables={"pk": str(hymn.pk)})
    assert "errors" not in data, data
    assert data["data"]["hymn"]["isFavorited"] is False


def test_is_favorited_true_when_favorited(authenticated_client, hymn):
    Favorite.objects.create(user=authenticated_client.user, hymn=hymn)
    data = gql(authenticated_client, HYMN_QUERY, variables={"pk": str(hymn.pk)})
    assert "errors" not in data, data
    assert data["data"]["hymn"]["isFavorited"] is True


def test_is_favorited_ignores_other_users_favorites(authenticated_client, user_factory, hymn):
    other = user_factory(email="outro@example.com")
    Favorite.objects.create(user=other, hymn=hymn)
    data = gql(authenticated_client, HYMN_QUERY, variables={"pk": str(hymn.pk)})
    assert "errors" not in data, data
    assert data["data"]["hymn"]["isFavorited"] is False


def test_is_favorited_follows_toggle_favorite(authenticated_client, hymn):
    """Leitura e escrita têm que concordar — o motivo do campo existir."""
    toggled = gql(authenticated_client, TOGGLE, variables={"pk": str(hymn.pk)})
    assert toggled["data"]["toggleFavorite"]["favorited"] is True

    data = gql(authenticated_client, HYMN_QUERY, variables={"pk": str(hymn.pk)})
    assert data["data"]["hymn"]["isFavorited"] is True

    gql(authenticated_client, TOGGLE, variables={"pk": str(hymn.pk)})
    data = gql(authenticated_client, HYMN_QUERY, variables={"pk": str(hymn.pk)})
    assert data["data"]["hymn"]["isFavorited"] is False
