"""
URL configuration for hymns-plat project.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.sitemaps.views import sitemap
from django.urls import include, path
from wagtail import urls as wagtail_urls
from wagtail.admin import urls as wagtailadmin_urls
from wagtail.documents import urls as wagtaildocs_urls

from apps.hymns.sitemaps import sitemaps

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("admin/", include(wagtailadmin_urls)),
    path("documents/", include(wagtaildocs_urls)),
    path("accounts/", include("allauth.urls")),
    # SEO: sitemap para buscadores (antes do catch-all do Wagtail)
    path(
        "sitemap.xml",
        sitemap,
        {"sitemaps": sitemaps},
        name="django.contrib.sitemaps.views.sitemap",
    ),
    # GraphQL API (Marco 1 — headless refactor)
    path("", include("apps.api.urls")),
    # Health check (Railway probe)
    path("", include("apps.core.urls")),
    # Users app URLs
    path("", include("apps.users.urls")),
    # Hymns app URLs (before Wagtail catch-all)
    path("", include("apps.hymns.urls")),
    # Wagtail handles remaining URLs
    path("", include(wagtail_urls)),
]

if settings.DEBUG:
    # Serve media files in development
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

    # Django Debug Toolbar
    try:
        import debug_toolbar

        urlpatterns = [
            path("__debug__/", include(debug_toolbar.urls)),
        ] + urlpatterns
    except ImportError:
        pass
