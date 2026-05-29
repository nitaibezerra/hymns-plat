"""
Marco 2 — Ciclo 2.6.

Mutation `toggleFavorite(hymnPk)` adiciona (cria) ou remove (deleta) o
favorito do hino para o usuário atual. Anônimo recebe `PermissionDeniedError`.
"""

from __future__ import annotations

import pytest

from apps.hymns.models import Favorite

from ._helpers import gql

pytestmark = pytest.mark.django_db


MUTATION = """
mutation($pk: ID!) {
  toggleFavorite(hymnPk: $pk) {
    __typename
    ... on ToggleFavoriteSuccess { favorited }
    ... on PermissionDeniedError { message }
  }
}
"""


def test_toggle_favorite_adds_for_authenticated(authenticated_client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory(is_published=True)
    h = hymn_factory(hymn_book=hb)
    user = authenticated_client.user

    data = gql(authenticated_client, MUTATION, variables={"pk": str(h.pk)})
    assert "errors" not in data, data
    result = data["data"]["toggleFavorite"]
    assert result["__typename"] == "ToggleFavoriteSuccess"
    assert result["favorited"] is True
    assert Favorite.objects.filter(user=user, hymn=h).exists()


def test_toggle_favorite_removes_existing(authenticated_client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory(is_published=True)
    h = hymn_factory(hymn_book=hb)
    user = authenticated_client.user
    Favorite.objects.create(user=user, hymn=h)

    data = gql(authenticated_client, MUTATION, variables={"pk": str(h.pk)})
    assert "errors" not in data, data
    result = data["data"]["toggleFavorite"]
    assert result["__typename"] == "ToggleFavoriteSuccess"
    assert result["favorited"] is False
    assert not Favorite.objects.filter(user=user, hymn=h).exists()


def test_toggle_favorite_blocks_anon(client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory(is_published=True)
    h = hymn_factory(hymn_book=hb)

    data = gql(client, MUTATION, variables={"pk": str(h.pk)})
    assert "errors" not in data, data
    assert data["data"]["toggleFavorite"]["__typename"] == "PermissionDeniedError"
    assert not Favorite.objects.filter(hymn=h).exists()
