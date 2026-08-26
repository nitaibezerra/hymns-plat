"""
Marco 2 — Ciclo 2.1, revisto no Marco 4 (Frente 1).

Regra vigente, fixada em `_plan/plano-headless-graphql.md` ("Decisões fixas"):
**query não exige CSRF; mutation exige.**

Por que mudou: o endpoint GraphQL inteiro estava embrulhado em CSRF de
middleware, então TODO POST pedia cookie `csrftoken` + header `X-CSRFToken`.
O SSR do SvelteKit roda em Node, sem cookie jar, e recebia 403 em toda rota
— nenhum dado real chegava ao shell. Leitura pública não é operação com
efeito colateral: não precisa de token. Mutation continua precisando, porque
aí sim um site malicioso poderia agir no nome de quem está logado.

GraphQL é um endpoint POST único, logo o gate não pode ser por método HTTP:
ele olha o **tipo da operação que vai executar** (respeitando `operationName`).
"""

from __future__ import annotations

import json

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client

from apps.hymns.models import HymnAudio

GRAPHQL_URL = "/graphql/"
QUERY = '{"query":"{ globalStats { hymnbooks } }"}'
MUTATION = '{"query":"mutation { logout }"}'

# Documento com as duas operações: o gate tem que olhar a que `operationName`
# seleciona, não a primeira do documento.
MIXED_DOC = """
query Stats { globalStats { hymnbooks } }
mutation Sair { logout }
"""

pytestmark = pytest.mark.django_db


def _post(client: Client, payload: str, **extra):
    return client.post(GRAPHQL_URL, data=payload, content_type="application/json", **extra)


def _seed_csrftoken(client: Client) -> str:
    """GET no endpoint semeia o cookie `csrftoken` e devolve o valor."""
    client.get(GRAPHQL_URL, HTTP_ACCEPT="text/html")
    return client.cookies["csrftoken"].value


# --- Query: liberada (teste-âncora do conserto do 403 do SSR) ---


def test_graphql_query_passes_without_any_csrf_token():
    """Query sem cookie nem header responde 200 com dados — este é o caso do SSR."""
    client = Client(enforce_csrf_checks=True)
    response = _post(client, QUERY)
    assert response.status_code == 200, f"esperado 200, recebi {response.status_code}: {response.content[:200]!r}"
    body = json.loads(response.content)
    assert "errors" not in body, body
    assert body["data"]["globalStats"]["hymnbooks"] == 0


def test_graphql_query_with_valid_token_still_passes():
    """Query com token válido não regride (cliente browser mandando o header)."""
    client = Client(enforce_csrf_checks=True)
    csrftoken = _seed_csrftoken(client)
    response = _post(client, QUERY, HTTP_X_CSRFTOKEN=csrftoken)
    assert response.status_code == 200, f"esperado 200, recebi {response.status_code}: {response.content[:200]!r}"
    assert "errors" not in json.loads(response.content)


# --- Mutation: protegida ---


def test_graphql_mutation_blocks_without_csrf_token():
    """Mutation sem token é rejeitada pelo verificador do Django (403)."""
    client = Client(enforce_csrf_checks=True)
    response = _post(client, MUTATION)
    assert response.status_code == 403, f"esperado 403, recebi {response.status_code}: {response.content[:200]!r}"


def test_graphql_mutation_passes_with_cookie_and_header():
    """Mutation com cookie + header executa normalmente."""
    client = Client(enforce_csrf_checks=True)
    csrftoken = _seed_csrftoken(client)
    response = _post(client, MUTATION, HTTP_X_CSRFTOKEN=csrftoken)
    assert response.status_code == 200, f"esperado 200, recebi {response.status_code}: {response.content[:200]!r}"
    body = json.loads(response.content)
    assert "errors" not in body, body
    assert body["data"]["logout"] is True


# --- O gate olha a operação selecionada, não a primeira do documento ---


def test_gate_follows_operation_name_query_in_mixed_document():
    """Documento com query E mutation, `operationName` apontando a query: passa."""
    client = Client(enforce_csrf_checks=True)
    payload = json.dumps({"query": MIXED_DOC, "operationName": "Stats"})
    response = _post(client, payload)
    assert response.status_code == 200, f"esperado 200, recebi {response.status_code}: {response.content[:200]!r}"
    body = json.loads(response.content)
    assert "errors" not in body, body
    assert "globalStats" in body["data"]


def test_gate_follows_operation_name_mutation_in_mixed_document():
    """Mesmo documento, `operationName` apontando a mutation: bloqueado sem token.

    Se o gate olhasse a PRIMEIRA operação do documento (a query), a mutation
    passaria sem CSRF — exatamente o buraco que este teste fecha.
    """
    client = Client(enforce_csrf_checks=True)
    payload = json.dumps({"query": MIXED_DOC, "operationName": "Sair"})
    response = _post(client, payload)
    assert response.status_code == 403, f"esperado 403, recebi {response.status_code}: {response.content[:200]!r}"


def test_gate_is_fail_closed_when_operation_is_undeterminable():
    """Documento com duas operações e sem `operationName`: exige token.

    Não sabemos qual seria executada (o graphql-core nem executaria), então a
    decisão segura é pedir o token em vez de deixar passar.
    """
    client = Client(enforce_csrf_checks=True)
    payload = json.dumps({"query": MIXED_DOC})
    response = _post(client, payload)
    assert response.status_code == 403, f"esperado 403, recebi {response.status_code}: {response.content[:200]!r}"


# --- Multipart (`uploadAudio`): o gate lê o corpo sem consumir o arquivo ---

UPLOAD_MUTATION = """
mutation($hymnPk: ID!, $file: Upload!) {
  uploadAudio(hymnPk: $hymnPk, file: $file) {
    __typename
    ... on HymnAudioType { id }
  }
}
"""


def _post_upload(client: Client, hymn_pk: str, **extra):
    """POST multipart conforme `graphql-multipart-request-spec`."""
    operations = json.dumps({"query": UPLOAD_MUTATION, "variables": {"hymnPk": hymn_pk, "file": None}})
    return client.post(
        GRAPHQL_URL,
        data={
            "operations": operations,
            "map": json.dumps({"0": ["variables.file"]}),
            "0": SimpleUploadedFile("audio.mp3", b"\x00" * 1024, content_type="audio/mpeg"),
        },
        **extra,
    )


def test_multipart_mutation_blocks_without_csrf_token(hymn):
    """O gate enxerga a mutation dentro do campo `operations` do multipart."""
    client = Client(enforce_csrf_checks=True)
    response = _post_upload(client, str(hymn.pk))
    assert response.status_code == 403, f"esperado 403, recebi {response.status_code}: {response.content[:200]!r}"
    assert not HymnAudio.objects.exists()


def test_multipart_mutation_succeeds_with_csrf_token(hymn, user_factory):
    """Com token, o upload conclui — o corpo é parseado uma vez e o arquivo
    chega inteiro ao resolver (o gate não pode consumir o stream)."""
    client = Client(enforce_csrf_checks=True)
    client.force_login(user_factory(email="quem.envia@example.com"))
    csrftoken = _seed_csrftoken(client)

    response = _post_upload(client, str(hymn.pk), HTTP_X_CSRFTOKEN=csrftoken)
    assert response.status_code == 200, f"esperado 200, recebi {response.status_code}: {response.content[:200]!r}"
    body = json.loads(response.content)
    assert "errors" not in body, body
    assert body["data"]["uploadAudio"]["__typename"] == "HymnAudioType"

    audio = HymnAudio.objects.get()
    assert audio.file_size == 1024, "o arquivo chegou truncado ao resolver"


# --- GET continua semeando o cookie (GraphiQL / primeiro load) ---


def test_get_seeds_csrftoken_cookie():
    """`Accept: text/html` é o carregamento do GraphiQL — e sai com o cookie."""
    client = Client(enforce_csrf_checks=True)
    response = client.get(GRAPHQL_URL, HTTP_ACCEPT="text/html")
    assert response.status_code == 200, response.status_code
    assert "csrftoken" in response.cookies, f"cookies recebidos: {list(response.cookies)}"
    assert response.cookies["csrftoken"].value
