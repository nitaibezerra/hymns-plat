"""
Marco 5.A½ · Tarefa B7 — input inválido nas mutations que não tinham cobertura.

`quickReviewHymn` não tinha NEM permissão negada NEM input inválido;
`updateHymnBook`, `updateHymnBookEditorial`, `setReviewStatus` e
`toggleFavorite` também não tinham o caso de input inválido.

Achado ao escrever estes testes: um `ID` malformado (não-UUID) fazia o ORM
levantar `django.core.exceptions.ValidationError` e a mensagem CRUA do
validador — com o placeholder `%(value)s` sem interpolar — escapava para
`errors[]`. Para o cliente, id malformado e id inexistente são a mesma coisa:
ambos agora respondem `NotFoundError`.
"""

from __future__ import annotations

import uuid

import pytest

from apps.hymns.models import HymnBook

from ._helpers import gql

pytestmark = pytest.mark.django_db

MALFORMED_ID = "nao-e-um-uuid"


# ---------- quickReviewHymn ----------

QUICK_REVIEW = """
mutation($pk: ID!, $style: String!, $repetitions: String!) {
  quickReviewHymn(pk: $pk, style: $style, repetitions: $repetitions) {
    __typename
    ... on HymnType { style }
    ... on ValidationError { message field }
    ... on PermissionDeniedError { message }
    ... on NotFoundError { message }
  }
}
"""


def test_quick_review_non_editor_blocked(authenticated_client, hymn):
    data = gql(
        authenticated_client,
        QUICK_REVIEW,
        variables={"pk": str(hymn.pk), "style": "Valsa", "repetitions": "1-4"},
    )
    assert "errors" not in data, data
    assert data["data"]["quickReviewHymn"]["__typename"] == "PermissionDeniedError"


def test_quick_review_anon_blocked(client, hymn):
    data = gql(client, QUICK_REVIEW, variables={"pk": str(hymn.pk), "style": "Valsa", "repetitions": "1-4"})
    assert "errors" not in data, data
    assert data["data"]["quickReviewHymn"]["__typename"] == "PermissionDeniedError"


def test_quick_review_rejects_style_over_max_length(editor_client, hymn):
    """`Hymn.style` é max_length=50 — o form tem que reprovar, não truncar."""
    data = gql(
        editor_client,
        QUICK_REVIEW,
        variables={"pk": str(hymn.pk), "style": "x" * 51, "repetitions": "1-4"},
    )
    assert "errors" not in data, data
    result = data["data"]["quickReviewHymn"]
    assert result["__typename"] == "ValidationError", result
    assert result["field"] == "style"

    hymn.refresh_from_db()
    assert hymn.style == ""


def test_quick_review_rejects_repetitions_over_max_length(editor_client, hymn):
    data = gql(
        editor_client,
        QUICK_REVIEW,
        variables={"pk": str(hymn.pk), "style": "Valsa", "repetitions": "y" * 101},
    )
    assert "errors" not in data, data
    result = data["data"]["quickReviewHymn"]
    assert result["__typename"] == "ValidationError", result
    assert result["field"] == "repetitions"


def test_quick_review_malformed_pk_is_not_found(editor_client):
    data = gql(editor_client, QUICK_REVIEW, variables={"pk": MALFORMED_ID, "style": "Valsa", "repetitions": "1-4"})
    assert "errors" not in data, data
    assert data["data"]["quickReviewHymn"]["__typename"] == "NotFoundError"


# ---------- updateHymnBook ----------

UPDATE_HYMNBOOK = """
mutation($slug: String!, $input: HymnBookInput!) {
  updateHymnBook(slug: $slug, input: $input) {
    __typename
    ... on HymnBookType { name }
    ... on ValidationError { message field }
  }
}
"""


def test_update_hymnbook_rejects_duplicate_name(editor_client, hymn_book_factory):
    """`HymnBook.name` é unique — renomear em cima de outro tem que falhar."""
    hymn_book_factory(name="Ja Existe", slug="ja-existe")
    alvo = hymn_book_factory(name="Alvo", slug="alvo")

    data = gql(
        editor_client,
        UPDATE_HYMNBOOK,
        variables={"slug": "alvo", "input": {"name": "Ja Existe", "ownerName": "Mestre"}},
    )
    assert "errors" not in data, data
    result = data["data"]["updateHymnBook"]
    assert result["__typename"] == "ValidationError", result
    assert result["field"] == "name"

    alvo.refresh_from_db()
    assert alvo.name == "Alvo"


def test_update_hymnbook_rejects_blank_name(editor_client, hymn_book_factory):
    hymn_book_factory(name="Alvo", slug="alvo")

    data = gql(
        editor_client,
        UPDATE_HYMNBOOK,
        variables={"slug": "alvo", "input": {"name": "", "ownerName": "Mestre"}},
    )
    assert "errors" not in data, data
    result = data["data"]["updateHymnBook"]
    assert result["__typename"] == "ValidationError", result
    assert result["field"] == "name"


# ---------- updateHymnBookEditorial ----------

EDITORIAL = """
mutation($slug: String!, $priority: String, $isFeatured: Boolean) {
  updateHymnBookEditorial(slug: $slug, priority: $priority, isFeatured: $isFeatured) {
    __typename
    ... on HymnBookType { priority isFeatured }
  }
}
"""


def test_update_hymnbook_editorial_ignores_priority_outside_choices(admin_client, hymn_book_factory):
    """Prioridade fora de `HymnBook.Priority.values` é ignorada em silêncio.

    Convenção deliberada e já usada em `_parse_sort` e no filtro de prioridade
    de `editorHymnbooks`: a union desta mutation não tem `ValidationError`, e
    valor fora do vocabulário é erro de programa do cliente — o hinário fica
    intacto em vez de sair meio-atualizado.
    """
    book = hymn_book_factory(name="Alvo", slug="alvo", priority=HymnBook.Priority.P2)

    data = gql(admin_client, EDITORIAL, variables={"slug": "alvo", "priority": "P9"})
    assert "errors" not in data, data
    result = data["data"]["updateHymnBookEditorial"]
    assert result["__typename"] == "HymnBookType"
    assert result["priority"] == "P2"

    book.refresh_from_db()
    assert book.priority == HymnBook.Priority.P2


def test_update_hymnbook_editorial_applies_valid_sibling_when_priority_invalid(admin_client, hymn_book_factory):
    """Prioridade inválida não pode arrastar `isFeatured` para o lixo com ela."""
    book = hymn_book_factory(name="Alvo", slug="alvo", priority=HymnBook.Priority.P2, is_featured=False)

    data = gql(admin_client, EDITORIAL, variables={"slug": "alvo", "priority": "nope", "isFeatured": True})
    assert "errors" not in data, data
    assert data["data"]["updateHymnBookEditorial"]["isFeatured"] is True

    book.refresh_from_db()
    assert book.is_featured is True
    assert book.priority == HymnBook.Priority.P2


# ---------- setReviewStatus ----------

SET_STATUS_LITERAL = """
mutation($pk: ID!) {
  setReviewStatus(pk: $pk, status: NAO_EXISTE) { __typename }
}
"""

SET_STATUS = """
mutation($pk: ID!, $status: ReviewStatus!) {
  setReviewStatus(pk: $pk, status: $status) {
    __typename
    ... on NotFoundError { message }
  }
}
"""


def test_set_review_status_rejects_value_outside_enum(admin_client, hymn):
    """Valor fora do enum é barrado na validação do GraphQL, antes do resolver."""
    data = gql(admin_client, SET_STATUS_LITERAL, variables={"pk": str(hymn.pk)})
    assert "errors" in data, data
    assert "ReviewStatus" in data["errors"][0]["message"]


def test_set_review_status_malformed_pk_is_not_found(admin_client):
    data = gql(admin_client, SET_STATUS, variables={"pk": MALFORMED_ID, "status": "REVIEWED"})
    assert "errors" not in data, data
    assert data["data"]["setReviewStatus"]["__typename"] == "NotFoundError"


# ---------- toggleFavorite ----------

TOGGLE = """
mutation($pk: ID!) {
  toggleFavorite(hymnPk: $pk) {
    __typename
    ... on NotFoundError { message }
    ... on PermissionDeniedError { message }
  }
}
"""


def test_toggle_favorite_malformed_pk_is_not_found(authenticated_client):
    data = gql(authenticated_client, TOGGLE, variables={"pk": MALFORMED_ID})
    assert "errors" not in data, data
    assert data["data"]["toggleFavorite"]["__typename"] == "NotFoundError"


def test_toggle_favorite_nonexistent_pk_is_not_found(authenticated_client):
    data = gql(authenticated_client, TOGGLE, variables={"pk": str(uuid.uuid4())})
    assert "errors" not in data, data
    assert data["data"]["toggleFavorite"]["__typename"] == "NotFoundError"


# ---------- queries: pk malformado não estoura ----------


def test_query_hymn_malformed_pk_returns_null_without_error(client):
    data = gql(client, '{ hymn(pk: "%s") { id } }' % MALFORMED_ID)
    assert "errors" not in data, data
    assert data["data"]["hymn"] is None


def test_query_ocr_task_malformed_id_returns_null_without_error(admin_client):
    data = gql(admin_client, '{ ocrTask(id: "%s") { id } }' % MALFORMED_ID)
    assert "errors" not in data, data
    assert data["data"]["ocrTask"] is None
