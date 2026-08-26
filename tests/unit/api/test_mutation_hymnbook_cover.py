"""
Marco 5.A½ · Tarefa B5 — `HymnBookInput.coverImage`.

`cover_image` está em `HymnBookForm.Meta.fields` desde sempre, mas não havia
como enviar a capa via GraphQL — o form era instanciado sem `files`. Como é
arquivo, o campo usa o scalar `Upload` e vem pelo multipart spec, igual a
`uploadAudio`.
"""

from __future__ import annotations

import io
import json

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from apps.hymns.models import HymnBook

from ._helpers import gql

pytestmark = pytest.mark.django_db


CREATE = """
mutation($input: HymnBookInput!) {
  createHymnBook(input: $input) {
    __typename
    ... on HymnBookType { slug coverImage }
    ... on PermissionDeniedError { message }
    ... on ValidationError { message field }
  }
}
"""

UPDATE = """
mutation($slug: String!, $input: HymnBookInput!) {
  updateHymnBook(slug: $slug, input: $input) {
    __typename
    ... on HymnBookType { slug coverImage }
    ... on ValidationError { message field }
  }
}
"""


def _png(name="capa.png"):
    image = Image.new("RGB", (20, 20), color="blue")
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    buf.seek(0)
    return SimpleUploadedFile(name, buf.read(), content_type="image/png")


def _post_multipart(client, query, variables, file, file_path):
    """POST multipart conforme `graphql-multipart-request-spec`.

    `file_path` é o caminho do placeholder dentro de `variables`
    (ex.: `variables.input.coverImage`).
    """
    operations = json.dumps({"query": query, "variables": variables})
    map_ = json.dumps({"0": [file_path]})
    response = client.post("/graphql/", data={"operations": operations, "map": map_, "0": file})
    assert response.status_code == 200, response.content
    return response.json()


def test_create_hymnbook_accepts_cover_image(editor_client):
    variables = {
        "input": {
            "name": "Com Capa",
            "ownerName": "Mestre",
            "coverImage": None,
        }
    }
    data = _post_multipart(editor_client, CREATE, variables, _png(), "variables.input.coverImage")
    assert "errors" not in data, data
    payload = data["data"]["createHymnBook"]
    assert payload["__typename"] == "HymnBookType", payload
    assert payload["coverImage"] is not None
    assert HymnBook.objects.get(slug=payload["slug"]).cover_image


def test_create_hymnbook_without_cover_image_stays_empty(editor_client):
    data = gql(editor_client, CREATE, variables={"input": {"name": "Sem Capa", "ownerName": "Mestre"}})
    assert "errors" not in data, data
    payload = data["data"]["createHymnBook"]
    assert payload["__typename"] == "HymnBookType", payload
    assert payload["coverImage"] is None


def test_update_hymnbook_replaces_cover_image(editor_client, hymn_book_factory):
    book = hymn_book_factory(name="Trocar", slug="trocar", cover_image=_png("antiga.png"))
    antiga = book.cover_image.name

    variables = {
        "slug": "trocar",
        "input": {"name": "Trocar", "ownerName": "Mestre Irineu", "coverImage": None},
    }
    data = _post_multipart(editor_client, UPDATE, variables, _png("nova.png"), "variables.input.coverImage")
    assert "errors" not in data, data
    assert data["data"]["updateHymnBook"]["__typename"] == "HymnBookType", data

    book.refresh_from_db()
    assert book.cover_image.name != antiga
    assert "nova" in book.cover_image.name


def test_update_hymnbook_without_cover_keeps_existing(editor_client, hymn_book_factory):
    """UNSET não pode apagar a capa — mesma regra dos outros campos opcionais."""
    book = hymn_book_factory(name="Manter", slug="manter", cover_image=_png("mantida.png"))
    antiga = book.cover_image.name

    data = gql(
        editor_client,
        UPDATE,
        variables={"slug": "manter", "input": {"name": "Manter", "ownerName": "Mestre Irineu"}},
    )
    assert "errors" not in data, data
    assert data["data"]["updateHymnBook"]["__typename"] == "HymnBookType", data

    book.refresh_from_db()
    assert book.cover_image.name == antiga
