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


def test_editor_hymnbooks_sort_by_review_desc(editor_client, hymn_book_factory, hymn_factory):
    """Sort por `review` desc: hinário com mais hinos revisados vem primeiro.

    Tarefa B3 renomeou a coluna de `review_pct` para `review` — vocabulário
    dos chips da URL do workspace. Cobertura exaustiva das 4 chaves fica em
    `test_query_editor_sort.py`."""
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
        variables={"sort": [{"column": "review", "direction": "desc"}]},
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


# ---------- Ciclo 5A.20 — queries menores ----------

DASHBOARD_QUERY = """
{
  editorDashboardStats {
    totalHinarios
    pendingHymns
    recentReviewed7d
    p1Count
    pendingAudiosCount
    resumeHymn { id title }
  }
}
"""


def test_editor_dashboard_stats_correct_counts(editor_client, hymn_book_factory, hymn_factory):
    """Stats agregadas: total hinários · hinos pendentes · revisados 7d · P1 ·
    áudios pendentes · resumeHymn."""
    from apps.hymns.models import HymnAudio

    hb = hymn_book_factory(name="A", slug="a", priority=HymnBook.Priority.P1)
    hb2 = hymn_book_factory(name="B", slug="b", priority=HymnBook.Priority.P3)
    h1 = hymn_factory(hymn_book=hb, number=1)  # pendente
    hymn_factory(hymn_book=hb2, number=1)  # pendente
    # Áudio pendente
    HymnAudio.objects.create(hymn=h1, audio_file="x.mp3", is_approved=False)

    data = gql(editor_client, DASHBOARD_QUERY)
    assert "errors" not in data, data
    stats = data["data"]["editorDashboardStats"]
    assert stats["totalHinarios"] == 2
    assert stats["pendingHymns"] == 2
    assert stats["p1Count"] == 1
    assert stats["pendingAudiosCount"] == 1


PENDING_AUDIOS_QUERY = """
{ pendingAudios { id } }
"""


def test_pending_audios_editor_sees_all(editor_client, hymn_book_factory, hymn_factory):
    from apps.hymns.models import HymnAudio

    hb = hymn_book_factory()
    h = hymn_factory(hymn_book=hb)
    pending = HymnAudio.objects.create(hymn=h, audio_file="p.mp3", is_approved=False)
    HymnAudio.objects.create(hymn=h, audio_file="ok.mp3", is_approved=True)

    data = gql(editor_client, PENDING_AUDIOS_QUERY)
    assert "errors" not in data, data
    ids = {row["id"] for row in data["data"]["pendingAudios"]}
    assert ids == {str(pending.id)}


PUBLISH_READINESS_QUERY = """
query($slug: String!) {
  publishReadiness(slug: $slug) {
    canPublish
    checks { key label ok }
  }
}
"""


def test_publish_readiness_query_returns_checks(editor_client, hymn_book_factory):
    hb = hymn_book_factory(name="ToCheck", slug="to-check", is_published=False, description="")
    data = gql(editor_client, PUBLISH_READINESS_QUERY, variables={"slug": hb.slug})
    assert "errors" not in data, data
    result = data["data"]["publishReadiness"]
    assert result["canPublish"] is False
    keys = {c["key"] for c in result["checks"]}
    # publish_readiness sempre retorna 4 checks com essas keys
    assert keys == {"reviewed", "metadata", "owner", "audit"}


INLINE_DIFF_QUERY = """
query($pk: ID!) {
  hymn(pk: $pk) {
    inlineDiff { lines { kind } }
  }
}
"""


def test_hymn_type_exposes_inline_diff(editor_client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory(is_published=True)
    h = hymn_factory(hymn_book=hb, text="texto revisado")
    h.ocr_text = "texto original"
    h.save()

    data = gql(editor_client, INLINE_DIFF_QUERY, variables={"pk": str(h.pk)})
    assert "errors" not in data, data
    diff = data["data"]["hymn"]["inlineDiff"]
    assert diff is not None
    # Tem ao menos uma linha (a única do texto)
    assert len(diff["lines"]) >= 1


REVISIONS_QUERY = """
query($pk: ID!) {
  hymn(pk: $pk) {
    revisions { id }
  }
}
"""


def test_hymn_type_exposes_revisions(editor_client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory(is_published=True)
    h = hymn_factory(hymn_book=hb, title="Original")
    h.title = "Mudado"
    h.save()  # dispara signal -> cria HymnRevision

    data = gql(editor_client, REVISIONS_QUERY, variables={"pk": str(h.pk)})
    assert "errors" not in data, data
    revs = data["data"]["hymn"]["revisions"]
    assert len(revs) >= 1
    # E confere que existe a revisão no DB também
    assert HymnRevision.objects.filter(hymn=h).count() >= 1
