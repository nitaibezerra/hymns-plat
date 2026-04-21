"""
Testes dos signals que mantêm Hymn.search_vector atualizado.
"""

import pytest


@pytest.mark.django_db
class TestHymnSearchVectorSignal:
    def test_creating_hymn_populates_search_vector(self, hymn_book, hymn_factory):
        h = hymn_factory(hymn_book=hymn_book, number=1, title="Lua Branca", text="Lua branca da luz serena")
        h.refresh_from_db()
        assert h.search_vector is not None

    def test_updating_hymn_title_updates_vector(self, hymn_book, hymn_factory):
        h = hymn_factory(hymn_book=hymn_book, number=2, title="PalavraAntiga", text="texto")
        h.refresh_from_db()
        original_vector = h.search_vector

        h.title = "PalavraNova"
        h.save()
        h.refresh_from_db()

        assert h.search_vector != original_vector

    def test_vector_matches_title_tokens(self, hymn_book, hymn_factory):
        from django.contrib.postgres.search import SearchQuery

        from apps.hymns.models import Hymn

        hymn_factory(hymn_book=hymn_book, number=3, title="Lua Branca", text="serena")
        found = Hymn.objects.filter(search_vector=SearchQuery("lua", config="portuguese"))
        assert found.count() == 1

    def test_vector_portuguese_stemming(self, hymn_book, hymn_factory):
        """Stemming PT: busca por 'cantar' deve encontrar 'cantando'."""
        from django.contrib.postgres.search import SearchQuery

        from apps.hymns.models import Hymn

        hymn_factory(hymn_book=hymn_book, number=4, title="Hino", text="Estão cantando com alegria")
        found = Hymn.objects.filter(search_vector=SearchQuery("cantar", config="portuguese"))
        assert found.count() == 1

    def test_vector_includes_hymnbook_name(self, hymn_book_factory, hymn_factory):
        from django.contrib.postgres.search import SearchQuery

        from apps.hymns.models import Hymn

        hb = hymn_book_factory(name="O Cruzeiro", owner_name="Mestre Irineu")
        hymn_factory(hymn_book=hb, number=1, title="X", text="Y")

        found = Hymn.objects.filter(search_vector=SearchQuery("cruzeiro", config="portuguese"))
        assert found.count() == 1

    def test_vector_includes_owner_name(self, hymn_book_factory, hymn_factory):
        from django.contrib.postgres.search import SearchQuery

        from apps.hymns.models import Hymn

        hb = hymn_book_factory(name="Hin", owner_name="Mestre Irineu")
        hymn_factory(hymn_book=hb, number=1, title="X", text="Y")

        found = Hymn.objects.filter(search_vector=SearchQuery("irineu", config="portuguese"))
        assert found.count() == 1


@pytest.mark.django_db
class TestHymnBookSearchVectorSignal:
    def test_updating_hymnbook_name_repopulates_children(self, hymn_book_factory, hymn_factory):
        from django.contrib.postgres.search import SearchQuery

        from apps.hymns.models import Hymn

        hb = hymn_book_factory(name="Antigo Nome", owner_name="x")
        hymn_factory(hymn_book=hb, number=1, title="t", text="x")

        # Antes da mudança: achava "antigo"
        assert Hymn.objects.filter(search_vector=SearchQuery("antigo", config="portuguese")).count() == 1

        hb.name = "Nome Novissimo"
        hb.save()

        # Após mudança: acha "novissimo", não acha mais "antigo"
        assert Hymn.objects.filter(search_vector=SearchQuery("novissimo", config="portuguese")).count() == 1
        assert Hymn.objects.filter(search_vector=SearchQuery("antigo", config="portuguese")).count() == 0

    def test_creating_hymnbook_does_not_crash_without_children(self, hymn_book_factory):
        # Should not raise
        hymn_book_factory(name="Sem Filhos", owner_name="x")
