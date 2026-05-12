"""
Helpers compartilhados pelos testes da API GraphQL.

`gql(client, query, variables=None, user=None)` faz POST em /graphql/ retornando
o JSON decodificado. Se `user` for passado, força o login antes (a auth real é
testada em Marco 2; aqui só queremos um shortcut pra testar resolvers que
diferenciam anon vs autenticado).
"""

from __future__ import annotations

import json
from typing import Any

GRAPHQL_URL = "/graphql/"


def gql(client, query: str, variables: dict[str, Any] | None = None, user=None) -> dict:
    """Executa uma operação GraphQL e devolve o JSON da resposta."""
    if user is not None:
        client.force_login(user)
    payload: dict[str, Any] = {"query": query}
    if variables is not None:
        payload["variables"] = variables
    response = client.post(GRAPHQL_URL, data=json.dumps(payload), content_type="application/json")
    assert response.status_code == 200, f"GraphQL HTTP {response.status_code}: {response.content!r}"
    return response.json()
