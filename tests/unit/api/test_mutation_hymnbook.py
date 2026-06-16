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
