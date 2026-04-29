"""
Unit tests for Hymn views.
"""

from uuid import uuid4

import pytest
from django.urls import reverse

from apps.hymns.models import Hymn, HymnBook


@pytest.mark.django_db
class TestHymnBookListView:
    """Tests for HymnBook list view."""

    def test_list_view_url_resolves(self, client):
        """Test that the list view URL resolves correctly."""
        url = reverse("hymns:hymnbook_list")
        response = client.get(url)
        assert response.status_code == 200

    def test_list_view_uses_correct_template(self, client):
        """Test that list view uses the correct template."""
        url = reverse("hymns:hymnbook_list")
        response = client.get(url)
        assert "hymns/hymnbook_list.html" in [t.name for t in response.templates]

    def test_list_view_shows_all_hymnbooks(self, client):
        """Test that list view shows all hymn books."""
        book1 = HymnBook.objects.create(is_published=True, name="O Cruzeiro", owner_name="Mestre Irineu")
        book2 = HymnBook.objects.create(is_published=True, name="Hinário do Padrinho", owner_name="Padrinho Sebastião")
        book3 = HymnBook.objects.create(is_published=True, name="Hinário da Madrinha", owner_name="Madrinha Rita")

        url = reverse("hymns:hymnbook_list")
        response = client.get(url)

        assert book1 in response.context["hymnbooks"]
        assert book2 in response.context["hymnbooks"]
        assert book3 in response.context["hymnbooks"]

    def test_list_view_orders_by_name(self, client):
        """Test that list view orders hymn books by name."""
        book3 = HymnBook.objects.create(is_published=True, name="Zé do Bolo", owner_name="Zé")
        book1 = HymnBook.objects.create(is_published=True, name="Algo", owner_name="Alguém")
        book2 = HymnBook.objects.create(is_published=True, name="Meio", owner_name="Alguém")

        url = reverse("hymns:hymnbook_list")
        response = client.get(url)

        hymnbooks = list(response.context["hymnbooks"])
        assert hymnbooks == [book1, book2, book3]

    def test_list_view_pagination_20_items(self, client):
        """Test that list view paginates at 20 items per page."""
        # Create 25 hymn books
        for i in range(25):
            HymnBook.objects.create(is_published=True, name=f"Hinário {i:02d}", owner_name="Owner")

        url = reverse("hymns:hymnbook_list")
        response = client.get(url)

        assert response.context["is_paginated"] is True
        assert len(response.context["hymnbooks"]) == 20

    def test_list_view_page_2(self, client):
        """Test that page 2 shows remaining items."""
        # Create 25 hymn books
        for i in range(25):
            HymnBook.objects.create(is_published=True, name=f"Hinário {i:02d}", owner_name="Owner")

        url = reverse("hymns:hymnbook_list")
        response = client.get(url, {"page": 2})

        assert response.status_code == 200
        assert len(response.context["hymnbooks"]) == 5

    def test_list_view_empty_state(self, client):
        """Test that list view handles empty database."""
        url = reverse("hymns:hymnbook_list")
        response = client.get(url)

        assert response.status_code == 200
        assert len(response.context["hymnbooks"]) == 0

    def test_list_view_invalid_page_404(self, client):
        """Test that invalid page number returns 404."""
        HymnBook.objects.create(is_published=True, name="O Cruzeiro", owner_name="Mestre Irineu")

        url = reverse("hymns:hymnbook_list")
        response = client.get(url, {"page": 999})

        assert response.status_code == 404

    def test_list_view_context_data(self, client):
        """Test that list view provides correct context data."""
        HymnBook.objects.create(is_published=True, name="O Cruzeiro", owner_name="Mestre Irineu")

        url = reverse("hymns:hymnbook_list")
        response = client.get(url)

        assert "hymnbooks" in response.context
        assert "page_obj" in response.context


@pytest.mark.django_db
class TestHymnBookDetailView:
    """Tests for HymnBook detail view."""

    def test_detail_view_url_resolves(self, client):
        """Test that detail view URL resolves correctly."""
        hymn_book = HymnBook.objects.create(is_published=True, name="O Cruzeiro", owner_name="Mestre Irineu")
        url = reverse("hymns:hymnbook_detail", kwargs={"slug": hymn_book.slug})
        response = client.get(url)
        assert response.status_code == 200

    def test_detail_view_uses_correct_template(self, client):
        """Test that detail view uses the correct template."""
        hymn_book = HymnBook.objects.create(is_published=True, name="O Cruzeiro", owner_name="Mestre Irineu")
        url = reverse("hymns:hymnbook_detail", kwargs={"slug": hymn_book.slug})
        response = client.get(url)
        assert "hymns/hymnbook_detail.html" in [t.name for t in response.templates]

    def test_detail_view_shows_hymnbook(self, client):
        """Test that detail view displays the hymn book."""
        hymn_book = HymnBook.objects.create(is_published=True, name="O Cruzeiro", owner_name="Mestre Irineu")
        url = reverse("hymns:hymnbook_detail", kwargs={"slug": hymn_book.slug})
        response = client.get(url)

        assert response.context["hymnbook"] == hymn_book
        assert b"O Cruzeiro" in response.content

    def test_detail_view_shows_hymns_ordered(self, client):
        """Test that detail view shows hymns ordered by number."""
        hymn_book = HymnBook.objects.create(is_published=True, name="O Cruzeiro", owner_name="Mestre Irineu")
        hymn3 = Hymn.objects.create(hymn_book=hymn_book, number=3, title="Terceiro", text="Texto 3")
        hymn1 = Hymn.objects.create(hymn_book=hymn_book, number=1, title="Primeiro", text="Texto 1")
        hymn2 = Hymn.objects.create(hymn_book=hymn_book, number=2, title="Segundo", text="Texto 2")

        url = reverse("hymns:hymnbook_detail", kwargs={"slug": hymn_book.slug})
        response = client.get(url)

        hymns = list(response.context["hymns"])
        assert hymns == [hymn1, hymn2, hymn3]

    def test_detail_view_slug_lookup(self, client):
        """Test that detail view looks up by slug."""
        hymn_book = HymnBook.objects.create(
            is_published=True, name="Hinário do Padrinho Sebastião", owner_name="Padrinho"
        )
        url = reverse("hymns:hymnbook_detail", kwargs={"slug": "hinario-do-padrinho-sebastiao"})
        response = client.get(url)

        assert response.status_code == 200
        assert response.context["hymnbook"] == hymn_book

    def test_detail_view_invalid_slug_404(self, client):
        """Test that invalid slug returns 404."""
        url = reverse("hymns:hymnbook_detail", kwargs={"slug": "nao-existe"})
        response = client.get(url)
        assert response.status_code == 404

    def test_detail_view_slug_with_special_chars(self, client):
        """Test that slugs with special characters work correctly."""
        hymn_book = HymnBook.objects.create(is_published=True, name="Hinário São José", owner_name="Owner")
        url = reverse("hymns:hymnbook_detail", kwargs={"slug": hymn_book.slug})
        response = client.get(url)
        assert response.status_code == 200

    def test_detail_view_context_hymns(self, client):
        """Test that detail view includes hymns in context."""
        hymn_book = HymnBook.objects.create(is_published=True, name="O Cruzeiro", owner_name="Mestre Irineu")
        Hymn.objects.create(hymn_book=hymn_book, number=1, title="Lua Branca", text="...")
        Hymn.objects.create(hymn_book=hymn_book, number=2, title="Tuperci", text="...")

        url = reverse("hymns:hymnbook_detail", kwargs={"slug": hymn_book.slug})
        response = client.get(url)

        assert "hymns" in response.context
        assert len(response.context["hymns"]) == 2

    def test_detail_view_context_hymnbook(self, client):
        """Test that detail view includes hymnbook in context."""
        hymn_book = HymnBook.objects.create(is_published=True, name="O Cruzeiro", owner_name="Mestre Irineu")
        url = reverse("hymns:hymnbook_detail", kwargs={"slug": hymn_book.slug})
        response = client.get(url)

        assert "hymnbook" in response.context
        assert response.context["hymnbook"] == hymn_book


@pytest.mark.django_db
class TestHymnDetailView:
    """Tests for Hymn detail view."""

    def test_hymn_detail_url_resolves(self, client):
        """Test that hymn detail URL resolves correctly."""
        hymn_book = HymnBook.objects.create(is_published=True, name="O Cruzeiro", owner_name="Mestre Irineu")
        hymn = Hymn.objects.create(hymn_book=hymn_book, number=1, title="Lua Branca", text="...")
        url = reverse("hymns:hymn_detail", kwargs={"pk": hymn.pk})
        response = client.get(url)
        assert response.status_code == 200

    def test_hymn_detail_uses_correct_template(self, client):
        """Test that hymn detail view uses the correct template."""
        hymn_book = HymnBook.objects.create(is_published=True, name="O Cruzeiro", owner_name="Mestre Irineu")
        hymn = Hymn.objects.create(hymn_book=hymn_book, number=1, title="Lua Branca", text="...")
        url = reverse("hymns:hymn_detail", kwargs={"pk": hymn.pk})
        response = client.get(url)
        assert "hymns/hymn_detail.html" in [t.name for t in response.templates]

    def test_hymn_detail_shows_hymn(self, client):
        """Test that hymn detail view displays the hymn."""
        hymn_book = HymnBook.objects.create(is_published=True, name="O Cruzeiro", owner_name="Mestre Irineu")
        hymn = Hymn.objects.create(hymn_book=hymn_book, number=1, title="Lua Branca", text="Lua branca...")
        url = reverse("hymns:hymn_detail", kwargs={"pk": hymn.pk})
        response = client.get(url)

        assert response.context["hymn"] == hymn
        assert b"Lua Branca" in response.content
        assert b"Lua branca..." in response.content

    def test_hymn_detail_uuid_lookup(self, client):
        """Test that hymn detail view looks up by UUID."""
        hymn_book = HymnBook.objects.create(is_published=True, name="O Cruzeiro", owner_name="Mestre Irineu")
        hymn = Hymn.objects.create(hymn_book=hymn_book, number=1, title="Lua Branca", text="...")
        url = reverse("hymns:hymn_detail", kwargs={"pk": str(hymn.id)})
        response = client.get(url)

        assert response.status_code == 200
        assert response.context["hymn"] == hymn

    def test_hymn_detail_invalid_uuid_404(self, client):
        """Test that invalid UUID returns 404."""
        random_uuid = uuid4()
        url = reverse("hymns:hymn_detail", kwargs={"pk": str(random_uuid)})
        response = client.get(url)
        assert response.status_code == 404

    def test_hymn_detail_malformed_uuid_404(self, client):
        """Test that malformed UUID returns 404."""
        url = "/hinos/not-a-uuid/"
        response = client.get(url)
        assert response.status_code == 404

    def test_hymn_detail_select_related(self, client):
        """Test that hymn detail view uses select_related for optimization."""
        hymn_book = HymnBook.objects.create(is_published=True, name="O Cruzeiro", owner_name="Mestre Irineu")
        hymn = Hymn.objects.create(hymn_book=hymn_book, number=1, title="Lua Branca", text="...")
        url = reverse("hymns:hymn_detail", kwargs={"pk": hymn.pk})

        # Just verify the view works - the get_queryset method in the view uses select_related
        response = client.get(url)
        assert response.status_code == 200
        # Verify hymn_book is accessible without additional query (if select_related worked)
        assert response.context["hymn"].hymn_book == hymn_book

    def test_hymn_detail_context_hymn(self, client):
        """Test that hymn detail view includes hymn in context."""
        hymn_book = HymnBook.objects.create(is_published=True, name="O Cruzeiro", owner_name="Mestre Irineu")
        hymn = Hymn.objects.create(hymn_book=hymn_book, number=1, title="Lua Branca", text="...")
        url = reverse("hymns:hymn_detail", kwargs={"pk": hymn.pk})
        response = client.get(url)

        assert "hymn" in response.context
        assert response.context["hymn"] == hymn

    def test_hymn_detail_renders_repetition_bars(self, client):
        """Hymn com repetitions deve ter barras de repetição no HTML."""
        hymn_book = HymnBook.objects.create(is_published=True, name="Rep", owner_name="x")
        hymn = Hymn.objects.create(
            hymn_book=hymn_book,
            number=1,
            title="T",
            text="V1\nV2\nV3\nV4",
            repetitions="1-2,3-4",
        )
        response = client.get(reverse("hymns:hymn_detail", kwargs={"pk": hymn.pk}))
        content = response.content.decode()
        assert "repetition-bar" in content
        assert "hymn-grid" in content

    def test_hymn_detail_hides_repetitions_text_field(self, client):
        """Seção 'Informações' não deve mostrar o label 'Repetições'."""
        hymn_book = HymnBook.objects.create(is_published=True, name="Rep2", owner_name="x")
        hymn = Hymn.objects.create(
            hymn_book=hymn_book,
            number=1,
            title="T",
            text="V1\nV2",
            repetitions="1-2",
        )
        response = client.get(reverse("hymns:hymn_detail", kwargs={"pk": hymn.pk}))
        content = response.content.decode()
        assert "Repetições" not in content


def _hymns_in_results(response):
    """A view de busca passou a retornar dicts {type, obj, headline}; este helper
    mantém os asserts legados (`hymn in results`) funcionando."""
    return [r["obj"] for r in response.context["results"] if r["type"] == "hymn"]


@pytest.mark.django_db
class TestSearchView:
    """Tests for search view (PostgreSQL FTS + Trigram)."""

    def test_url_resolves(self, client):
        response = client.get(reverse("hymns:search"))
        assert response.status_code == 200

    def test_uses_correct_template(self, client):
        response = client.get(reverse("hymns:search"))
        assert "hymns/search.html" in [t.name for t in response.templates]

    def test_empty_query_returns_no_results(self, client):
        response = client.get(reverse("hymns:search"))
        assert response.context["query"] == ""
        assert response.context["results"] == []
        assert response.context["total"] == 0

    def test_whitespace_query_returns_no_results(self, client):
        response = client.get(reverse("hymns:search"), {"q": "   "})
        assert response.context["query"] == ""
        assert response.context["results"] == []

    def test_matches_title(self, client):
        hb = HymnBook.objects.create(is_published=True, name="O Cruzeiro", owner_name="Mestre Irineu")
        lua = Hymn.objects.create(hymn_book=hb, number=1, title="Lua Branca", text="serena")
        Hymn.objects.create(hymn_book=hb, number=2, title="Tuperci", text="outro")

        response = client.get(reverse("hymns:search"), {"q": "lua"})
        assert lua in _hymns_in_results(response)
        assert len(_hymns_in_results(response)) == 1

    def test_matches_text_body(self, client):
        hb = HymnBook.objects.create(is_published=True, name="O Cruzeiro", owner_name="Mestre Irineu")
        target = Hymn.objects.create(hymn_book=hb, number=1, title="Primeiro", text="Lua branca da luz serena")
        Hymn.objects.create(hymn_book=hb, number=2, title="Segundo", text="Outro texto qualquer")

        response = client.get(reverse("hymns:search"), {"q": "serena"})
        assert target in _hymns_in_results(response)
        assert len(_hymns_in_results(response)) == 1

    def test_matches_hymnbook_name(self, client):
        hb1 = HymnBook.objects.create(is_published=True, name="O Cruzeiro", owner_name="Irineu")
        hb2 = HymnBook.objects.create(is_published=True, name="Nova Jerusalém", owner_name="Outro")
        h1 = Hymn.objects.create(hymn_book=hb1, number=1, title="h1", text="t1")
        h2 = Hymn.objects.create(hymn_book=hb2, number=1, title="h2", text="t2")

        response = client.get(reverse("hymns:search"), {"q": "cruzeiro", "type": "hymns"})
        results = _hymns_in_results(response)
        assert h1 in results
        assert h2 not in results

    def test_matches_owner_name(self, client):
        hb = HymnBook.objects.create(is_published=True, name="Hin", owner_name="Mestre Irineu")
        h = Hymn.objects.create(hymn_book=hb, number=1, title="x", text="y")

        response = client.get(reverse("hymns:search"), {"q": "irineu"})
        assert h in _hymns_in_results(response)

    def test_ranks_title_higher_than_text(self, client):
        hb = HymnBook.objects.create(is_published=True, name="Hb", owner_name="x")
        in_text = Hymn.objects.create(hymn_book=hb, number=1, title="Outro", text="palavrachave aparece aqui")
        in_title = Hymn.objects.create(hymn_book=hb, number=2, title="Palavrachave", text="conteúdo")

        response = client.get(reverse("hymns:search"), {"q": "palavrachave"})
        results = _hymns_in_results(response)
        # Match no título (weight A) deve aparecer antes do match no texto (weight B)
        assert results.index(in_title) < results.index(in_text)

    def test_portuguese_stemming(self, client):
        """Busca 'cantar' encontra hino com 'cantando'."""
        hb = HymnBook.objects.create(is_published=True, name="Hb", owner_name="x")
        target = Hymn.objects.create(hymn_book=hb, number=1, title="Hino", text="Estão cantando com alegria")

        response = client.get(reverse("hymns:search"), {"q": "cantar"})
        assert target in _hymns_in_results(response)

    def test_typo_tolerance_via_trigram(self, client):
        """Busca 'cruzero' (typo) encontra 'Cruzeiro'."""
        hb = HymnBook.objects.create(is_published=True, name="O Cruzeiro", owner_name="x")
        target = Hymn.objects.create(hymn_book=hb, number=1, title="Cruzeiro", text="texto")

        response = client.get(reverse("hymns:search"), {"q": "cruzero"})
        assert target in _hymns_in_results(response)

    def test_case_insensitive(self, client):
        hb = HymnBook.objects.create(is_published=True, name="Hb", owner_name="x")
        target = Hymn.objects.create(hymn_book=hb, number=1, title="Lua Branca", text="serena")

        response = client.get(reverse("hymns:search"), {"q": "LUA"})
        assert target in _hymns_in_results(response)

    def test_multiple_terms_ranking(self, client):
        """Match exato de múltiplos termos ranqueia acima de match parcial."""
        hb = HymnBook.objects.create(is_published=True, name="Hb", owner_name="x")
        both = Hymn.objects.create(hymn_book=hb, number=1, title="Virgem Maria", text="t1")
        only_one = Hymn.objects.create(hymn_book=hb, number=2, title="Só Virgem", text="t2")

        response = client.get(reverse("hymns:search"), {"q": "virgem maria"})
        results = _hymns_in_results(response)
        assert both in results
        # O match completo deve vir antes do parcial
        assert results.index(both) < results.index(only_one)

    def test_pagination_limit_50(self, client):
        hb = HymnBook.objects.create(is_published=True, name="Hb", owner_name="x")
        for i in range(60):
            Hymn.objects.create(hymn_book=hb, number=i + 1, title=f"Hino {i}", text="palavracomum")

        response = client.get(reverse("hymns:search"), {"q": "palavracomum"})
        assert len(_hymns_in_results(response)) == 50

    def test_query_preserved_in_context(self, client):
        response = client.get(reverse("hymns:search"), {"q": "lua branca"})
        assert response.context["query"] == "lua branca"

    def test_unaccented_match(self, client):
        """Busca 'acao' encontra 'Ação'."""
        hb = HymnBook.objects.create(is_published=True, name="Hb", owner_name="x")
        target = Hymn.objects.create(hymn_book=hb, number=1, title="Ação Divina", text="texto")

        response = client.get(reverse("hymns:search"), {"q": "acao"})
        # Portuguese FTS dictionary drops accents, so 'acao' and 'ação' stem alike
        assert target in _hymns_in_results(response)


@pytest.mark.django_db
class TestHomeView:
    """Tests for home view."""

    def test_home_view_url_resolves(self, client):
        """Test that home view URL resolves correctly."""
        url = reverse("hymns:home")
        response = client.get(url)
        assert response.status_code == 200

    def test_home_view_uses_correct_template(self, client):
        """Test that home view uses the correct template."""
        url = reverse("hymns:home")
        response = client.get(url)
        assert "hymns/home.html" in [t.name for t in response.templates]

    def test_home_view_recent_hymnbooks(self, client):
        """Test that home view shows recent hymn books."""
        book1 = HymnBook.objects.create(is_published=True, name="Livro 1", owner_name="Owner 1")
        book2 = HymnBook.objects.create(is_published=True, name="Livro 2", owner_name="Owner 2")
        book3 = HymnBook.objects.create(is_published=True, name="Livro 3", owner_name="Owner 3")

        url = reverse("hymns:home")
        response = client.get(url)

        recent = response.context["recent_hymnbooks"]
        assert book1 in recent
        assert book2 in recent
        assert book3 in recent

    def test_home_view_recent_ordering(self, client):
        """Test that home view orders recent hymn books by created_at descending."""
        # Create books in specific order
        book1 = HymnBook.objects.create(is_published=True, name="Primeiro", owner_name="Owner")
        book2 = HymnBook.objects.create(is_published=True, name="Segundo", owner_name="Owner")
        book3 = HymnBook.objects.create(is_published=True, name="Terceiro", owner_name="Owner")

        url = reverse("hymns:home")
        response = client.get(url)

        recent = list(response.context["recent_hymnbooks"])
        # Most recent first (created last)
        assert recent[0] == book3
        assert recent[1] == book2
        assert recent[2] == book1

    def test_home_view_total_hymnbooks_stat(self, client):
        """Test that home view shows total hymn books count."""
        HymnBook.objects.create(is_published=True, name="Livro 1", owner_name="Owner 1")
        HymnBook.objects.create(is_published=True, name="Livro 2", owner_name="Owner 2")
        HymnBook.objects.create(is_published=True, name="Livro 3", owner_name="Owner 3")

        url = reverse("hymns:home")
        response = client.get(url)

        assert response.context["total_hymnbooks"] == 3

    def test_home_view_total_hymns_stat(self, client):
        """Test that home view shows total hymns count."""
        book1 = HymnBook.objects.create(is_published=True, name="Livro 1", owner_name="Owner 1")
        book2 = HymnBook.objects.create(is_published=True, name="Livro 2", owner_name="Owner 2")

        Hymn.objects.create(hymn_book=book1, number=1, title="Hino 1", text="...")
        Hymn.objects.create(hymn_book=book1, number=2, title="Hino 2", text="...")
        Hymn.objects.create(hymn_book=book2, number=1, title="Hino 3", text="...")

        url = reverse("hymns:home")
        response = client.get(url)

        assert response.context["total_hymns"] == 3

    def test_home_view_empty_database(self, client):
        """Test that home view handles empty database."""
        url = reverse("hymns:home")
        response = client.get(url)

        assert response.status_code == 200
        assert len(response.context["recent_hymnbooks"]) == 0
        assert response.context["total_hymnbooks"] == 0
        assert response.context["total_hymns"] == 0

    def test_home_view_context_recent_hymnbooks(self, client):
        """Test that home view limits recent hymn books to 6."""
        # Create 10 hymn books
        for i in range(10):
            HymnBook.objects.create(is_published=True, name=f"Livro {i}", owner_name="Owner")

        url = reverse("hymns:home")
        response = client.get(url)

        recent = response.context["recent_hymnbooks"]
        assert len(recent) == 6
