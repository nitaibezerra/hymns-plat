"""
Marco 4.A · Ciclo 4A.8.

`Query.hourlyFeatured` espelha `_hourly_featured(visible_qs, n=6)` do monolito:
seleciona até 6 hinários visíveis com seed na hora cheia atual.
"""

from __future__ import annotations

import pytest

from ._helpers import gql

pytestmark = pytest.mark.django_db


def test_hourly_featured_returns_six_visible_hymnbooks(client, hymn_book_factory):
    for i in range(10):
        hymn_book_factory(name=f"Hinario {i:02d}", slug=f"hb-{i:02d}", is_published=True)
    # Um draft para garantir que NÃO aparece (anon).
    hymn_book_factory(name="Draft", slug="draft", is_published=False)

    data = gql(client, "{ hourlyFeatured { slug } }")
    assert "errors" not in data, data
    slugs = [row["slug"] for row in data["data"]["hourlyFeatured"]]
    assert len(slugs) == 6, slugs
    assert "draft" not in slugs, slugs
