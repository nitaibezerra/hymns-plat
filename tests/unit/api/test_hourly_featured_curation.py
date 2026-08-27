"""
Marco 5.A½ · Tarefa B4 — curadoria da home via GraphQL.

`apps/hymns/featured.py` era cópia DEGRADADA de `views.py::_hourly_featured`:
perdeu o passo que embaralha `is_featured=True` primeiro. Consequência prática:
`updateHymnBookEditorial` deixava o staff destacar um hinário e isso não
afetava a home servida pelo GraphQL. Aqui a regra volta a ser uma só.
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest import mock

import pytest

from ._helpers import gql

pytestmark = pytest.mark.django_db


HOURLY_FEATURED = "{ hourlyFeatured { slug isFeatured } }"

# Hora cheia fixa: com a seed determinística, a seleção não oscila entre runs.
FIXED_HOUR = datetime(2026, 8, 26, 14, 0, 0, tzinfo=timezone.utc)


def test_hourly_featured_puts_is_featured_first(client, hymn_book_factory):
    """Um único hinário destacado entre 20 comuns tem que sair na 1ª posição."""
    hymn_book_factory(name="Destaque", slug="destaque", is_featured=True)
    for i in range(20):
        hymn_book_factory(name=f"Comum {i:02d}", slug=f"comum-{i:02d}", is_featured=False)

    with mock.patch("apps.hymns.featured.timezone.now", return_value=FIXED_HOUR):
        data = gql(client, HOURLY_FEATURED)
    assert "errors" not in data, data
    rows = data["data"]["hourlyFeatured"]
    assert rows[0]["slug"] == "destaque", rows


def test_hourly_featured_fills_all_six_slots_with_featured_when_available(client, hymn_book_factory):
    """6 destacados + 20 comuns → os 6 devolvidos são todos destacados.

    Asserção robusta a qualquer seed: um sample puro sobre 26 hinários
    praticamente nunca devolveria só os 6 destacados.
    """
    for i in range(6):
        hymn_book_factory(name=f"Destaque {i}", slug=f"destaque-{i}", is_featured=True)
    for i in range(20):
        hymn_book_factory(name=f"Comum {i:02d}", slug=f"comum-{i:02d}", is_featured=False)

    data = gql(client, HOURLY_FEATURED)
    assert "errors" not in data, data
    rows = data["data"]["hourlyFeatured"]
    assert len(rows) == 6, rows
    assert all(row["isFeatured"] for row in rows), rows


def test_hourly_featured_completes_with_non_featured(client, hymn_book_factory):
    """Menos destacados que `n`: completa com os demais, destacados na frente."""
    hymn_book_factory(name="Destaque", slug="destaque", is_featured=True)
    for i in range(5):
        hymn_book_factory(name=f"Comum {i}", slug=f"comum-{i}", is_featured=False)

    with mock.patch("apps.hymns.featured.timezone.now", return_value=FIXED_HOUR):
        data = gql(client, HOURLY_FEATURED)
    assert "errors" not in data, data
    rows = data["data"]["hourlyFeatured"]
    assert len(rows) == 6, rows
    assert rows[0]["slug"] == "destaque"
    assert [row["isFeatured"] for row in rows[1:]] == [False] * 5


def test_hourly_featured_respects_visibility_for_anonymous(client, hymn_book_factory):
    """Destacar um rascunho não o vaza pra anônimo — `visible_to` continua manda."""
    hymn_book_factory(name="Rascunho", slug="rascunho", is_featured=True, is_published=False)
    hymn_book_factory(name="Publico", slug="publico", is_published=True)

    data = gql(client, HOURLY_FEATURED)
    assert "errors" not in data, data
    slugs = [row["slug"] for row in data["data"]["hourlyFeatured"]]
    assert slugs == ["publico"], slugs
