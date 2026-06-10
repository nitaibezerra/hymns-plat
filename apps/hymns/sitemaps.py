"""
Sitemaps para descoberta por buscadores (Google, Bing/DuckDuckGo, etc.).

Expostos em `/sitemap.xml` (ver `config/urls.py`). Só conteúdo público entra:
hinários publicados (`HymnBook.objects.published()`) e os hinos que pertencem a
eles. Páginas estáticas (home, lista) também são incluídas.

O domínio absoluto das URLs é resolvido pelo framework de sitemaps a partir do
`request` (não usamos `django.contrib.sites`), então — atrás do Worker do
Cloudflare — o `Host` já vem reescrito para `hinaria.com.br` pelo
`original_host_middleware`. Não passar `protocol="https"` aqui faria o sitemap
herdar o esquema do request, que é https em produção via `SECURE_PROXY_SSL_HEADER`.
"""

from __future__ import annotations

from django.contrib.sitemaps import Sitemap
from django.urls import reverse

from .models import Hymn, HymnBook


class StaticViewSitemap(Sitemap):
    """Páginas estáticas de entrada (home e listagem de hinários)."""

    protocol = "https"
    changefreq = "weekly"
    priority = 0.8

    def items(self):
        return ["hymns:home", "hymns:hymnbook_list"]

    def location(self, item):
        return reverse(item)


class HymnBookSitemap(Sitemap):
    """Um <url> por hinário publicado."""

    protocol = "https"
    changefreq = "weekly"
    priority = 0.9

    def items(self):
        return HymnBook.objects.published().order_by("name")

    def lastmod(self, obj):
        return obj.updated_at


class HymnSitemap(Sitemap):
    """Um <url> por hino que pertença a um hinário publicado."""

    protocol = "https"
    changefreq = "monthly"
    priority = 0.6
    limit = 5000

    def items(self):
        return Hymn.objects.filter(hymn_book__is_published=True).order_by("hymn_book__name", "number")

    def lastmod(self, obj):
        return obj.updated_at


sitemaps = {
    "static": StaticViewSitemap,
    "hymnbooks": HymnBookSitemap,
    "hymns": HymnSitemap,
}
