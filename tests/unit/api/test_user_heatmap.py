"""
Marco 4.A · Ciclo 4A.12.

`UserProfileType.activityHeatmap(days)` espelha o JSON exposto por
`apps/users/api_views.py::api_user_heatmap` — buckets diários do último ano
de revisões editoriais (uma entrada por dia, contagem = 0 quando não houve
revisão).
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from ._helpers import gql

pytestmark = pytest.mark.django_db


def test_activity_heatmap_returns_daily_counts(client, user_factory, hymn_book_factory, hymn_factory):
    from apps.hymns.models import HymnRevision

    target = user_factory(email="target@example.com")
    hb = hymn_book_factory(name="O Cruzeiro", slug="cruzeiro", is_published=True)
    h = hymn_factory(hymn_book=hb, number=1, title="Lua")

    today = date.today()
    # Cria 3 revisões hoje e 1 ontem.
    for _ in range(3):
        HymnRevision.objects.create(hymn=h, revised_by=target)
    # Backdate uma revisão pra ontem.
    rev = HymnRevision.objects.create(hymn=h, revised_by=target)
    HymnRevision.objects.filter(pk=rev.pk).update(revised_at=rev.revised_at - timedelta(days=1))

    data = gql(
        client,
        '{ userProfile(username: "target") { activityHeatmap(days: 30) { date count } } }',
    )
    assert "errors" not in data, data
    buckets = data["data"]["userProfile"]["activityHeatmap"]
    # Total de dias = days + 1 (inclui hoje), seguindo api_user_heatmap.
    assert len(buckets) == 31, len(buckets)
    by_date = {row["date"]: row["count"] for row in buckets}
    assert by_date[today.isoformat()] == 3, by_date
    assert by_date[(today - timedelta(days=1)).isoformat()] == 1, by_date
    # Dia sem atividade fica 0.
    assert by_date[(today - timedelta(days=5)).isoformat()] == 0, by_date
