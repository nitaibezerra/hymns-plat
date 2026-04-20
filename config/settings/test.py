"""
Test settings.
"""

from .base import *  # noqa

# Test mode
DEBUG = True

# Use in-memory SQLite for faster tests
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

# Disable migrations for tests (faster)
# Comment out if you need to test migrations
# class DisableMigrations:
#     def __contains__(self, item):
#         return True

#     def __getitem__(self, item):
#         return None


# MIGRATION_MODULES = DisableMigrations()

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

# TypeSense settings for tests (use mock or skip)
TYPESENSE_ENABLED = False
