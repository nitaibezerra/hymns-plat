"""
Marco 2 — Ciclo 2.1.

GraphQL POST precisa ser protegido por CSRF. Cliente sem token recebe 403;
cliente com token (ou cookie) consegue executar mutations/queries.

Por que isso importa: a refatoração headless mantém auth por session cookie
(decisão do Marco 2). Sem CSRF, qualquer site malicioso poderia disparar
mutations no nome do usuário logado.
"""

from __future__ import annotations

import json

import pytest
from django.test import Client

GRAPHQL_URL = "/graphql/"
QUERY = '{"query":"{ globalStats { hymnbooks } }"}'

pytestmark = pytest.mark.django_db


def test_graphql_post_blocks_without_csrf_token():
    """Cliente com enforce_csrf_checks=True e sem token recebe 403."""
    client = Client(enforce_csrf_checks=True)
    response = client.post(GRAPHQL_URL, data=QUERY, content_type="application/json")
    assert response.status_code == 403, f"esperado 403, recebi {response.status_code}: {response.content[:200]!r}"


def test_graphql_post_succeeds_with_csrf_token():
    """Cliente com CSRF token válido executa a request normalmente."""
    client = Client(enforce_csrf_checks=True)
    # Faz um GET pra setar o cookie csrftoken
    client.get(GRAPHQL_URL)
    csrftoken = client.cookies["csrftoken"].value

    response = client.post(
        GRAPHQL_URL,
        data=QUERY,
        content_type="application/json",
        HTTP_X_CSRFTOKEN=csrftoken,
    )
    assert response.status_code == 200, f"esperado 200, recebi {response.status_code}: {response.content[:200]!r}"
    body = json.loads(response.content)
    assert "errors" not in body, body
