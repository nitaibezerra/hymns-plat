"""Tela de leitura `/hinarios/<slug>/ler/?modo=corrido|carrossel`.

Após o refactor, o detail do hinário fica enxuto (apenas sumário/índice) e
os modos de leitura "corrido" e "carrossel" vivem em rota separada `/ler/`.
Links `?mode=corrido|carrossel` no detail redirecionam 302 para a rota nova.
"""

import pytest
from django.urls import reverse


@pytest.mark.django_db
class TestHymnbookReadView:
    def test_default_modo_is_corrido(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="X")
        hymn_factory(hymn_book=hb, number=1)
        resp = client.get(reverse("hymns:hymnbook_read", kwargs={"slug": hb.slug}))
        assert resp.status_code == 200
        assert resp.context["modo"] == "corrido"

    def test_modo_carrossel_via_url(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="X")
        hymn_factory(hymn_book=hb, number=1)
        resp = client.get(reverse("hymns:hymnbook_read", kwargs={"slug": hb.slug}) + "?modo=carrossel")
        assert resp.context["modo"] == "carrossel"

    def test_invalid_modo_falls_back_to_corrido(self, client, hymn_book_factory):
        hb = hymn_book_factory(name="X")
        resp = client.get(reverse("hymns:hymnbook_read", kwargs={"slug": hb.slug}) + "?modo=evil")
        assert resp.context["modo"] == "corrido"

    def test_initial_hymn_param_propagates_to_template(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="X")
        hymn_factory(hymn_book=hb, number=5)
        resp = client.get(reverse("hymns:hymnbook_read", kwargs={"slug": hb.slug}) + "?hino=5")
        body = resp.content.decode()
        assert 'data-initial-hymn="5"' in body

    def test_carrossel_slides_use_full_container_width(self, client, hymn_book_factory, hymn_factory):
        """Cada slide ocupa a largura do container. Sem peek do vizinho."""
        hb = hymn_book_factory(name="X")
        hymn_factory(hymn_book=hb, number=1)
        resp = client.get(reverse("hymns:hymnbook_read", kwargs={"slug": hb.slug}) + "?modo=carrossel")
        body = resp.content.decode()
        carousel_idx = body.find('data-mode-pane="carrossel"')
        assert carousel_idx >= 0
        carousel_section = body[carousel_idx : carousel_idx + 8000]
        assert "max-w-screen-md" not in carousel_section, "carousel slides should not be capped"
        assert "snap-x" in carousel_section
        assert "carousel-body" in carousel_section, "body wrapper class must exist for centered text"

    def test_carrossel_chrome_is_present(self, client, hymn_book_factory, hymn_factory):
        """Chrome (pílula contador, dots, prev/next) renderiza no carrossel."""
        hb = hymn_book_factory(name="X")
        hymn_factory(hymn_book=hb, number=1)
        resp = client.get(reverse("hymns:hymnbook_read", kwargs={"slug": hb.slug}) + "?modo=carrossel")
        body = resp.content.decode()
        for marker in (
            "carousel-counter-pill",
            "data-carousel-dots",
            "data-carousel-prev",
            "data-carousel-next",
            "data-carousel-dot",
        ):
            assert marker in body, f"expected {marker} in carousel chrome"

    def test_reading_toggle_points_to_distinct_modos(self, client, hymn_book_factory, hymn_factory):
        """Toggle minimalista — 2 anchors com `?modo=corrido` e `?modo=carrossel`."""
        hb = hymn_book_factory(name="X")
        hymn_factory(hymn_book=hb, number=1)
        resp = client.get(reverse("hymns:hymnbook_read", kwargs={"slug": hb.slug}))
        body = resp.content.decode()
        assert 'href="?modo=corrido' in body
        assert 'href="?modo=carrossel' in body
        # Modo "indice" não existe mais nesta tela.
        assert 'href="?modo=indice"' not in body

    def test_reading_toggle_active_marker(self, client, hymn_book_factory, hymn_factory):
        """Só o modo ativo recebe a classe `reading-toggle--active`."""
        hb = hymn_book_factory(name="Active")
        hymn_factory(hymn_book=hb, number=1)
        body = client.get(reverse("hymns:hymnbook_read", kwargs={"slug": hb.slug}) + "?modo=carrossel").content.decode()
        assert body.count("reading-toggle--active") == 1
        # E o ativo é o link para carrossel.
        # Encontra a tag com `--active` e confirma o `?modo=carrossel`.
        idx = body.index("reading-toggle--active")
        # Olha 400 chars antes para casar o href.
        prefix = body[max(0, idx - 400) : idx]
        assert "?modo=carrossel" in prefix


@pytest.mark.django_db
class TestLegacyModeRedirect:
    """`?mode=corrido|carrossel` no detail vira 302 → `/ler/?modo=...`."""

    def test_legacy_mode_corrido_redirects(self, client, hymn_book_factory):
        hb = hymn_book_factory(name="Legacy")
        resp = client.get(reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}) + "?mode=corrido")
        assert resp.status_code == 302
        assert resp.url.endswith("/ler/?modo=corrido")

    def test_legacy_mode_carrossel_redirects(self, client, hymn_book_factory):
        hb = hymn_book_factory(name="Legacy 2")
        resp = client.get(reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}) + "?mode=carrossel")
        assert resp.status_code == 302
        assert resp.url.endswith("/ler/?modo=carrossel")

    def test_legacy_mode_indice_does_not_redirect(self, client, hymn_book_factory):
        hb = hymn_book_factory(name="Legacy 3")
        resp = client.get(reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}) + "?mode=indice")
        assert resp.status_code == 200

    def test_invalid_mode_does_not_redirect(self, client, hymn_book_factory):
        hb = hymn_book_factory(name="Legacy 4")
        resp = client.get(reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}) + "?mode=evil")
        assert resp.status_code == 200


def test_centered_hymn_body_block_uses_max_content_width():
    """Verses without repetition columns render as tight block (width: max-content)
    centered inside the wrapper, with verses themselves left-aligned. Same
    treatment for carousel pane (.carousel-body) and per-hymn detail page
    (.hymn-body-centered).

    Guards against accidental removal of the CSS rules in components.css.
    """
    from pathlib import Path

    css = Path(__file__).resolve().parents[2] / "static" / "css" / "components.css"
    content = css.read_text(encoding="utf-8")
    normalized = " ".join(content.split())
    assert ".carousel-body .hymn-text" in normalized
    assert ".hymn-body-centered .hymn-text" in normalized
    idx = normalized.index(".carousel-body .hymn-text")
    end = normalized.index("}", idx)
    rule_body = normalized[idx:end]
    assert "width: max-content" in rule_body
    assert "margin-inline: auto" in rule_body
    assert "text-align: left" in rule_body
