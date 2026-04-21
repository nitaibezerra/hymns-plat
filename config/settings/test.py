"""
Test settings.
"""

from .base import *  # noqa

# Test mode
DEBUG = True

# PostgreSQL is required for full-text search (to_tsvector, pg_trgm, unaccent
# extensions). pytest-django creates/destroys a transient test database on
# each run, so production data in `hymnplat` is untouched.
DATABASES = {
    "default": env.db(  # noqa: F405
        "DATABASE_URL",
        default="postgresql://hymnplat:hymnplat@localhost:5432/hymnplat",
    ),
}

# Fast password hasher for tests
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

# Email backend for tests
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# Disable Celery in tests (run tasks synchronously)
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# Media files in temp directory
MEDIA_ROOT = "/tmp/hymns-plat-test-media"
