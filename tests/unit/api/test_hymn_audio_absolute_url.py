"""
`HymnAudioType.url` devolve URL ABSOLUTA, independente do backend de storage.

Hoje o acerto em produção é acidente de configuração: `S3Boto3Storage` com
`AWS_S3_CUSTOM_DOMAIN` faz `MEDIA_URL` virar `https://media.hinaria.com.br/`, e
`FileField.url` sai absoluta de graça (medido: 124 áudios, todas absolutas). Em
dev, `FileSystemStorage` + `MEDIA_URL="/media/"` sai RELATIVA — e o `<audio src>`
do shell resolve isso contra a origem do SHELL, não do Django (medido: 404 em
`:5173`, 200 em `:9000`). Trocar o storage quebraria produção sem aviso.

Estes testes tornam o contrato explícito: relativa é completada com o host do
request; absoluta passa intacta; sem request no contexto, devolve o que o
storage deu (fallback conservador — sem request não há host confiável pra
inventar, e `manage.py export_schema` não executa resolver).
"""

from __future__ import annotations

import pytest
from django.test import override_settings

from apps.api.context import optional_request_from_info
from apps.api.types import _absolute_media_url

from ._helpers import gql

pytestmark = pytest.mark.django_db

AUDIO_PATH = "hymns/audio/2026/05/sample.mp3"


def _audio_url(client, hymn) -> str:
    data = gql(client, '{ hymn(pk: "%s") { audios { url } } }' % hymn.pk)
    assert "errors" not in data, data
    return data["data"]["hymn"]["audios"][0]["url"]


@pytest.fixture
def hymn_with_audio(hymn_book_factory, hymn_factory):
    from apps.hymns.models import HymnAudio

    hb = hymn_book_factory(name="O Cruzeiro", slug="cruzeiro", is_published=True)
    hymn = hymn_factory(hymn_book=hb, number=1, title="Lua Branca")
    HymnAudio.objects.create(hymn=hymn, audio_file=AUDIO_PATH, is_approved=True)
    return hymn


def test_relative_storage_url_becomes_absolute(client, hymn_with_audio):
    """`FileSystemStorage` (dev/CI) dá `/media/…`; a API completa com o host."""
    url = _audio_url(client, hymn_with_audio)
    assert url == f"http://testserver/media/{AUDIO_PATH}", url


@override_settings(MEDIA_URL="https://media.hinaria.com.br/")
def test_absolute_storage_url_is_left_untouched(client, hymn_with_audio):
    """Produção (R2 + `AWS_S3_CUSTOM_DOMAIN`) já dá absoluta — não remonta."""
    url = _audio_url(client, hymn_with_audio)
    assert url == f"https://media.hinaria.com.br/{AUDIO_PATH}", url


@pytest.mark.parametrize(
    "url",
    [
        f"https://media.hinaria.com.br/{AUDIO_PATH}",
        f"http://media.hinaria.com.br/{AUDIO_PATH}",
        f"//media.hinaria.com.br/{AUDIO_PATH}",
    ],
)
def test_absolute_url_survives_without_request(url):
    """Sem request no contexto, absoluta segue absoluta."""
    assert _absolute_media_url(None, url) == url


def test_relative_url_without_request_falls_back_to_the_storage_url():
    """Fallback ESCOLHIDO: devolve o que o storage deu, em vez de inventar host.

    Acontece em execução direta de `schema.execute_sync` sem `context_value`
    (o `export_schema` nem chega a executar resolver). Sem request não há host
    confiável — `ALLOWED_HOSTS` tem `*` em vários ambientes — e chutar um host
    errado produz link quebrado que parece certo. Devolver a relativa mantém o
    comportamento anterior nesse canto, e é o único caso em que ele sobrevive.
    """
    assert _absolute_media_url(None, "/media/x.mp3") == "/media/x.mp3"


def test_empty_url_stays_empty():
    """Áudio sem arquivo continua devolvendo string vazia, não host solto."""
    assert _absolute_media_url(None, "") == ""


class _FakeInfo:
    """Stand-in do `Info` do Strawberry — aqui só o `.context` importa."""

    def __init__(self, context):
        self.context = context


class _ObjectContext:
    """Contexto no formato OBJETO (`.request`) — uma das duas formas que a
    integração Django do Strawberry entrega, dependendo da versão."""

    def __init__(self, request):
        self.request = request


@pytest.mark.parametrize("context", [None, {}, {"request": None}, _ObjectContext(None), object()])
def test_optional_request_from_info_returns_none_when_absent(context):
    """O extrator do contexto não estoura quando não há request."""
    assert optional_request_from_info(_FakeInfo(context)) is None


def test_optional_request_from_info_reads_both_context_shapes(rf):
    """Dict e objeto com `.request` — as duas formas que o Strawberry entrega."""
    request = rf.get("/graphql/")
    assert optional_request_from_info(_FakeInfo({"request": request})) is request
    assert optional_request_from_info(_FakeInfo(_ObjectContext(request))) is request
