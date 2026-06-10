"""SEO: sitemap, meta tags e dados estruturados.

Cobre a "Frente 1" do plano de indexação:
- `/sitemap.xml` existe, é XML válido e lista home, lista e hinários publicados;
  hinários NÃO publicados ficam de fora.
- `get_absolute_url()` dos modelos aponta pras rotas canônicas.
- `base.html` injeta description, canonical, Open Graph e JSON-LD.
- A meta de verificação do Google só renderiza quando o token está configurado.
"""

from __future__ import annotations

import pytest
from django.urls import reverse


@pytest.mark.django_db
class TestGetAbsoluteUrl:
    def test_hymnbook_absolute_url(self, hymn_book_factory):
        hb = hymn_book_factory(name="O Justiceiro")
        assert hb.get_absolute_url() == reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug})

    def test_hymn_absolute_url(self, hymn):
        assert hymn.get_absolute_url() == reverse("hymns:hymn_detail", kwargs={"pk": hymn.pk})


@pytest.mark.django_db
class TestSitemap:
    def test_sitemap_returns_xml(self, client):
        resp = client.get("/sitemap.xml")
        assert resp.status_code == 200
        assert "application/xml" in resp["Content-Type"]
        assert b"<urlset" in resp.content

    def test_sitemap_lists_published_hymnbook(self, client, hymn_book_factory):
        hb = hymn_book_factory(name="Hinário Público", is_published=True)
        body = client.get("/sitemap.xml").content.decode()
        assert hb.get_absolute_url() in body

    def test_sitemap_excludes_unpublished_hymnbook(self, client, hymn_book_factory):
        hb = hymn_book_factory(name="Rascunho Privado", is_published=False)
        body = client.get("/sitemap.xml").content.decode()
        assert hb.get_absolute_url() not in body

    def test_sitemap_includes_static_home_and_list(self, client):
        body = client.get("/sitemap.xml").content.decode()
        assert reverse("hymns:home") in body
        assert reverse("hymns:hymnbook_list") in body

    def test_sitemap_includes_hymns_of_published_book(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Com Hinos", is_published=True)
        hy = hymn_factory(hymn_book=hb, number=1, title="Primeiro")
        body = client.get("/sitemap.xml").content.decode()
        assert hy.get_absolute_url() in body

    def test_sitemap_excludes_hymns_of_unpublished_book(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Oculto", is_published=False)
        hy = hymn_factory(hymn_book=hb, number=1, title="Secreto")
        body = client.get("/sitemap.xml").content.decode()
        assert hy.get_absolute_url() not in body


@pytest.mark.django_db
class TestMetaTags:
    def test_home_has_description_and_canonical(self, client):
        body = client.get(reverse("hymns:home")).content.decode()
        assert '<meta name="description"' in body
        assert '<link rel="canonical"' in body
        assert 'property="og:title"' in body

    def test_home_has_website_jsonld(self, client):
        body = client.get(reverse("hymns:home")).content.decode()
        assert "application/ld+json" in body
        assert '"@type": "WebSite"' in body
        assert "SearchAction" in body

    def test_hymnbook_detail_has_book_jsonld(self, client, hymn_book_factory):
        hb = hymn_book_factory(name="Estruturado", is_published=True)
        body = client.get(hb.get_absolute_url()).content.decode()
        assert '"@type": "Book"' in body
        assert "Estruturado" in body

    def test_hymn_detail_has_musiccomposition_jsonld(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Livro", is_published=True)
        hy = hymn_factory(hymn_book=hb, number=1, title="Aurora")
        body = client.get(hy.get_absolute_url()).content.decode()
        assert '"@type": "MusicComposition"' in body


@pytest.mark.django_db
class TestSiteVerification:
    def test_google_verification_absent_by_default(self, client):
        body = client.get(reverse("hymns:home")).content.decode()
        assert "google-site-verification" not in body

    def test_google_verification_renders_when_set(self, client, settings):
        settings.GOOGLE_SITE_VERIFICATION = "test-token-123"
        body = client.get(reverse("hymns:home")).content.decode()
        assert 'name="google-site-verification"' in body
        assert "test-token-123" in body
