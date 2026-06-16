"""
Marco 5.A — Ciclos 5A.1 a 5A.6.

Mutations CRUD de HymnBook: criar, atualizar, publicar/despublicar, deletar,
ajustar campos editoriais (prioridade/em-destaque). Todas reusam helpers de
`apps.hymns.permissions` e o `HymnBookForm` pra validação.
"""

from __future__ import annotations

import pytest

from apps.hymns.models import HymnBook

from ._helpers import gql

pytestmark = pytest.mark.django_db


# ---------- Ciclo 5A.1 — createHymnBook ----------

CREATE_MUTATION = """
mutation($input: HymnBookInput!) {
  createHymnBook(input: $input) {
    __typename
    ... on HymnBookType { id slug name }
    ... on PermissionDeniedError { message }
    ... on ValidationError { message field }
  }
}
"""


def test_create_hymnbook_editor_succeeds(editor_client):
    data = gql(
        editor_client,
        CREATE_MUTATION,
        variables={
            "input": {
                "name": "Novo Hinário",
                "ownerName": "Mestre Irineu",
                "introName": "Novo",
                "description": "Descrição opcional",
            }
        },
    )
    assert "errors" not in data, data
    result = data["data"]["createHymnBook"]
    assert result["__typename"] == "HymnBookType"
    assert result["name"] == "Novo Hinário"
    assert HymnBook.objects.filter(slug=result["slug"]).exists()


def test_create_hymnbook_anon_blocked(client):
    data = gql(
        client,
        CREATE_MUTATION,
        variables={"input": {"name": "Bloqueado", "ownerName": "Anon"}},
    )
    assert "errors" not in data, data
    result = data["data"]["createHymnBook"]
    assert result["__typename"] == "PermissionDeniedError"
    assert not HymnBook.objects.filter(name="Bloqueado").exists()


def test_create_hymnbook_validates_name_unique(editor_client, hymn_book_factory):
    hymn_book_factory(name="Duplicado")
    data = gql(
        editor_client,
        CREATE_MUTATION,
        variables={"input": {"name": "Duplicado", "ownerName": "X"}},
    )
    assert "errors" not in data, data
    result = data["data"]["createHymnBook"]
    assert result["__typename"] == "ValidationError"
    assert result["field"] == "name"


# ---------- Ciclo 5A.2 — updateHymnBook ----------

UPDATE_MUTATION = """
mutation($slug: String!, $input: HymnBookInput!) {
  updateHymnBook(slug: $slug, input: $input) {
    __typename
    ... on HymnBookType { slug name }
    ... on PermissionDeniedError { message }
    ... on NotFoundError { message }
    ... on ValidationError { message field }
  }
}
"""


def test_update_hymnbook_editor_succeeds(editor_client, hymn_book_factory):
    hb = hymn_book_factory(name="Antigo", slug="antigo")
    data = gql(
        editor_client,
        UPDATE_MUTATION,
        variables={
            "slug": hb.slug,
            "input": {"name": "Novo Nome", "ownerName": hb.owner_name},
        },
    )
    assert "errors" not in data, data
    result = data["data"]["updateHymnBook"]
    assert result["__typename"] == "HymnBookType"
    assert result["name"] == "Novo Nome"
    hb.refresh_from_db()
    assert hb.name == "Novo Nome"


def test_update_hymnbook_non_editor_blocked(authenticated_client, hymn_book_factory):
    hb = hymn_book_factory(name="Original", slug="original")
    data = gql(
        authenticated_client,
        UPDATE_MUTATION,
        variables={
            "slug": hb.slug,
            "input": {"name": "Hackeado", "ownerName": hb.owner_name},
        },
    )
    assert "errors" not in data, data
    assert data["data"]["updateHymnBook"]["__typename"] == "PermissionDeniedError"
    hb.refresh_from_db()
    assert hb.name == "Original"
