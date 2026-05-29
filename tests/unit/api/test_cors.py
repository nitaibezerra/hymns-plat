"""
Marco 2 — Ciclo 2.7.

CORS precisa permitir requests do dev server SvelteKit (`http://localhost:5173`)
e dos domínios de produção; origens não confiáveis não recebem header
`Access-Control-Allow-Origin`.
"""

from __future__ import annotations

import pytest
from django.test import Client

pytestmark = pytest.mark.django_db


def test_cors_allows_svelte_dev_origin():
    """OPTIONS preflight de localhost:5173 deve receber CORS header."""
    response = Client().options(
        "/graphql/",
        HTTP_ORIGIN="http://localhost:5173",
        HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
        HTTP_ACCESS_CONTROL_REQUEST_HEADERS="content-type,x-csrftoken",
    )
    assert response["Access-Control-Allow-Origin"] == "http://localhost:5173"
    assert "POST" in response.get("Access-Control-Allow-Methods", "")


def test_cors_blocks_untrusted_origin():
    """Origem fora da allowlist NÃO recebe Access-Control-Allow-Origin."""
    response = Client().options(
        "/graphql/",
        HTTP_ORIGIN="http://evil.example.com",
        HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
    )
    assert "Access-Control-Allow-Origin" not in response


def test_cors_allows_credentials():
    """Auth por session cookie precisa de Access-Control-Allow-Credentials: true."""
    response = Client().options(
        "/graphql/",
        HTTP_ORIGIN="http://localhost:5173",
        HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
    )
    assert response.get("Access-Control-Allow-Credentials") == "true"
