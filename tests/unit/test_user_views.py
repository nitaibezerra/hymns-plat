"""
Tests for user views (profiles, upload).
"""

import pytest
from django.urls import reverse

from apps.hymns.models import HymnBook


@pytest.mark.django_db
class TestProfileView:
    """Tests for profile view."""

    def test_profile_view_loads(self, client, django_user_model):
        """Test that profile view loads correctly."""
        user = django_user_model.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

        url = reverse("users:profile", kwargs={"username": user.username})
        response = client.get(url)

        assert response.status_code == 200
        assert user.username.encode() in response.content

    def test_profile_shows_hymnbooks(self, client, django_user_model):
        """Test that profile shows user's hymnbooks."""
        user = django_user_model.objects.create_user(username="owner", email="owner@example.com", password="pass123")

        hb1 = HymnBook.objects.create(name="Hinário 1", owner_name="Dono", owner_user=user)

        hb2 = HymnBook.objects.create(name="Hinário 2", owner_name="Dono", owner_user=user)

        url = reverse("users:profile", kwargs={"username": user.username})
        response = client.get(url)

        assert response.status_code == 200
        assert hb1.name.encode() in response.content
        assert hb2.name.encode() in response.content

    def test_profile_404_for_nonexistent_user(self, client):
        """Test 404 for non-existent user."""
        url = reverse("users:profile", kwargs={"username": "nonexistent"})
        response = client.get(url)

        assert response.status_code == 404

    def test_is_own_profile_flag(self, client, django_user_model):
        """Test is_own_profile context variable."""
        user = django_user_model.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

        # Not logged in
        url = reverse("users:profile", kwargs={"username": user.username})
        response = client.get(url)

        assert response.context["is_own_profile"] is False

        # Logged in as same user
        client.force_login(user)
        response = client.get(url)

        assert response.context["is_own_profile"] is True

    def test_own_profile_shows_logout_link(self, client, django_user_model):
        """No próprio perfil, deve aparecer link de logout (substitui o que estava no header)."""
        user = django_user_model.objects.create_user(username="alice", email="alice@example.com", password="pass")
        client.force_login(user)

        resp = client.get(reverse("users:profile", kwargs={"username": "alice"})).content.decode()
        assert "/accounts/logout/" in resp
        assert "Sair" in resp

    def test_other_users_profile_hides_logout_link(self, client, django_user_model):
        """Logout só aparece quando is_own_profile — não no perfil de terceiros."""
        owner = django_user_model.objects.create_user(username="bob", email="bob@example.com", password="pass")
        viewer = django_user_model.objects.create_user(username="carol", email="carol@example.com", password="pass")
        client.force_login(viewer)

        resp = client.get(reverse("users:profile", kwargs={"username": owner.username})).content.decode()
        assert "/accounts/logout/" not in resp


@pytest.mark.django_db
class TestProfileEditView:
    """Tests for profile edit view."""

    def test_edit_requires_login(self, client, django_user_model):
        """Test that edit view requires login."""
        user = django_user_model.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

        url = reverse("users:profile_edit", kwargs={"username": user.username})
        response = client.get(url)

        assert response.status_code == 302
        assert "/accounts/login/" in response.url

    def test_edit_own_profile(self, client, django_user_model):
        """Test editing own profile."""
        user = django_user_model.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

        client.force_login(user)

        url = reverse("users:profile_edit", kwargs={"username": user.username})
        response = client.get(url)

        assert response.status_code == 200

    def test_cannot_edit_other_profile(self, client, django_user_model):
        """Test that user cannot edit other user's profile."""
        user1 = django_user_model.objects.create_user(username="user1", email="user1@example.com", password="pass123")

        user2 = django_user_model.objects.create_user(username="user2", email="user2@example.com", password="pass123")

        client.force_login(user1)

        url = reverse("users:profile_edit", kwargs={"username": user2.username})
        response = client.get(url)

        # Should redirect to user2's profile (not allowed to edit)
        assert response.status_code == 302
        assert f"/perfil/{user2.username}/" in response.url

    def test_update_profile_data(self, client, django_user_model):
        """Test updating profile data."""
        user = django_user_model.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

        client.force_login(user)

        url = reverse("users:profile_edit", kwargs={"username": user.username})
        response = client.post(
            url,
            {
                "first_name": "John",
                "last_name": "Doe",
                "bio": "Test bio",
            },
        )

        # Should redirect to profile
        assert response.status_code == 302

        user.refresh_from_db()
        assert user.first_name == "John"
        assert user.last_name == "Doe"
        assert user.bio == "Test bio"


@pytest.mark.django_db
class TestUploadView:
    """Tests for upload view."""

    def test_upload_requires_login(self, client):
        """Test that upload view requires login."""
        url = reverse("users:upload")
        response = client.get(url)

        assert response.status_code == 302
        assert "/accounts/login/" in response.url

    def test_upload_view_loads_for_logged_in(self, client, django_user_model):
        """Test that upload view loads for logged in user."""
        user = django_user_model.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

        client.force_login(user)

        url = reverse("users:upload")
        response = client.get(url)

        assert response.status_code == 200
        assert b"Contribuir" in response.content

    def test_upload_view_has_form(self, client, django_user_model):
        """Test that upload view has form."""
        user = django_user_model.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

        client.force_login(user)

        url = reverse("users:upload")
        response = client.get(url)

        assert response.status_code == 200
        assert b'name="pdf_file"' in response.content
        assert b'name="cover_image"' in response.content
