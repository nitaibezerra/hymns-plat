"""HTTP middleware utilities for hymns-plat."""

from django.conf import settings
from django.http.request import validate_host


def original_host_middleware(get_response):
    """Honor `X-Original-Host` header set by the hinaria-proxy Cloudflare Worker.

    Why this exists: the Worker rewrites `Host` to `hinaria-production.up.railway.app`
    so Railway routes correctly. The standard `X-Forwarded-Host` is overridden by
    Railway's edge proxy on the way in, so it can't be trusted. The Worker passes
    the original visitor host in `X-Original-Host` (a header Railway leaves alone),
    and this middleware copies it into `HTTP_HOST` so `request.get_host()` and
    every `build_absolute_uri()` call return the canonical domain.

    Spoof defense: only accepts the header if the host part is in `ALLOWED_HOSTS`.
    """

    def middleware(request):
        original = request.META.get("HTTP_X_ORIGINAL_HOST", "").strip()
        if original:
            host_only = original.split(":", 1)[0]
            if validate_host(host_only, settings.ALLOWED_HOSTS):
                request.META["HTTP_HOST"] = original
        return get_response(request)

    return middleware
