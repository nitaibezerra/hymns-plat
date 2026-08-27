"""
Marco 1 — Ciclo 1.7.

Cobre o resolver `hymn(pk)`. Visibilidade segue o pai (HymnBook):
- anon → só vê hinos de hinários publicados
- editor → vê todos
"""

from __future__ import annotations

import pytest

from ._helpers import gql

pytestmark = pytest.mark.django_db


def test_hymn_by_pk_returns_hymn(client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory(name="O Cruzeiro", slug="cruzeiro", is_published=True)
    h = hymn_factory(hymn_book=hb, number=1, title="Lua Branca")

    data = gql(
        client,
        '{ hymn(pk: "%s") { number title } }' % h.pk,
    )
    assert "errors" not in data, data
    assert data["data"]["hymn"]["number"] == 1
    assert data["data"]["hymn"]["title"] == "Lua Branca"


def test_hymn_by_pk_returns_null_when_book_is_draft_for_anon(client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory(name="Draft", slug="draft", is_published=False)
    h = hymn_factory(hymn_book=hb, number=1, title="Hino Secreto")

    data = gql(client, '{ hymn(pk: "%s") { title } }' % h.pk)
    assert "errors" not in data, data
    assert data["data"]["hymn"] is None, "anon não deveria enxergar hino de hinário draft"
