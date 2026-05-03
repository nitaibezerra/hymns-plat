"""
Production settings.
"""

from .base import *  # noqa

DEBUG = False

# Hosts and CSRF (Railway behind Cloudflare)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS")
CSRF_TRUSTED_ORIGINS = env.list("DJANGO_CSRF_TRUSTED_ORIGINS", default=["https://*.up.railway.app"])

# Tells Django the X-Forwarded-Proto header from Railway proxy means HTTPS
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
# A Cloudflare Worker reverses-proxies hinaria.com.br → hinaria-production.up.railway.app
# (Railway didn't issue a cert for the custom domain in time). The Worker rewrites the
# Host header to the railway URL so Railway's edge routes correctly, then forwards the
# original visitor host in X-Forwarded-Host. This setting makes Django honour that header
# when building absolute URLs and checking ALLOWED_HOSTS.
USE_X_FORWARDED_HOST = True

# Security
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)
# Skip the SSL redirect on /health/ so Railway's internal HTTP probe (which
# does not present X-Forwarded-Proto: https) doesn't get a 301 and mark the
# deploy unhealthy.
SECURE_REDIRECT_EXEMPT = [r"^health/$"]
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SAMESITE = "Lax"
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
