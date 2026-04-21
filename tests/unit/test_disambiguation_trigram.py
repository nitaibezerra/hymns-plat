"""
Testes de suggest_similar_via_trigram (substitui suggest_similar_via_typesense).
"""

import pytest

from apps.hymns.disambiguation import suggest_similar_via_trigram


@pytest.mark.django_db
class TestSuggestSimilarViaTrigram:
    def test_returns_close_matches(self, hymn_book_factory):
        target = hymn_book_factory(name="O Cruzeiro", owner_name="x")
        hymn_book_factory(name="Hinário do Padrinho", owner_name="y")

        results = suggest_similar_via_trigram("Cruzeiro")
        names = [hb.name for hb in results]
        assert target.name in names

    def test_empty_query_returns_empty(self):
        assert suggest_similar_via_trigram("") == []
        assert suggest_similar_via_trigram("   ") == []

    def test_respects_threshold(self, hymn_book_factory):
        hymn_book_factory(name="Totalmente Diferente", owner_name="x")
        # Query sem similaridade deve devolver vazio com threshold alto
        results = suggest_similar_via_trigram("xyz", threshold=0.5)
        assert results == []

    def test_ignores_accents(self, hymn_book_factory):
        target = hymn_book_factory(name="Oração do Credo", owner_name="x")
        results = suggest_similar_via_trigram("oracao credo")
        assert target in results

    def test_respects_limit(self, hymn_book_factory):
        for i in range(10):
            hymn_book_factory(name=f"Similar Name {i}", owner_name="x")
        results = suggest_similar_via_trigram("similar", limit=3)
        assert len(results) <= 3

    def test_orders_by_similarity(self, hymn_book_factory):
        exact = hymn_book_factory(name="Cruzeiro", owner_name="x")
        close = hymn_book_factory(name="Cruzero", owner_name="x")  # typo
        far = hymn_book_factory(name="Cruzeirinho do Amor", owner_name="x")

        results = list(suggest_similar_via_trigram("Cruzeiro", threshold=0.3, limit=10))

        # Match exato vem antes de match typo vem antes de match mais fraco
        idx_exact = results.index(exact)
        idx_close = results.index(close) if close in results else 999
        idx_far = results.index(far) if far in results else 999
        assert idx_exact < idx_close
        assert idx_close < idx_far or idx_far == 999
