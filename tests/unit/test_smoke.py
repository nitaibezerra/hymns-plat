"""
Smoke tests to verify basic functionality.
"""

import pytest
from django.conf import settings
from django.core.management import call_command


@pytest.mark.django_db
class TestSmoke:
    """Smoke tests for basic application functionality."""

    def test_settings_loaded(self):
        """Test that Django settings are loaded correctly."""
        assert settings.SECRET_KEY is not None
        assert "apps.core" in settings.INSTALLED_APPS
        assert "apps.users" in settings.INSTALLED_APPS
        assert "apps.hymns" in settings.INSTALLED_APPS
        assert "wagtail" in settings.INSTALLED_APPS

    def test_database_connection(self):
        """Test database connection works."""
        from django.db import connection

        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            assert result == (1,)

    def test_migrations_applied(self):
        """Test that migrations can be applied."""
        # This will raise an error if migrations fail
        call_command("migrate", verbosity=0, interactive=False)

    def test_custom_user_model(self):
        """Test custom user model is configured correctly."""
        from apps.users.models import User

        assert settings.AUTH_USER_MODEL == "users.User"
        # Create a test user
        user = User.objects.create_user(username="testuser", email="test@example.com", password="testpass123")
        assert user.username == "testuser"
        assert user.email == "test@example.com"
        assert user.check_password("testpass123")

    def test_apps_loaded(self):
        """Test that all custom apps are loaded."""
        from django.apps import apps

        assert apps.is_installed("apps.core")
        assert apps.is_installed("apps.users")
        assert apps.is_installed("apps.hymns")
        assert apps.is_installed("apps.cms")
