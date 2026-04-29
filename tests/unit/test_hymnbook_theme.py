"""
Marco 2.0.6 — `HymnBook.accent_color` (hex opcional) + `display_accent`
(determinístico por hash do slug, paleta de 8 cores).
"""

import pytest

from apps.hymns.models import HymnBook


@pytest.mark.django_db
class TestAccentColor:
    def test_default_blank(self, hymn_book):
        assert hymn_book.accent_color == ""

    def test_can_set_hex(self, hymn_book_factory):
        hb = hymn_book_factory(name="X", accent_color="#8C3A2E")
        hb.refresh_from_db()
        assert hb.accent_color == "#8C3A2E"


@pytest.mark.django_db
class TestDisplayAccent:
    def test_uses_explicit_when_set(self, hymn_book_factory):
        hb = hymn_book_factory(name="Custom", accent_color="#123456")
        assert hb.display_accent == "#123456"

    def test_deterministic_per_slug(self, hymn_book_factory):
        hb = hymn_book_factory(name="Palette Test")
        first = hb.display_accent
        second = HymnBook.objects.get(pk=hb.pk).display_accent
        assert first == second

    def test_distributes_palette_across_slugs(self, hymn_book_factory):
        from apps.hymns.models import HYMNBOOK_ACCENT_PALETTE

        slugs = [
            "o-cruzeiro",
            "o-justiceiro",
            "nova-jerusalem",
            "selecao-ingrid",
            "hinos-do-sol",
            "hinos-da-madrinha",
            "estrela-do-mar",
            "o-mensageiro",
        ]
        accents = set()
        for s in slugs:
            hb = hymn_book_factory(name=s.replace("-", " ").title())
            assert hb.display_accent in HYMNBOOK_ACCENT_PALETTE
            accents.add(hb.display_accent)
        # 8 slugs distintos devem cobrir pelo menos 5 cores diferentes
        assert len(accents) >= 5
