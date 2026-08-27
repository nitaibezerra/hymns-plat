"""
Marco 4.A · Ciclo 4A.2.

Expor a coleção `HymnBookType.hymns` ordenada por `number`, mesmo padrão
usado pelos templates (sumário / corrido / carrossel).
"""

from __future__ import annotations

import pytest

from ._helpers import gql

pytestmark = pytest.mark.django_db


def test_hymnbook_hymns_returns_ordered_by_number(client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory(name="O Cruzeiro", slug="cruzeiro", is_published=True)
    # Cria fora de ordem pra garantir que a query (e não a inserção) define a ordem.
    hymn_factory(hymn_book=hb, number=3, title="Hino 3")
    hymn_factory(hymn_book=hb, number=1, title="Hino 1")
    hymn_factory(hymn_book=hb, number=2, title="Hino 2")

    data = gql(
        client,
        '{ hymnbook(slug: "cruzeiro") { hymns { number title } } }',
    )
    assert "errors" not in data, data
    numbers = [h["number"] for h in data["data"]["hymnbook"]["hymns"]]
    assert numbers == [1, 2, 3], numbers
