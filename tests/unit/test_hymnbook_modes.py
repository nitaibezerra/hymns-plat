"""HymnBookDetailView: ?mode=corrido / ?mode=carrossel switch the visible pane server-side."""

import pytest
from django.urls import reverse


@pytest.mark.django_db
class TestHymnbookModeViaURL:
    def test_default_mode_is_indice(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="X")
        hymn_factory(hymn_book=hb, number=1)
        resp = client.get(reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}))
        assert resp.status_code == 200
        assert resp.context["mode"] == "indice"

    def test_mode_corrido_via_url(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="X")
        hymn_factory(hymn_book=hb, number=1)
        resp = client.get(reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}) + "?mode=corrido")
        assert resp.status_code == 200
        assert resp.context["mode"] == "corrido"
        # The corrido pane is the one without the "hidden" class.
        body = resp.content.decode()
        # Find the data-mode-pane="corrido" line and assert it does NOT have "hidden"
        # while indice pane DOES have hidden.
        corrido_idx = body.find('data-mode-pane="corrido"')
        # Look back ~200 chars from the marker for the class attribute.
        snippet = body[max(0, corrido_idx - 200) : corrido_idx]
        assert "hidden" not in snippet, "corrido pane should be visible (no hidden class)"

    def test_mode_carrossel_via_url(self, client, hymn_book_factory):
        hb = hymn_book_factory(name="X")
        resp = client.get(reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}) + "?mode=carrossel")
        assert resp.context["mode"] == "carrossel"

    def test_invalid_mode_falls_back_to_indice(self, client, hymn_book_factory):
        hb = hymn_book_factory(name="X")
        resp = client.get(reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}) + "?mode=evil")
        assert resp.context["mode"] == "indice"
