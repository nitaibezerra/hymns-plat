"""
`UserType.email` só é visível pro próprio dono e pra staff.

Antes o campo era `strawberry.auto`, isto é `String!` sem gate nenhum, e
qualquer anônimo lia o e-mail de qualquer usuário com
`userProfile(username:"x"){ user{ email } }`. Medido em produção em 2026-08-27,
com o endpoint GraphQL público havia cerca de uma hora.

A régua é a página de perfil do Django (fonte de verdade de produto até o
Marco 7): ela é pública — responde 200 pra anônimo — e **não mostra e-mail
nenhum**, conferido no HTML servido. O dado nunca foi público por decisão;
ficou exposto porque `auto` inclui tudo.
"""

from __future__ import annotations

import pytest

from ._helpers import gql

pytestmark = pytest.mark.django_db

QUERY = """
  query Perfil($u: String!) {
    userProfile(username: $u) { user { username email } }
  }
"""


def _perfil(client, username):
    resposta = gql(client, QUERY, {"u": username})
    assert "errors" not in resposta, resposta["errors"]
    return resposta["data"]["userProfile"]["user"]


def _email(client, username):
    return _perfil(client, username)["email"]


def test_anonimo_nao_ve_email_de_ninguem(client, user_factory):
    user_factory(email="alvo@example.com")
    assert _email(client, "alvo") is None


def test_terceiro_logado_nao_ve_email_alheio(authenticated_client, user_factory):
    user_factory(email="alvo@example.com")
    assert _email(authenticated_client, "alvo") is None


def test_dono_ve_o_proprio_email(client, user_factory):
    dono = user_factory(email="dono@example.com")
    client.force_login(dono)
    assert _email(client, "dono") == "dono@example.com"


def test_staff_ve_email_de_terceiro(client, user_factory):
    user_factory(email="alvo@example.com")
    staff = user_factory(email="mod@example.com", is_staff=True)
    client.force_login(staff)
    assert _email(client, "alvo") == "alvo@example.com"


def test_username_continua_publico(client, user_factory):
    """O gate é só do e-mail: o resto do perfil público não regride."""
    user_factory(email="alvo@example.com")
    assert _perfil(client, "alvo")["username"] == "alvo"
