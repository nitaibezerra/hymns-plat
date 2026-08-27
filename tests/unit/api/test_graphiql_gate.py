"""
GraphiQL é servido só em DEBUG — sem quebrar o contrato do GET.

Fora de DEBUG o IDE não é servido, mas o `GET /graphql/` continua devolvendo
200 **com o cookie `csrftoken`**: é dele que a SPA tira o token antes da
primeira mutation, então devolver 404 quebraria toda escrita em produção.

Não é falha de segurança servir o IDE — query respeita `visible_to` e mutation
exige sessão + CSRF + permissão. É exposição desnecessária da superfície da
API, e o custo de desligar depois de público é bem maior.
"""

from __future__ import annotations

import pytest
from django.test import override_settings

pytestmark = pytest.mark.django_db

GRAPHQL_URL = "/graphql/"


@override_settings(DEBUG=True)
def test_ide_servido_em_debug(client):
    resposta = client.get(GRAPHQL_URL, HTTP_ACCEPT="text/html")
    assert resposta.status_code == 200
    assert b"graphiql" in resposta.content.lower()


@override_settings(DEBUG=False)
def test_ide_nao_servido_fora_de_debug(client):
    resposta = client.get(GRAPHQL_URL, HTTP_ACCEPT="text/html")
    assert resposta.status_code == 200
    assert b"graphiql" not in resposta.content.lower()


@override_settings(DEBUG=False)
def test_get_continua_semeando_o_cookie_sem_ide(client):
    """O contrato que a SPA depende: 200 + csrftoken, com ou sem IDE."""
    resposta = client.get(GRAPHQL_URL, HTTP_ACCEPT="text/html")
    assert "csrftoken" in resposta.cookies
    assert resposta.cookies["csrftoken"].value


@override_settings(DEBUG=False)
def test_post_continua_funcionando_sem_ide(client):
    resposta = client.post(
        GRAPHQL_URL,
        data={"query": "{ globalStats { hymns } }"},
        content_type="application/json",
    )
    assert resposta.status_code == 200
    assert "hymns" in resposta.json()["data"]["globalStats"]
