"""Tests for `apps.core.middleware.original_host_middleware`.

The hinaria-proxy Cloudflare Worker rewrites the `Host` header to the Railway
internal domain (`hinaria-production.up.railway.app`) so Railway can route
correctly. The Worker passes the original visitor host in `X-Original-Host`
because Railway's edge proxy overrides the standard `X-Forwarded-Host`. This
middleware reads `X-Original-Host` and rewrites `HTTP_HOST` so that
`request.get_host()` and `request.build_absolute_uri()` return the canonical
domain (used by OAuth callbacks, password-reset emails, etc.).
"""

from django.test import RequestFactory, override_settings

from apps.core.middleware import original_host_middleware


def _capture_host(request):
    seen = {}
    middleware = original_host_middleware(lambda r: seen.setdefault("host", r.get_host()) or None)
    middleware(request)
    return seen["host"]


@override_settings(ALLOWED_HOSTS=["hinaria.com.br", "hinaria-production.up.railway.app"])
def test_overrides_host_when_x_original_host_is_allowed():
    rf = RequestFactory()
    request = rf.get(
        "/",
        HTTP_HOST="hinaria-production.up.railway.app",
        HTTP_X_ORIGINAL_HOST="hinaria.com.br",
    )
    assert _capture_host(request) == "hinaria.com.br"


@override_settings(ALLOWED_HOSTS=["hinaria.com.br"])
def test_ignores_x_original_host_not_in_allowed_hosts():
    """Defesa contra spoofing: header não pode sobrepor ALLOWED_HOSTS."""
    rf = RequestFactory()
    request = rf.get(
        "/",
        HTTP_HOST="hinaria.com.br",
        HTTP_X_ORIGINAL_HOST="malicious.example.com",
    )
    assert _capture_host(request) == "hinaria.com.br"


@override_settings(ALLOWED_HOSTS=["hinaria.com.br"])
def test_no_op_when_x_original_host_absent():
    rf = RequestFactory()
    request = rf.get("/", HTTP_HOST="hinaria.com.br")
    assert _capture_host(request) == "hinaria.com.br"


@override_settings(ALLOWED_HOSTS=["hinaria.com.br"])
def test_no_op_when_x_original_host_empty():
    rf = RequestFactory()
    request = rf.get("/", HTTP_HOST="hinaria.com.br", HTTP_X_ORIGINAL_HOST="")
    assert _capture_host(request) == "hinaria.com.br"


def test_middleware_registered_as_first_in_production_settings():
    """O middleware deve rodar ANTES de SecurityMiddleware (que valida get_host)."""
    import importlib

    from config.settings import production

    importlib.reload(production)
    assert production.MIDDLEWARE[0] == "apps.core.middleware.original_host_middleware"


@override_settings(ALLOWED_HOSTS=["hinaria.com.br"])
def test_strips_port_for_allowed_hosts_validation():
    """X-Original-Host pode vir com porta; validação deve ignorar a porta."""
    rf = RequestFactory()
    request = rf.get(
        "/",
        HTTP_HOST="hinaria-production.up.railway.app",
        HTTP_X_ORIGINAL_HOST="hinaria.com.br:443",
    )
    assert _capture_host(request) == "hinaria.com.br:443"
