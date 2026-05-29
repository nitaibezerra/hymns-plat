"""
Marco 2 — Ciclo 2.5.

Mutation `updateHymn(pk, input)` reusa `HymnForm` (ModelForm) para validação,
evitando duplicação de regra. Só editores conseguem alterar; input inválido
retorna `ValidationError` com o campo problemático.
"""

from __future__ import annotations

import pytest

from ._helpers import gql

pytestmark = pytest.mark.django_db


MUTATION = """
mutation($pk: ID!, $input: HymnUpdateInput!) {
  updateHymn(pk: $pk, input: $input) {
    __typename
    ... on HymnType { id title }
    ... on PermissionDeniedError { message }
    ... on ValidationError { message field }
  }
}
"""


def test_update_hymn_editor_can_change_title(editor_client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory(is_published=True)
    h = hymn_factory(hymn_book=hb, title="Antigo")

    data = gql(
        editor_client,
        MUTATION,
        variables={"pk": str(h.pk), "input": {"title": "Novo Título"}},
    )
    assert "errors" not in data, data
    result = data["data"]["updateHymn"]
    assert result["__typename"] == "HymnType"
    assert result["title"] == "Novo Título"

    h.refresh_from_db()
    assert h.title == "Novo Título"


def test_update_hymn_blocks_non_editor(authenticated_client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory(is_published=True)
    h = hymn_factory(hymn_book=hb, title="Original")

    data = gql(
        authenticated_client,
        MUTATION,
        variables={"pk": str(h.pk), "input": {"title": "Hackeado"}},
    )
    assert "errors" not in data, data
    assert data["data"]["updateHymn"]["__typename"] == "PermissionDeniedError"

    h.refresh_from_db()
    assert h.title == "Original"


def test_update_hymn_validates_duplicate_number(editor_client, hymn_book_factory, hymn_factory):
    """Tentar mudar o `number` para um já existente no mesmo hinário falha (HymnForm valida)."""
    hb = hymn_book_factory(is_published=True)
    h1 = hymn_factory(hymn_book=hb, number=1, title="H1")
    h2 = hymn_factory(hymn_book=hb, number=2, title="H2")

    data = gql(
        editor_client,
        MUTATION,
        variables={"pk": str(h2.pk), "input": {"number": 1}},
    )
    assert "errors" not in data, data
    result = data["data"]["updateHymn"]
    assert result["__typename"] == "ValidationError"
    assert result["field"] == "number"

    h2.refresh_from_db()
    assert h2.number == 2  # não mudou
    _ = h1  # silenciar linter
