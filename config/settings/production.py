"""
Production settings.
"""

from .base import *  # noqa

DEBUG = False

# Hosts and CSRF (Railway behind Cloudflare)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS")

# --------------------------------------------------------------------------- #
# Origens cross-site da SPA (beta) — ver "SPA em beta" no CLAUDE.md
# --------------------------------------------------------------------------- #
# A SPA SvelteKit sobe primeiro em `https://beta.hinaria.com.br` e fala com
# este backend em `https://hinaria.com.br/graphql/`. Isso é **cross-origin**
# (hosts diferentes), então as duas listas abaixo são obrigatórias — e são
# checagens distintas, não redundantes:
#
# - `CORS_ALLOWED_ORIGINS` é o que faz o **navegador** entregar a resposta à
#   página do beta. Sem ela a chamada sai, o Django responde 200, e o browser
#   descarta tudo com "blocked by CORS policy".
# - `CSRF_TRUSTED_ORIGINS` é o que faz o **Django** aceitar uma mutation: o
#   `CsrfViewMiddleware` compara o header `Origin` com esta lista e recusa
#   com "Origin checking failed" quando não bate.
#
# Ambas vêm de env para que um subdomínio novo (staging, preview, e o próprio
# cutover para o apex) não exija deploy de código. Os defaults descrevem a
# topologia real de produção; `.env.example` documenta os nomes.
#
# ATENÇÃO ao operar: `DJANGO_CSRF_TRUSTED_ORIGINS` **já está setada no
# Railway**, e env sempre vence o default — acrescentar `beta.` ao default
# aqui não muda nada em produção enquanto a variável de lá não for atualizada.
#
# Produção NÃO herda mais o default de `base.py` (`localhost:5173`): liberar
# localhost com `CORS_ALLOW_CREDENTIALS = True` deixa qualquer página servida
# nessa porta ler dados autenticados de produção. Quem precisar apontar um dev
# server para o backend de produção passa a origem por env, ciente do risco.
CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS",
    default=[
        "https://beta.hinaria.com.br",
        "https://hinaria.com.br",
        "https://www.hinaria.com.br",
    ],
)
# `CORS_ALLOW_CREDENTIALS = True` vem de `base.py` e é o que permite o cookie
# de sessão viajar no `fetch(..., { credentials: 'include' })` da SPA. Não
# desligar; e nunca combinar com `CORS_ALLOW_ALL_ORIGINS` (que produção não
# define de propósito — o par "libera tudo + manda credencial" é o clássico).

CSRF_TRUSTED_ORIGINS = env.list(
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    default=[
        "https://beta.hinaria.com.br",
        "https://hinaria.com.br",
        "https://www.hinaria.com.br",
        "https://*.up.railway.app",
    ],
)

# Tells Django the X-Forwarded-Proto header from Railway proxy means HTTPS
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
# A Cloudflare Worker reverse-proxies hinaria.com.br → hinaria-production.up.railway.app
# (Railway didn't issue a cert for the custom domain). The Worker rewrites Host so
# Railway routes correctly, then passes the visitor host in X-Original-Host (custom
# header — Railway's edge overrides the standard X-Forwarded-Host). The middleware
# below copies X-Original-Host into HTTP_HOST so request.get_host() and every
# build_absolute_uri() call return the canonical domain — required by OAuth callbacks,
# password-reset emails, sitemaps, etc.
MIDDLEWARE = ["apps.core.middleware.original_host_middleware", *MIDDLEWARE]  # noqa: F405

# Security
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)
# Skip the SSL redirect on /health/ so Railway's internal HTTP probe (which
# does not present X-Forwarded-Proto: https) doesn't get a 301 and mark the
# deploy unhealthy.
SECURE_REDIRECT_EXEMPT = [r"^health/$"]
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
# `Lax` basta para a SPA em beta e NÃO precisa virar `None`: `SameSite` olha o
# domínio registrável (eTLD+1), e `beta.hinaria.com.br` ↔ `hinaria.com.br`
# compartilham `hinaria.com.br` — é same-site, então Lax não gateia nada, nem
# em POST. (Cross-*origin* é outra coisa, e é o que CORS/CSRF acima resolvem.)
SESSION_COOKIE_SAMESITE = "Lax"

# --------------------------------------------------------------------------- #
# Escopo dos cookies — só ligar quando a SPA estiver noutro host (beta)
# --------------------------------------------------------------------------- #
# Default `None` = host-only, que é o comportamento de hoje e o mais estreito:
# o cookie só existe para `hinaria.com.br`.
#
# Host-only já cobre mais do que parece. Um cookie host-only do apex É enviado
# numa requisição PARA o apex, venha ela da página que vier — o envio olha a
# URL de **destino**, não a origem do documento. Ou seja, a SPA já hidratada
# lendo dados via `fetch(..., { credentials: 'include' })` funciona sem Domain.
#
# Onde host-only quebra são os dois caminhos em que quem precisa enxergar o
# cookie é o **host da SPA**:
#
#   1. `document.cookie` — toda mutation da SPA monta `X-CSRFToken` lendo
#      `csrftoken` do documento (`web/src/lib/graphql/client.ts`). Numa página
#      em `beta.` o cookie host-only do apex é invisível, o header não é
#      montado, e toda escrita (login incluído) leva 403.
#   2. SSR — o `handleFetch` do SvelteKit repassa o cookie que o navegador
#      mandou para `beta.hinaria.com.br`. Sem Domain, `sessionid` não está
#      lá: o shell renderiza "Entrar" e o guard de `/editor/**` responde 302
#      para `/login` mesmo com editor logado.
#
# Então para o beta funcionar de verdade **é preciso** setar as duas com
# `.hinaria.com.br`. Fica em env e desligado por default de propósito: alargar
# o escopo do cookie de sessão do site que já está no ar é decisão de operação
# (uma variável no Railway, reversível), não efeito colateral de um merge.
#
# No cutover, quando a SPA assumir o apex e o Django não tiver mais um host
# irmão para atender, estas duas voltam a ficar vazias. Ver "SPA em beta" no
# CLAUDE.md.
#
# `or None` normaliza `""` (variável presente e vazia) para o `None` que o
# Django espera — `""` seria um Domain literalmente vazio no Set-Cookie.
SESSION_COOKIE_DOMAIN = env("SESSION_COOKIE_DOMAIN", default="") or None
CSRF_COOKIE_DOMAIN = env("CSRF_COOKIE_DOMAIN", default="") or None
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Wagtail admin needs an absolute URL for emails and previews
WAGTAILADMIN_BASE_URL = env("WAGTAILADMIN_BASE_URL", default="https://hinaria.com.br")

# Default storage backends — Django 5.x uses the STORAGES dict (legacy
# STATICFILES_STORAGE / DEFAULT_FILE_STORAGE were removed). Initialise with
# whitenoise for static + filesystem fallback for media; the R2 block below
# overrides the "default" backend when AWS_ACCESS_KEY_ID is set.
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

# Email — Resend SMTP (mesmo padrão do copa-dos-reis); falls back to console
# when EMAIL_HOST_PASSWORD is empty so deploys without a token still boot.
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
if EMAIL_HOST_PASSWORD:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = env("EMAIL_HOST", default="smtp.resend.com")
    EMAIL_PORT = env.int("EMAIL_PORT", default=587)
    EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="resend")
    EMAIL_USE_TLS = True
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Media storage — Cloudflare R2 via django-storages (S3-compatible).
# Activated when AWS_ACCESS_KEY_ID is set; otherwise falls back to local /media.
AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID", default="")
if AWS_ACCESS_KEY_ID:
    AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY")
    AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME")
    AWS_S3_ENDPOINT_URL = env("AWS_S3_ENDPOINT_URL")
    AWS_S3_CUSTOM_DOMAIN = env("AWS_S3_CUSTOM_DOMAIN", default="")
    AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME", default="auto")
    AWS_S3_SIGNATURE_VERSION = "s3v4"
    AWS_S3_ADDRESSING_STYLE = "virtual"
    AWS_DEFAULT_ACL = None
    AWS_QUERYSTRING_AUTH = False
    AWS_S3_FILE_OVERWRITE = False

    STORAGES["default"] = {"BACKEND": "storages.backends.s3boto3.S3Boto3Storage"}
    if AWS_S3_CUSTOM_DOMAIN:
        MEDIA_URL = f"https://{AWS_S3_CUSTOM_DOMAIN}/"

# Logging
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}
