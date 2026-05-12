"""
Marco 1 — Ciclos 1.1 a 1.3.

Cobre a existência do endpoint /graphql/ e a presença dos tipos básicos no
schema via introspection. Não testa resolvers de domínio (isso fica nos arquivos
test_query_*.py).
"""

from __future__ import annotations

import pytest

from ._helpers import gql

pytestmark = pytest.mark.django_db


# Ciclo 1.1 — endpoint existe e responde a introspection
def test_graphql_endpoint_returns_200_on_introspection(client):
    data = gql(client, "{ __schema { queryType { name } } }")
    assert "errors" not in data, data
    assert data["data"]["__schema"]["queryType"]["name"] == "Query"


# Ciclo 1.2 — HymnBookType existe no schema
def test_introspection_lists_hymnbook_type(client):
    data = gql(
        client,
        """
        {
          __type(name: "HymnBookType") {
            name
            fields { name }
          }
        }
        """,
    )
    assert data["data"]["__type"] is not None, "HymnBookType não está no schema"
    field_names = {f["name"] for f in data["data"]["__type"]["fields"]}
    assert {"id", "name", "slug"}.issubset(field_names), f"campos faltando: {field_names}"


# Ciclo 1.3 — HymnType e HymnAudioType existem no schema
def test_introspection_lists_hymn_and_hymnaudio_types(client):
    data = gql(
        client,
        """
        {
          hymn: __type(name: "HymnType") { name fields { name } }
          audio: __type(name: "HymnAudioType") { name fields { name } }
        }
        """,
    )
    assert data["data"]["hymn"] is not None, "HymnType não está no schema"
    assert data["data"]["audio"] is not None, "HymnAudioType não está no schema"

    hymn_fields = {f["name"] for f in data["data"]["hymn"]["fields"]}
    assert {"id", "number", "title"}.issubset(hymn_fields), f"HymnType campos: {hymn_fields}"

    audio_fields = {f["name"] for f in data["data"]["audio"]["fields"]}
    assert "id" in audio_fields, f"HymnAudioType campos: {audio_fields}"
