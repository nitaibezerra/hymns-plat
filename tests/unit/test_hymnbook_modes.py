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

    def test_carrossel_slides_use_full_container_width(self, client, hymn_book_factory, hymn_factory):
        """Cada slide ocupa a largura do container in-page do carousel.
        Layout in-page: container max-w-6xl com slides w-full + snap-x. Sem
        peek do vizinho graças ao overflow-hidden no wrapper externo."""
        hb = hymn_book_factory(name="X")
        hymn_factory(hymn_book=hb, number=1)
        resp = client.get(reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}) + "?mode=carrossel")
        body = resp.content.decode()
        carousel_idx = body.find('data-mode-pane="carrossel"')
        assert carousel_idx >= 0
        carousel_section = body[carousel_idx : carousel_idx + 8000]
        assert "max-w-screen-md" not in carousel_section, "carousel slides should not be capped"
        assert "snap-x" in carousel_section
        assert "carousel-body" in carousel_section, "body wrapper class must exist for centered text"

    def test_carrossel_chrome_is_present(self, client, hymn_book_factory, hymn_factory):
        """Chrome elements (pill, dots, prev/next) must render in the carousel pane."""
        hb = hymn_book_factory(name="X")
        hymn_factory(hymn_book=hb, number=1)
        resp = client.get(reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}) + "?mode=carrossel")
        body = resp.content.decode()
        for marker in (
            "carousel-counter-pill",  # pílula in-slide (substitui data-carousel-counter)
            "data-carousel-dots",
            "data-carousel-prev",
            "data-carousel-next",
            "data-carousel-dot",
        ):
            assert marker in body, f"expected {marker} in carousel chrome"

    def test_mode_toggle_buttons_link_to_distinct_urls(self, client, hymn_book_factory, hymn_factory):
        """The mode-toggle pills must be anchor links pointing to distinct
        ?mode=indice / ?mode=corrido / ?mode=carrossel URLs (not <button>s that
        only swap panes via JS), so each mode is shareable, navigable with
        browser back/forward, and easy to test."""
        hb = hymn_book_factory(name="X")
        hymn_factory(hymn_book=hb, number=1)
        resp = client.get(reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}))
        body = resp.content.decode()
        for mode in ("indice", "corrido", "carrossel"):
            href = f'href="?mode={mode}"'
            assert href in body, f"expected anchor with {href}"
        # And ensure the legacy button-based markup is gone (no `data-mode=` on toggle pills).
        assert 'data-mode="indice"' not in body
        assert 'data-mode="corrido"' not in body
        assert 'data-mode="carrossel"' not in body

    def test_centered_hymn_body_block_uses_max_content_width(self):
        """Verses without repetition columns must render as a tight block (width: max-content,
        i.e. exactly the width of the longest line) centered inside the wrapper, with verses
        themselves left-aligned (page-de-cantador style). The same treatment applies to both
        the carousel pane (.carousel-body) and the per-hymn detail page (.hymn-body-centered)
        so the title and the body share the same horizontal center.

        Guards against accidental removal/regression of the CSS rules in components.css."""
        from pathlib import Path

        css = Path(__file__).resolve().parents[2] / "static" / "css" / "components.css"
        content = css.read_text(encoding="utf-8")
        normalized = " ".join(content.split())
        # Both selectors must exist (carousel + per-hymn detail share the same rule).
        assert ".carousel-body .hymn-text" in normalized
        assert ".hymn-body-centered .hymn-text" in normalized
        # Locate the rule body (the declarations between { and }) for the .hymn-text
        # combined selector and assert the three required declarations are inside.
        # We anchor on the first selector and read up to the closing brace.
        idx = normalized.index(".carousel-body .hymn-text")
        end = normalized.index("}", idx)
        rule_body = normalized[idx:end]
        assert "width: max-content" in rule_body, "body must use width: max-content for exact text width"
        assert "margin-inline: auto" in rule_body, "body must center horizontally via margin-inline"
        assert "text-align: left" in rule_body, "verses inside the body stay left-aligned"
