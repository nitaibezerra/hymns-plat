"""
Tests for Phase 3 views (social features).
"""

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from apps.hymns.models import Favorite, Hymn, HymnAudio, HymnBook
from apps.users.models import Notification, UserFollow

User = get_user_model()


@pytest.mark.django_db
class TestToggleFavorite:
    """Tests for toggle favorite view."""

    def test_favorite_requires_login(self, client):
        """Test that favoriting requires login."""
        hb = HymnBook.objects.create(name="Test", owner_name="Owner")
        hymn = Hymn.objects.create(hymn_book=hb, number=1, title="Test", text="Text")

        url = reverse("hymns:toggle_favorite", kwargs={"hymn_id": hymn.id})
        response = client.post(url)

        assert response.status_code == 302
        assert "/accounts/login/" in response.url

    def test_toggle_favorite_create(self, client):
        """Test creating favorite."""
        user = User.objects.create_user(username="user1", email="user1@example.com", password="pass123")
        hb = HymnBook.objects.create(name="Test", owner_name="Owner")
        hymn = Hymn.objects.create(hymn_book=hb, number=1, title="Test", text="Text")

        client.force_login(user)

        url = reverse("hymns:toggle_favorite", kwargs={"hymn_id": hymn.id})
        response = client.post(url)

        assert response.status_code == 302
        assert Favorite.objects.filter(user=user, hymn=hymn).exists()

    def test_toggle_favorite_remove(self, client):
        """Test removing favorite."""
        user = User.objects.create_user(username="user1", email="user1@example.com", password="pass123")
        hb = HymnBook.objects.create(name="Test", owner_name="Owner")
        hymn = Hymn.objects.create(hymn_book=hb, number=1, title="Test", text="Text")

        Favorite.objects.create(user=user, hymn=hymn)

        client.force_login(user)

        url = reverse("hymns:toggle_favorite", kwargs={"hymn_id": hymn.id})
        response = client.post(url)

        assert response.status_code == 302
        assert not Favorite.objects.filter(user=user, hymn=hymn).exists()


@pytest.mark.django_db
class TestToggleFollow:
    """Tests for toggle follow view."""

    def test_follow_requires_login(self, client):
        """Test that following requires login."""
        user = User.objects.create_user(username="user1", email="user1@example.com", password="pass123")

        url = reverse("users:toggle_follow", kwargs={"username": user.username})
        response = client.post(url)

        assert response.status_code == 302
        assert "/accounts/login/" in response.url

    def test_toggle_follow_create(self, client):
        """Test creating follow."""
        user1 = User.objects.create_user(username="user1", email="user1@example.com", password="pass123")
        user2 = User.objects.create_user(username="user2", email="user2@example.com", password="pass123")

        client.force_login(user1)

        url = reverse("users:toggle_follow", kwargs={"username": user2.username})
        response = client.post(url)

        assert response.status_code == 302
        assert UserFollow.objects.filter(follower=user1, followed=user2).exists()

    def test_toggle_follow_remove(self, client):
        """Test removing follow."""
        user1 = User.objects.create_user(username="user1", email="user1@example.com", password="pass123")
        user2 = User.objects.create_user(username="user2", email="user2@example.com", password="pass123")

        UserFollow.objects.create(follower=user1, followed=user2)

        client.force_login(user1)

        url = reverse("users:toggle_follow", kwargs={"username": user2.username})
        response = client.post(url)

        assert response.status_code == 302
        assert not UserFollow.objects.filter(follower=user1, followed=user2).exists()

    def test_cannot_follow_self(self, client):
        """Test user cannot follow themselves."""
        user = User.objects.create_user(username="user1", email="user1@example.com", password="pass123")

        client.force_login(user)

        url = reverse("users:toggle_follow", kwargs={"username": user.username})
        response = client.post(url)

        assert response.status_code == 302
        assert not UserFollow.objects.filter(follower=user, followed=user).exists()


@pytest.mark.django_db
class TestNotifications:
    """Tests for notifications views."""

    def test_notifications_list_requires_login(self, client):
        """Test that notifications list requires login."""
        url = reverse("users:notifications")
        response = client.get(url)

        assert response.status_code == 302
        assert "/accounts/login/" in response.url

    def test_notifications_list(self, client):
        """Test viewing notifications list."""
        user = User.objects.create_user(username="user1", email="user1@example.com", password="pass123")

        Notification.objects.create(
            recipient=user, notification_type=Notification.TYPE_FAVORITE, title="Test", message="Test message"
        )

        client.force_login(user)

        url = reverse("users:notifications")
        response = client.get(url)

        assert response.status_code == 200

    def test_unread_count_ajax(self, client):
        """Test unread notifications count AJAX endpoint."""
        user = User.objects.create_user(username="user1", email="user1@example.com", password="pass123")

        Notification.objects.create(
            recipient=user,
            notification_type=Notification.TYPE_FAVORITE,
            title="Test",
            message="Test message",
            is_read=False,
        )

        client.force_login(user)

        url = reverse("users:unread_notifications_count")
        response = client.get(url)

        assert response.status_code == 200
        assert response.json()["count"] == 1


@pytest.mark.django_db
class TestAudioUpload:
    """Tests for audio upload view."""

    def test_audio_upload_requires_login(self, client):
        """Test that audio upload requires login."""
        hb = HymnBook.objects.create(name="Test", owner_name="Owner")
        hymn = Hymn.objects.create(hymn_book=hb, number=1, title="Test", text="Text")

        url = reverse("hymns:upload_audio", kwargs={"hymn_id": hymn.id})
        response = client.get(url)

        assert response.status_code == 302
        assert "/accounts/login/" in response.url

    def test_audio_upload_get(self, client):
        """Test GET shows upload form."""
        user = User.objects.create_user(username="user1", email="user1@example.com", password="pass123")
        hb = HymnBook.objects.create(name="Test", owner_name="Owner")
        hymn = Hymn.objects.create(hymn_book=hb, number=1, title="Test", text="Text")

        client.force_login(user)

        url = reverse("hymns:upload_audio", kwargs={"hymn_id": hymn.id})
        response = client.get(url)

        assert response.status_code == 200

    def test_audio_upload_post_valid(self, client):
        """Test posting valid audio."""
        user = User.objects.create_user(username="user1", email="user1@example.com", password="pass123")
        hb = HymnBook.objects.create(name="Test", owner_name="Owner")
        hymn = Hymn.objects.create(hymn_book=hb, number=1, title="Test", text="Text")

        client.force_login(user)

        audio_file = SimpleUploadedFile("test.mp3", b"fake audio content")

        url = reverse("hymns:upload_audio", kwargs={"hymn_id": hymn.id})
        response = client.post(url, {"audio_file": audio_file, "title": "Test Audio"})

        assert response.status_code == 302
        assert HymnAudio.objects.filter(hymn=hymn, uploaded_by=user).exists()
