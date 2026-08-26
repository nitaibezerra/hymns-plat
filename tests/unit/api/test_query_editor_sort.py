"""
Marco 5.A½ · Tarefa B3 — vocabulário de sort do dashboard editorial.

`editorHymnbooks` tinha vocabulário próprio (`review_pct`, `name`, `priority`,
`created_at`), o que deixava `audio` (audio_pct) e `comp` (style_pct+reps_pct)
INALCANÇÁVEIS via GraphQL — justamente as métricas dos chips de sort do 5.B.
Passa a aceitar as 4 chaves da URL do workspace (`review`, `audio`, `comp`,
`recent`) reusando `_parse_sort`/`_sort_expression` de `editor_views.py`, e
aplica a regra de prioridade como sort PRIMÁRIO quando `priority=all`.
"""

from __future__ import annotations

import pytest

from apps.hymns.models import Hymn, HymnAudio, HymnBook

from ._helpers import gql

pytestmark = pytest.mark.django_db


EDITOR_HYMNBOOKS = """
query($sort: [SortInput!], $priority: String) {
  editorHymnbooks(sort: $sort, priority: $priority) {
    slug
    priority
    reviewProgress { reviewPct audioPct stylePct repsPct }
  }
}
"""


def _slugs(client, sort=None, priority=None):
    variables = {}
    if sort is not None:
        variables["sort"] = sort
    if priority is not None:
        variables["priority"] = priority
    data = gql(client, EDITOR_HYMNBOOKS, variables=variables or None)
    assert "errors" not in data, data
    return [row["slug"] for row in data["data"]["editorHymnbooks"]]


def _reviewed(hymn):
    hymn.review_status = Hymn.ReviewStatus.REVIEWED
    hymn.save()
    return hymn


# ---------- chave `review` ----------


@pytest.fixture
def review_books(hymn_book_factory, hymn_factory):
    """`alfa` 100% revisado, `zulu` 0% — nomes invertidos em relação ao pct
    pra que o tie-breaker por `name` não mascare o sort."""
    alfa = hymn_book_factory(name="Alfa", slug="alfa")
    zulu = hymn_book_factory(name="Zulu", slug="zulu")
    _reviewed(hymn_factory(hymn_book=alfa, number=1))
    hymn_factory(hymn_book=zulu, number=1)
    return alfa, zulu


def test_sort_by_review_asc(editor_client, review_books):
    assert _slugs(editor_client, sort=[{"column": "review", "direction": "asc"}]) == ["zulu", "alfa"]


def test_sort_by_review_desc(editor_client, review_books):
    assert _slugs(editor_client, sort=[{"column": "review", "direction": "desc"}]) == ["alfa", "zulu"]


# ---------- chave `audio` ----------


@pytest.fixture
def audio_books(hymn_book_factory, hymn_factory):
    alfa = hymn_book_factory(name="Alfa", slug="alfa")
    zulu = hymn_book_factory(name="Zulu", slug="zulu")
    hymn = hymn_factory(hymn_book=alfa, number=1)
    HymnAudio.objects.create(hymn=hymn, audio_file="a.mp3", is_approved=True)
    hymn_factory(hymn_book=zulu, number=1)
    return alfa, zulu


def test_sort_by_audio_asc(editor_client, audio_books):
    assert _slugs(editor_client, sort=[{"column": "audio", "direction": "asc"}]) == ["zulu", "alfa"]


def test_sort_by_audio_desc(editor_client, audio_books):
    assert _slugs(editor_client, sort=[{"column": "audio", "direction": "desc"}]) == ["alfa", "zulu"]


# ---------- chave `comp` (style_pct + reps_pct) ----------


@pytest.fixture
def comp_books(hymn_book_factory, hymn_factory):
    alfa = hymn_book_factory(name="Alfa", slug="alfa")
    zulu = hymn_book_factory(name="Zulu", slug="zulu")
    hymn_factory(hymn_book=alfa, number=1, style="Valsa", repetitions="1-4")
    hymn_factory(hymn_book=zulu, number=1)
    return alfa, zulu


def test_sort_by_comp_asc(editor_client, comp_books):
    assert _slugs(editor_client, sort=[{"column": "comp", "direction": "asc"}]) == ["zulu", "alfa"]


def test_sort_by_comp_desc(editor_client, comp_books):
    assert _slugs(editor_client, sort=[{"column": "comp", "direction": "desc"}]) == ["alfa", "zulu"]


# ---------- chave `recent` (created_at) ----------


@pytest.fixture
def recent_books(hymn_book_factory):
    import datetime

    from django.utils import timezone

    alfa = hymn_book_factory(name="Alfa", slug="alfa")
    zulu = hymn_book_factory(name="Zulu", slug="zulu")
    # created_at é auto_now_add; .update() contorna pra fixar a ordem.
    HymnBook.objects.filter(pk=alfa.pk).update(created_at=timezone.now() - datetime.timedelta(days=10))
    HymnBook.objects.filter(pk=zulu.pk).update(created_at=timezone.now())
    return alfa, zulu


def test_sort_by_recent_asc(editor_client, recent_books):
    assert _slugs(editor_client, sort=[{"column": "recent", "direction": "asc"}]) == ["alfa", "zulu"]


def test_sort_by_recent_desc(editor_client, recent_books):
    assert _slugs(editor_client, sort=[{"column": "recent", "direction": "desc"}]) == ["zulu", "alfa"]


# ---------- combinação de duas chaves ----------


def test_sort_by_two_keys_respects_click_order(editor_client, hymn_book_factory, hymn_factory):
    """`review:asc,audio:desc`: review decide primeiro, audio desempata."""
    alfa = hymn_book_factory(name="Alfa", slug="alfa")  # review 0, audio 0
    beta = hymn_book_factory(name="Beta", slug="beta")  # review 0, audio 100
    zulu = hymn_book_factory(name="Zulu", slug="zulu")  # review 100, audio 0

    hymn_factory(hymn_book=alfa, number=1)
    beta_hymn = hymn_factory(hymn_book=beta, number=1)
    HymnAudio.objects.create(hymn=beta_hymn, audio_file="b.mp3", is_approved=True)
    _reviewed(hymn_factory(hymn_book=zulu, number=1))

    slugs = _slugs(
        editor_client,
        sort=[{"column": "review", "direction": "asc"}, {"column": "audio", "direction": "desc"}],
    )
    assert slugs == ["beta", "alfa", "zulu"]


# ---------- prioridade como sort primário ----------


def test_priority_is_primary_sort_when_priority_all(editor_client, hymn_book_factory, hymn_factory):
    """Com `priority=all`, P1 vem antes de P3 mesmo contra o sort do usuário."""
    alfa = hymn_book_factory(name="Alfa", slug="alfa", priority=HymnBook.Priority.P1)
    zulu = hymn_book_factory(name="Zulu", slug="zulu", priority=HymnBook.Priority.P3)
    hymn_factory(hymn_book=alfa, number=1)  # review 0%
    _reviewed(hymn_factory(hymn_book=zulu, number=1))  # review 100%

    slugs = _slugs(
        editor_client,
        sort=[{"column": "review", "direction": "desc"}],
        priority="all",
    )
    assert slugs == ["alfa", "zulu"]


def test_priority_filter_drops_primary_priority_sort(editor_client, hymn_book_factory, hymn_factory):
    """Filtrando por uma prioridade específica, só ela sobra e o sort do
    usuário volta a ser primário."""
    p1_low = hymn_book_factory(name="Alfa", slug="alfa", priority=HymnBook.Priority.P1)
    p1_high = hymn_book_factory(name="Zulu", slug="zulu", priority=HymnBook.Priority.P1)
    hymn_book_factory(name="Outro", slug="outro", priority=HymnBook.Priority.P3)
    hymn_factory(hymn_book=p1_low, number=1)
    _reviewed(hymn_factory(hymn_book=p1_high, number=1))

    slugs = _slugs(
        editor_client,
        sort=[{"column": "review", "direction": "desc"}],
        priority="P1",
    )
    assert slugs == ["zulu", "alfa"]


# ---------- reviewProgress exposto ----------


def test_review_progress_exposes_all_four_pcts(editor_client, hymn_book_factory, hymn_factory):
    book = hymn_book_factory(name="Alfa", slug="alfa")
    h1 = hymn_factory(hymn_book=book, number=1, style="Valsa", repetitions="1-4")
    hymn_factory(hymn_book=book, number=2)
    _reviewed(h1)
    HymnAudio.objects.create(hymn=h1, audio_file="a.mp3", is_approved=True)

    data = gql(editor_client, EDITOR_HYMNBOOKS)
    assert "errors" not in data, data
    progress = data["data"]["editorHymnbooks"][0]["reviewProgress"]
    assert progress == {"reviewPct": 50, "audioPct": 50, "stylePct": 50, "repsPct": 50}


def test_review_progress_available_outside_annotated_queryset(editor_client, hymn_book_factory, hymn_factory):
    """`Query.hymnbook` não passa por `with_review_progress()`; o campo tem que
    se resolver sozinho em vez de estourar."""
    book = hymn_book_factory(name="Alfa", slug="alfa")
    _reviewed(hymn_factory(hymn_book=book, number=1))

    data = gql(editor_client, '{ hymnbook(slug: "alfa") { reviewProgress { reviewPct } } }')
    assert "errors" not in data, data
    assert data["data"]["hymnbook"]["reviewProgress"]["reviewPct"] == 100
