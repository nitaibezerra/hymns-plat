"""Cover image renders on hymnbook detail and list when set; fallback otherwise."""

import pytest
from django.urls import reverse


@pytest.mark.django_db
class TestCoverImageRendering:
    def test_detail_renders_img_when_cover_set(self, client, hymn_book_factory, sample_image):
        hb = hymn_book_factory(name="Com capa", cover_image=sample_image)
        resp = client.get(reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}))
        assert resp.status_code == 200
        assert b"<img " in resp.content
        assert hb.cover_image.url.encode() in resp.content

    def test_detail_falls_back_to_letter_when_no_cover(self, client, hymn_book_factory):
        hb = hymn_book_factory(name="Sem capa", cover_image=None)
        resp = client.get(reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}))
        assert resp.status_code == 200
        # Letter placeholder lives in the cover slot when no image is set.
        assert b'aria-hidden="true">S' in resp.content

    def test_card_renders_img_when_cover_set(self, client, hymn_book_factory, sample_image):
        hymn_book_factory(name="Com capa", cover_image=sample_image)
        resp = client.get(reverse("hymns:hymnbook_list"))
        assert resp.status_code == 200
        assert b"<img " in resp.content
        assert b"Capa de Com capa" in resp.content
