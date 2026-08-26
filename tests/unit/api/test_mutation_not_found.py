"""
Marco 5.A½ · Tarefa B7 — ramo `NotFoundError` das mutations.

O ramo é declarado por 7 mutations e estava testado em UMA só
(`test_mutation_social.py::markNotificationRead`). Aqui cobrimos pk/slug
inexistente em unpublishHymnBook, deleteHymnBook, deleteHymn, approveAudio,
rejectAudio, reviewAudio e deleteAudio.

Detalhe importante do contrato: a busca do objeto vem ANTES do gate de
permissão nessas mutations, então "não existe" ganha de "não pode" — inclusive
para quem não teria permissão. Isso é deliberado: um slug inexistente não deve
responder de forma diferente conforme quem pergunta.
"""

from __future__ import annotations

import uuid

import pytest

from ._helpers import gql

pytestmark = pytest.mark.django_db

MISSING_SLUG = "hinario-que-nao-existe"


def _missing_pk() -> str:
    return str(uuid.uuid4())


def _assert_not_found(data, field):
    assert "errors" not in data, data
    assert data["data"][field]["__typename"] == "NotFoundError", data
    assert data["data"][field]["message"] == "Recurso não encontrado."


# ---------- mutations por slug ----------

UNPUBLISH = """
mutation($slug: String!) {
  unpublishHymnBook(slug: $slug) {
    __typename
    ... on NotFoundError { message }
    ... on PermissionDeniedError { message }
  }
}
"""

DELETE_HYMNBOOK = """
mutation($slug: String!) {
  deleteHymnBook(slug: $slug) {
    __typename
    ... on NotFoundError { message }
    ... on PermissionDeniedError { message }
  }
}
"""


def test_unpublish_hymnbook_missing_slug(admin_client):
    _assert_not_found(gql(admin_client, UNPUBLISH, variables={"slug": MISSING_SLUG}), "unpublishHymnBook")


def test_delete_hymnbook_missing_slug(admin_client):
    _assert_not_found(gql(admin_client, DELETE_HYMNBOOK, variables={"slug": MISSING_SLUG}), "deleteHymnBook")


def test_delete_hymnbook_missing_slug_wins_over_permission(authenticated_client):
    """Usuário sem permissão + slug inexistente → NotFound, não PermissionDenied."""
    _assert_not_found(gql(authenticated_client, DELETE_HYMNBOOK, variables={"slug": MISSING_SLUG}), "deleteHymnBook")


# ---------- mutations por pk ----------

DELETE_HYMN = """
mutation($pk: ID!) {
  deleteHymn(pk: $pk) {
    __typename
    ... on NotFoundError { message }
  }
}
"""

APPROVE_AUDIO = """
mutation($pk: ID!) {
  approveAudio(pk: $pk) {
    __typename
    ... on NotFoundError { message }
  }
}
"""

REJECT_AUDIO = """
mutation($pk: ID!) {
  rejectAudio(pk: $pk) {
    __typename
    ... on NotFoundError { message }
  }
}
"""

REVIEW_AUDIO = """
mutation($pk: ID!, $input: AudioReviewInput!) {
  reviewAudio(pk: $pk, input: $input) {
    __typename
    ... on NotFoundError { message }
  }
}
"""

DELETE_AUDIO = """
mutation($pk: ID!) {
  deleteAudio(pk: $pk) {
    __typename
    ... on NotFoundError { message }
  }
}
"""


def test_delete_hymn_missing_pk(admin_client):
    _assert_not_found(gql(admin_client, DELETE_HYMN, variables={"pk": _missing_pk()}), "deleteHymn")


def test_approve_audio_missing_pk(admin_client):
    _assert_not_found(gql(admin_client, APPROVE_AUDIO, variables={"pk": _missing_pk()}), "approveAudio")


def test_reject_audio_missing_pk(admin_client):
    _assert_not_found(gql(admin_client, REJECT_AUDIO, variables={"pk": _missing_pk()}), "rejectAudio")


def test_review_audio_missing_pk(admin_client):
    data = gql(admin_client, REVIEW_AUDIO, variables={"pk": _missing_pk(), "input": {"isMatch": True}})
    _assert_not_found(data, "reviewAudio")


def test_delete_audio_missing_pk(admin_client):
    _assert_not_found(gql(admin_client, DELETE_AUDIO, variables={"pk": _missing_pk()}), "deleteAudio")


def test_delete_audio_missing_pk_for_anonymous(client):
    """Anônimo com pk inexistente: NotFound vem antes do check de autenticação."""
    _assert_not_found(gql(client, DELETE_AUDIO, variables={"pk": _missing_pk()}), "deleteAudio")
