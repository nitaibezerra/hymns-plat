"""
Marco 5.A — Ciclos 5A.19 a 5A.20.

Queries específicas do workspace editorial: lista de hinários (com sort/filter),
dashboard stats, áudios pendentes, publish readiness, OCR task, e novos campos
em HymnType (inline_diff, revisions, common_*).
"""

from __future__ import annotations

import pytest

from apps.hymns.models import Hymn, HymnBook, HymnRevision

from ._helpers import gql

pytestmark = pytest.mark.django_db


# ---------- Ciclo 5A.19 — editorHymnbooks ----------

EDITOR_HYMNBOOKS = """
query($sort: [SortInput!], $priority: String) {
  editorHymnbooks(sort: $sort, priority: $priority) {
    slug
    priority
  }
}
"""


def test_editor_hymnbooks_query_superuser_sees_all(admin_client, hymn_book_factory):
    hymn_book_factory(name="A", slug="a", is_published=False)
    hymn_book_factory(name="B", slug="b", is_published=True)

    data = gql(admin_client, EDITOR_HYMNBOOKS)
    assert "errors" not in data, data
    slugs = {row["slug"] for row in data["data"]["editorHymnbooks"]}
    assert slugs == {"a", "b"}


def test_editor_hymnbooks_sort_by_review_pct_desc(editor_client, hymn_book_factory, hymn_factory):
    """Sort por review_pct desc: hinário com mais hinos revisados vem primeiro."""
    high = hymn_book_factory(name="High", slug="high")
    low = hymn_book_factory(name="Low", slug="low")
    h1 = hymn_factory(hymn_book=high, number=1)
    h1.review_status = Hymn.ReviewStatus.REVIEWED
    h1.save()
    h2 = hymn_factory(hymn_book=high, number=2)
    h2.review_status = Hymn.ReviewStatus.REVIEWED
    h2.save()
    hymn_factory(hymn_book=low, number=1)  # 0% revisado

    data = gql(
        editor_client,
        EDITOR_HYMNBOOKS,
        variables={"sort": [{"column": "review_pct", "direction": "desc"}]},
    )
    assert "errors" not in data, data
    slugs = [row["slug"] for row in data["data"]["editorHymnbooks"]]
    assert slugs.index("high") < slugs.index("low")


def test_editor_hymnbooks_filter_by_priority_p1(editor_client, hymn_book_factory):
    hymn_book_factory(name="Urgente", slug="urgente", priority=HymnBook.Priority.P1)
    hymn_book_factory(name="Normal", slug="normal", priority=HymnBook.Priority.P3)

    data = gql(editor_client, EDITOR_HYMNBOOKS, variables={"priority": "P1"})
    assert "errors" not in data, data
    rows = data["data"]["editorHymnbooks"]
    assert len(rows) == 1
    assert rows[0]["slug"] == "urgente"
    assert rows[0]["priority"] == "P1"
