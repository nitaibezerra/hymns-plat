"""
Marco 5.A½ · Tarefa B5 — `HymnType.hymnBook`.

Não existia NENHUMA referência do hino para o hinário no schema: busca e
"mesmo número em outros hinários" não conseguiam dizer de qual hinário cada
hino é. Sem isso o frontend do Marco 5 não monta nem o breadcrumb.
"""

from __future__ import annotations

import pytest

from ._helpers import gql

pytestmark = pytest.mark.django_db


def test_hymn_exposes_hymn_book(client, hymn_book_factory, hymn_factory):
    book = hymn_book_factory(name="O Cruzeiro", slug="o-cruzeiro")
    hymn = hymn_factory(hymn_book=book, number=7, title="Lua Branca")

    data = gql(client, "{ hymn(pk: %s) { hymnBook { slug name } } }" % f'"{hymn.pk}"')
    assert "errors" not in data, data
    assert data["data"]["hymn"]["hymnBook"] == {"slug": "o-cruzeiro", "name": "O Cruzeiro"}


def test_siblings_with_same_number_carry_their_hymn_book(client, hymn_book_factory, hymn_factory):
    """O caso que motivou o campo: desambiguar "este número aparece também em…"."""
    a = hymn_book_factory(name="Hinario A", slug="hinario-a")
    b = hymn_book_factory(name="Hinario B", slug="hinario-b")
    hymn = hymn_factory(hymn_book=a, number=3, title="Hino 3")
    hymn_factory(hymn_book=b, number=3, title="Outro Hino 3")

    query = """
    query($pk: ID!) {
      hymn(pk: $pk) {
        siblingsWithSameNumber { title hymnBook { slug } }
      }
    }
    """
    data = gql(client, query, variables={"pk": str(hymn.pk)})
    assert "errors" not in data, data
    siblings = data["data"]["hymn"]["siblingsWithSameNumber"]
    assert [s["hymnBook"]["slug"] for s in siblings] == ["hinario-b"]


def test_search_results_carry_hymn_book(client, hymn_book_factory, hymn_factory):
    book = hymn_book_factory(name="O Justiceiro", slug="o-justiceiro")
    hymn_factory(hymn_book=book, number=1, title="Lua Branca", text="Lua branca da luz serena")

    query = """
    query($q: String!) {
      search(q: $q) { hymns { title hymnBook { slug } } }
    }
    """
    data = gql(client, query, variables={"q": "Lua Branca"})
    assert "errors" not in data, data
    hymns = data["data"]["search"]["hymns"]
    assert hymns, data
    assert hymns[0]["hymnBook"]["slug"] == "o-justiceiro"
