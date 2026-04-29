"""
Marco 2.0.4 — busca expandida com tabs (TUDO/HINOS/HINÁRIOS), chip de filtro
por hinário e snippet com `<mark>...</mark>` em volta do termo.
"""

import pytest
from django.urls import reverse


@pytest.mark.django_db
class TestSearchTabs:
    def test_default_type_returns_hymns_and_books(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="O Cruzeiro Lua")
        hymn_factory(hymn_book=hb, number=1, title="Lua Branca", text="lua")
        resp = client.get(reverse("hymns:search"), {"q": "lua"})
        assert resp.context["search_type"] == "all"
        # Tem ao menos 1 hino e 1 hinário
        types = {r["type"] for r in resp.context["results"]}
        assert "hymn" in types
        assert "book" in types

    def test_type_hymns_only(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="O Cruzeiro")
        hymn_factory(hymn_book=hb, number=1, title="Lua", text="x")
        resp = client.get(reverse("hymns:search"), {"q": "Cruzeiro", "type": "hymns"})
        types = {r["type"] for r in resp.context["results"]}
        assert "book" not in types

    def test_type_books_only(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="O Cruzeiro")
        hymn_factory(hymn_book=hb, number=1, title="Lua", text="x")
        resp = client.get(reverse("hymns:search"), {"q": "Cruzeiro", "type": "books"})
        types = {r["type"] for r in resp.context["results"]}
        assert types <= {"book"}

    def test_context_has_tab_counters(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="O Cruzeiro")
        hymn_factory(hymn_book=hb, number=1, title="Lua", text="x")
        resp = client.get(reverse("hymns:search"), {"q": "Cruzeiro"})
        assert "results_count_all" in resp.context
        assert "results_count_hymns" in resp.context
        assert "results_count_books" in resp.context


@pytest.mark.django_db
class TestSearchHeadline:
    def test_snippet_contains_mark_tag(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="O Cruzeiro")
        hymn_factory(hymn_book=hb, number=1, title="Lua Branca", text="Lua branca da luz serena")
        resp = client.get(reverse("hymns:search"), {"q": "lua"})
        # ao menos um resultado tem <mark> no headline
        headlines = [r.get("headline", "") for r in resp.context["results"]]
        assert any("<mark>" in h.lower() for h in headlines)


@pytest.mark.django_db
class TestSearchHymnbookFilter:
    def test_filter_by_hymnbook_slug(self, client, hymn_book_factory, hymn_factory):
        hb1 = hymn_book_factory(name="O Cruzeiro")
        hb2 = hymn_book_factory(name="Nova Jerusalém")
        hymn_factory(hymn_book=hb1, number=1, title="Lua A", text="x")
        hymn_factory(hymn_book=hb2, number=1, title="Lua B", text="x")
        resp = client.get(reverse("hymns:search"), {"q": "lua", "in_hymnbook": hb1.slug, "type": "hymns"})
        titles = {r["obj"].title for r in resp.context["results"] if r["type"] == "hymn"}
        assert "Lua A" in titles
        assert "Lua B" not in titles

    def test_filter_chip_in_context(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="O Cruzeiro")
        hymn_factory(hymn_book=hb, number=1, title="Lua", text="x")
        resp = client.get(reverse("hymns:search"), {"q": "lua", "in_hymnbook": hb.slug})
        assert resp.context["filter_hymnbook"] == hb
