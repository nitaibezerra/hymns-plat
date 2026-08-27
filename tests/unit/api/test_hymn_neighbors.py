"""
Marco 4.A · Ciclo 4A.5.

`HymnType.previousInBook` / `HymnType.nextInBook`: navegação pelo número
dentro do mesmo hinário, com fallback `None` nos extremos. Reproduz o que
`HymnDetailView.get_context_data` monta no monolito.
"""

from __future__ import annotations

import pytest

from ._helpers import gql

pytestmark = pytest.mark.django_db


def _setup_three(hymn_book_factory, hymn_factory):
    hb = hymn_book_factory(name="O Cruzeiro", slug="cruzeiro", is_published=True)
    h1 = hymn_factory(hymn_book=hb, number=1, title="Hino 1")
    h2 = hymn_factory(hymn_book=hb, number=2, title="Hino 2")
    h3 = hymn_factory(hymn_book=hb, number=3, title="Hino 3")
    return h1, h2, h3


def test_previous_in_book(client, hymn_book_factory, hymn_factory):
    h1, h2, h3 = _setup_three(hymn_book_factory, hymn_factory)

    q = '{ hymn(pk: "%s") { previousInBook { number } } }'
    data_first = gql(client, q % h1.pk)
    assert "errors" not in data_first, data_first
    assert data_first["data"]["hymn"]["previousInBook"] is None

    data_middle = gql(client, q % h2.pk)
    assert "errors" not in data_middle, data_middle
    assert data_middle["data"]["hymn"]["previousInBook"]["number"] == 1


def test_next_in_book(client, hymn_book_factory, hymn_factory):
    h1, h2, h3 = _setup_three(hymn_book_factory, hymn_factory)

    q = '{ hymn(pk: "%s") { nextInBook { number } } }'
    data_last = gql(client, q % h3.pk)
    assert "errors" not in data_last, data_last
    assert data_last["data"]["hymn"]["nextInBook"] is None

    data_middle = gql(client, q % h2.pk)
    assert "errors" not in data_middle, data_middle
    assert data_middle["data"]["hymn"]["nextInBook"]["number"] == 3
