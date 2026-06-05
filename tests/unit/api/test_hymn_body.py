"""
Patch pós-4.A: `HymnType.body` expõe `Hymn.text` pro frontend.

4.D usa `body` na `HYMNBOOK_DETAIL_QUERY` (modos corrido/carrossel renderizam
a letra). Mantemos `body` como alias estável do contrato GraphQL ainda que o
campo Django se chame `text`.
"""

from __future__ import annotations

import pytest

from ._helpers import gql

pytestmark = pytest.mark.django_db


def test_hymn_exposes_body_field(client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory(name="O Cruzeiro", slug="cruzeiro", is_published=True)
    h = hymn_factory(hymn_book=hb, number=1, title="Lua Branca", text="Lua branca de luar\nClareando o meu caminho")

    data = gql(client, '{ hymn(pk: "%s") { body } }' % h.pk)

    assert "errors" not in data, data
    assert data["data"]["hymn"]["body"] == "Lua branca de luar\nClareando o meu caminho"
