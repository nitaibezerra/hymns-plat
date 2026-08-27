"""
`HymnBookType.coverImage` devolve URL ABSOLUTA, independente do storage.

Mesmo defeito que `HymnAudioType.url` tinha (ver `test_hymn_audio_absolute_url.py`):
`FileField.url` é RELATIVA com `FileSystemStorage` (dev/local/CI) e ABSOLUTA com
`S3Boto3Storage` + `AWS_S3_CUSTOM_DOMAIN` (produção, `MEDIA_URL` já absoluta).
Ou seja: o acerto em produção é efeito colateral de config de storage, e trocar
o storage quebraria as capas sem aviso.

Quem consome é o `<img src>` do shell SvelteKit, servido por OUTRA origem
(`:5173` em dev, domínio próprio via `adapter-cloudflare` em produção), e URL
relativa resolve contra a origem do SHELL, não do Django.

Reusa `_absolute_media_url` + `optional_request_from_info`, criados no conserto
de `HymnAudioType.url` — mesmos três casos de contrato: relativa é completada
com o host do request; absoluta passa intacta; sem capa, segue `None`.
"""

from __future__ import annotations

import pytest
from django.test import override_settings

from ._helpers import gql

pytestmark = pytest.mark.django_db

COVER_QUERY = "query($slug: String!) { hymnbook(slug: $slug) { coverImage } }"


def _cover(client, book) -> str | None:
    data = gql(client, COVER_QUERY, variables={"slug": book.slug})
    assert "errors" not in data, data
    return data["data"]["hymnbook"]["coverImage"]


def test_relative_storage_url_becomes_absolute(client, hymn_book_factory, sample_image):
    """`FileSystemStorage` (dev/CI) dá `/media/hymn_covers/…`; a API completa o host."""
    book = hymn_book_factory(name="Com capa", slug="com-capa", cover_image=sample_image)

    cover = _cover(client, book)
    assert cover == f"http://testserver{book.cover_image.url}", cover
    assert cover.startswith("http://testserver/media/hymn_covers/"), cover


@override_settings(MEDIA_URL="https://media.hinaria.com.br/")
def test_absolute_storage_url_is_left_untouched(client, hymn_book_factory, sample_image):
    """Produção (R2 + `AWS_S3_CUSTOM_DOMAIN`) já dá absoluta — não remonta em cima."""
    book = hymn_book_factory(name="Capa R2", slug="capa-r2", cover_image=sample_image)

    cover = _cover(client, book)
    assert cover == book.cover_image.url, cover
    assert cover.startswith("https://media.hinaria.com.br/hymn_covers/"), cover


def test_hymnbook_without_cover_stays_null(client, hymn_book_factory):
    """Sem capa continua `None` — o helper não pode inventar host solto."""
    book = hymn_book_factory(name="Sem capa", slug="sem-capa")
    assert _cover(client, book) is None
