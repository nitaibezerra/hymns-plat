"""
Marco 5.A½ · Tarefa B7 — resolvers de campo mergeados sem teste.

`HymnBookType.nextPendingHymn`, `HymnBookType.nextIncompleteHymn`,
`HymnType.ocrLineConfidences`, `HymnType.commonStyles` e
`HymnType.commonRepetitions` entraram no Marco 5.A sem nenhuma cobertura.
São os campos que alimentam os fluxos de fila do editor (5.C/5.E), então o
contrato precisa estar pinado.
"""

from __future__ import annotations

import pytest

from apps.hymns.models import Hymn

from ._helpers import gql

pytestmark = pytest.mark.django_db


def _reviewed(hymn):
    hymn.review_status = Hymn.ReviewStatus.REVIEWED
    hymn.save()
    return hymn


# ---------- HymnBookType.nextPendingHymn ----------

NEXT_PENDING = """
query($slug: String!, $currentPk: ID) {
  hymnbook(slug: $slug) {
    nextPendingHymn(currentPk: $currentPk) { number }
  }
}
"""


def test_next_pending_hymn_returns_first_unreviewed(editor_client, hymn_book_factory, hymn_factory):
    book = hymn_book_factory(name="A", slug="a")
    _reviewed(hymn_factory(hymn_book=book, number=1))
    hymn_factory(hymn_book=book, number=2)
    hymn_factory(hymn_book=book, number=3)

    data = gql(editor_client, NEXT_PENDING, variables={"slug": "a"})
    assert "errors" not in data, data
    assert data["data"]["hymnbook"]["nextPendingHymn"]["number"] == 2


def test_next_pending_hymn_prefers_higher_number_than_current(editor_client, hymn_book_factory, hymn_factory):
    """Fila linear: passando `currentPk`, salta pro próximo número acima."""
    book = hymn_book_factory(name="A", slug="a")
    hymn_factory(hymn_book=book, number=1)
    current = hymn_factory(hymn_book=book, number=2)
    hymn_factory(hymn_book=book, number=3)

    data = gql(editor_client, NEXT_PENDING, variables={"slug": "a", "currentPk": str(current.pk)})
    assert "errors" not in data, data
    assert data["data"]["hymnbook"]["nextPendingHymn"]["number"] == 3


def test_next_pending_hymn_wraps_back_when_current_is_last(editor_client, hymn_book_factory, hymn_factory):
    """Sem número acima, volta pro primeiro pendente (o de baixo)."""
    book = hymn_book_factory(name="A", slug="a")
    hymn_factory(hymn_book=book, number=1)
    current = hymn_factory(hymn_book=book, number=2)

    data = gql(editor_client, NEXT_PENDING, variables={"slug": "a", "currentPk": str(current.pk)})
    assert "errors" not in data, data
    assert data["data"]["hymnbook"]["nextPendingHymn"]["number"] == 1


def test_next_pending_hymn_null_when_all_reviewed(editor_client, hymn_book_factory, hymn_factory):
    book = hymn_book_factory(name="A", slug="a")
    _reviewed(hymn_factory(hymn_book=book, number=1))

    data = gql(editor_client, NEXT_PENDING, variables={"slug": "a"})
    assert "errors" not in data, data
    assert data["data"]["hymnbook"]["nextPendingHymn"] is None


# ---------- HymnBookType.nextIncompleteHymn ----------

NEXT_INCOMPLETE = """
query($slug: String!) {
  hymnbook(slug: $slug) { nextIncompleteHymn { number } }
}
"""


def test_next_incomplete_hymn_finds_missing_style(editor_client, hymn_book_factory, hymn_factory):
    book = hymn_book_factory(name="A", slug="a")
    hymn_factory(hymn_book=book, number=1, style="Valsa", repetitions="1-4")
    hymn_factory(hymn_book=book, number=2, style="", repetitions="1-4")

    data = gql(editor_client, NEXT_INCOMPLETE, variables={"slug": "a"})
    assert "errors" not in data, data
    assert data["data"]["hymnbook"]["nextIncompleteHymn"]["number"] == 2


def test_next_incomplete_hymn_finds_missing_repetitions(editor_client, hymn_book_factory, hymn_factory):
    book = hymn_book_factory(name="A", slug="a")
    hymn_factory(hymn_book=book, number=1, style="Valsa", repetitions="1-4")
    hymn_factory(hymn_book=book, number=2, style="Marcha", repetitions="")

    data = gql(editor_client, NEXT_INCOMPLETE, variables={"slug": "a"})
    assert "errors" not in data, data
    assert data["data"]["hymnbook"]["nextIncompleteHymn"]["number"] == 2


def test_next_incomplete_hymn_null_when_all_complete(editor_client, hymn_book_factory, hymn_factory):
    book = hymn_book_factory(name="A", slug="a")
    hymn_factory(hymn_book=book, number=1, style="Valsa", repetitions="1-4")

    data = gql(editor_client, NEXT_INCOMPLETE, variables={"slug": "a"})
    assert "errors" not in data, data
    assert data["data"]["hymnbook"]["nextIncompleteHymn"] is None


# ---------- HymnType.ocrLineConfidences ----------

OCR_CONFIDENCES = """
query($pk: ID!) {
  hymn(pk: $pk) { ocrLineConfidences }
}
"""


def test_ocr_line_confidences_empty_without_ocr_text(editor_client, hymn):
    data = gql(editor_client, OCR_CONFIDENCES, variables={"pk": str(hymn.pk)})
    assert "errors" not in data, data
    assert data["data"]["hymn"]["ocrLineConfidences"] == []


def test_ocr_line_confidences_100_for_untouched_lines(editor_client, hymn_book, hymn_factory):
    text = "Lua branca\nDa luz serena"
    hymn = hymn_factory(hymn_book=hymn_book, number=5, text=text, ocr_text=text)

    data = gql(editor_client, OCR_CONFIDENCES, variables={"pk": str(hymn.pk)})
    assert "errors" not in data, data
    assert data["data"]["hymn"]["ocrLineConfidences"] == [100, 100]


def test_ocr_line_confidences_drops_for_rewritten_line(editor_client, hymn_book, hymn_factory):
    hymn = hymn_factory(
        hymn_book=hymn_book,
        number=6,
        text="Lua branca\nDa luz serena",
        ocr_text="Lua branca\nXXXXXXXXXXXXXXX",
    )

    data = gql(editor_client, OCR_CONFIDENCES, variables={"pk": str(hymn.pk)})
    assert "errors" not in data, data
    confidences = data["data"]["hymn"]["ocrLineConfidences"]
    assert len(confidences) == 2
    assert confidences[0] == 100
    assert confidences[1] < 50, confidences


# ---------- HymnType.commonStyles / commonRepetitions ----------

COMMON = """
query($pk: ID!, $top: Int!) {
  hymn(pk: $pk) {
    commonStyles(top: $top)
    commonRepetitions(top: $top)
  }
}
"""


def test_common_values_rank_by_frequency_within_the_hymnbook(editor_client, hymn_book_factory, hymn_factory):
    book = hymn_book_factory(name="A", slug="a")
    for number in (1, 2, 3):
        hymn_factory(hymn_book=book, number=number, style="Valsa", repetitions="1-4")
    hymn_factory(hymn_book=book, number=4, style="Marcha", repetitions="1-2,3-4")
    subject = hymn_factory(hymn_book=book, number=5, style="", repetitions="")

    data = gql(editor_client, COMMON, variables={"pk": str(subject.pk), "top": 5})
    assert "errors" not in data, data
    row = data["data"]["hymn"]
    assert row["commonStyles"] == ["Valsa", "Marcha"]
    assert row["commonRepetitions"] == ["1-4", "1-2,3-4"]


def test_common_values_respect_top_argument(editor_client, hymn_book_factory, hymn_factory):
    book = hymn_book_factory(name="A", slug="a")
    for number, style in enumerate(("Valsa", "Marcha", "Mazurca"), start=1):
        hymn_factory(hymn_book=book, number=number, style=style, repetitions=f"{number}-4")
    subject = hymn_factory(hymn_book=book, number=9)

    data = gql(editor_client, COMMON, variables={"pk": str(subject.pk), "top": 1})
    assert "errors" not in data, data
    assert len(data["data"]["hymn"]["commonStyles"]) == 1
    assert len(data["data"]["hymn"]["commonRepetitions"]) == 1


def test_common_values_ignore_other_hymnbooks(editor_client, hymn_book_factory, hymn_factory):
    """Vocabulário é por hinário — sugerir estilo de outro livro seria ruído."""
    book = hymn_book_factory(name="A", slug="a")
    other = hymn_book_factory(name="B", slug="b")
    hymn_factory(hymn_book=other, number=1, style="Estilo Alheio", repetitions="9-9")
    subject = hymn_factory(hymn_book=book, number=1)

    data = gql(editor_client, COMMON, variables={"pk": str(subject.pk), "top": 5})
    assert "errors" not in data, data
    assert data["data"]["hymn"]["commonStyles"] == []
    assert data["data"]["hymn"]["commonRepetitions"] == []
