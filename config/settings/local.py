"""
Local development settings.
"""

from .base import *  # noqa

DEBUG = True

# Debug toolbar
INSTALLED_APPS += [
    "debug_toolbar",
]

MIDDLEWARE += [
    "debug_toolbar.middleware.DebugToolbarMiddleware",
]

INTERNAL_IPS = [
    "127.0.0.1",
]

# Disable CORS in development
CORS_ALLOW_ALL_ORIGINS = True

# CSRF: a SPA SvelteKit roda noutra porta (5173 por padrão) e manda `Origin`.
# Desde o Django 4.0 o CsrfViewMiddleware compara esse header com
# CSRF_TRUSTED_ORIGINS **também em HTTP** — e `CORS_ALLOW_ALL_ORIGINS` acima
# não cobre isso, são checagens diferentes. Sem esta lista, TODA mutation vinda
# do dev server é recusada com "Origin checking failed - http://localhost:5173
# does not match any trusted origins", o que aparece como autosave falhando e
# botão que não faz nada. Porta customizada (ex.: E2E em :5373) entra via env.
CSRF_TRUSTED_ORIGINS = env.list(  # noqa: F405
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    default=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:9000",
        "http://127.0.0.1:9000",
    ],
)

# Email backend for development
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Disable password validation in development
AUTH_PASSWORD_VALIDATORS = []

# Show SQL queries in console
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django.db.backends": {
            "handlers": ["console"],
            "level": "DEBUG",
            "propagate": False,
        },
    },
}
