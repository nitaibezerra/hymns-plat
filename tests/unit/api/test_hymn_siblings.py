"""
Marco 4.A · Ciclo 4A.6.

`HymnType.siblingsWithSameNumber`: outros hinos com o mesmo `number` em
hinários `visible_to(user)`. Útil para a "Disambiguação" do detalhe de hino
no monolito. Visibilidade gateada pelo manager existente — anon não enxerga
hinos em hinários draft.
"""

from __future__ import annotations

import pytest

from ._helpers import gql

pytestmark = pytest.mark.django_db


def test_siblings_with_same_number_respects_visibility(client, editor_client, hymn_book_factory, hymn_factory):
    hb_a = hymn_book_factory(name="A", slug="a", is_published=True)
    hb_b = hymn_book_factory(name="B", slug="b", is_published=True)
    hb_c_draft = hymn_book_factory(name="Draft C", slug="c", is_published=False)

    h_a = hymn_factory(hymn_book=hb_a, number=7, title="Sete em A")
    h_b = hymn_factory(hymn_book=hb_b, number=7, title="Sete em B")
    h_c = hymn_factory(hymn_book=hb_c_draft, number=7, title="Sete em C (draft)")

    # `client` e `editor_client` compartilham a mesma instância no pytest-django.
    # Logout explícito antes da consulta anônima.
    client.logout()

    # Anon vendo A: só enxerga B (C é draft).
    q = '{ hymn(pk: "%s") { siblingsWithSameNumber { id title } } }'
    data_anon = gql(client, q % h_a.pk)
    assert "errors" not in data_anon, data_anon
    ids_anon = {row["id"] for row in data_anon["data"]["hymn"]["siblingsWithSameNumber"]}
    assert ids_anon == {str(h_b.id)}, ids_anon

    # O próprio hino NÃO entra na lista.
    titles_anon = {row["title"] for row in data_anon["data"]["hymn"]["siblingsWithSameNumber"]}
    assert "Sete em A" not in titles_anon

    # Editor vê também o draft. Re-login porque dividimos a Client.
    editor_client.force_login(editor_client.user)
    data_editor = gql(editor_client, q % h_a.pk)
    assert "errors" not in data_editor, data_editor
    ids_editor = {row["id"] for row in data_editor["data"]["hymn"]["siblingsWithSameNumber"]}
    assert ids_editor == {str(h_b.id), str(h_c.id)}, ids_editor
