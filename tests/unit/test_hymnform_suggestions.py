"""
Testa que `hymn_create_view` e `hymn_edit_view` injetam `style_suggestions`
(top-N por frequência) e `repetition_suggestions` no contexto da página.
"""

import pytest
from django.urls import reverse


@pytest.mark.django_db
class TestHymnFormSuggestions:
    def test_create_view_injects_suggestions(self, editor_client, hymn_book, hymn_factory):
        hymn_factory(hymn_book=hymn_book, number=10, style="Valsa")
        hymn_factory(hymn_book=hymn_book, number=11, style="Valsa")
        hymn_factory(hymn_book=hymn_book, number=12, style="Marcha")

        url = reverse("hymns:hymn_create", kwargs={"slug": hymn_book.slug})
        resp = editor_client.get(url)
        assert resp.status_code == 200
        ctx = resp.context
        assert "style_suggestions" in ctx
        # Valsa aparece 2x, Marcha 1x → Valsa primeiro
        assert ctx["style_suggestions"][0] == "Valsa"
        assert "Marcha" in ctx["style_suggestions"]
        assert ctx["repetition_suggestions"] == ["todos 2×", "1-4, 5-8", "sem repetição"]

    def test_edit_view_injects_suggestions(self, editor_client, hymn):
        url = reverse("hymns:hymn_edit", kwargs={"pk": hymn.pk})
        resp = editor_client.get(url)
        assert resp.status_code == 200
        assert "style_suggestions" in resp.context
        assert resp.context["repetition_suggestions"] == ["todos 2×", "1-4, 5-8", "sem repetição"]

    def test_style_suggestions_limit_8(self, editor_client, hymn_book, hymn_factory):
        # Cria 12 estilos diferentes; suggestions deve cortar em 8.
        for i, sty in enumerate([f"Estilo {n}" for n in range(12)], start=1):
            hymn_factory(hymn_book=hymn_book, number=i, style=sty)
        url = reverse("hymns:hymn_create", kwargs={"slug": hymn_book.slug})
        resp = editor_client.get(url)
        assert len(resp.context["style_suggestions"]) == 8

    def test_template_renders_chips_for_each_suggestion(self, editor_client, hymn_book, hymn_factory):
        hymn_factory(hymn_book=hymn_book, number=20, style="Valsa")
        url = reverse("hymns:hymn_create", kwargs={"slug": hymn_book.slug})
        resp = editor_client.get(url)
        body = resp.content.decode()
        # Espera ao menos um chip estilo + os 3 de repetições
        assert 'data-value="Valsa"' in body
        assert 'data-value="todos 2×"' in body
        assert 'data-value="1-4, 5-8"' in body
        assert 'data-value="sem repetição"' in body
