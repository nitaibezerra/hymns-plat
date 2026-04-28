"""
Tests for Phase 3 models (HymnAudio, Favorite, UserFollow, Notification).
"""

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError

from apps.hymns.models import Favorite, Hymn, HymnAudio, HymnBook
from apps.users.models import Notification, UserFollow

User = get_user_model()


@pytest.mark.django_db
class TestHymnAudioModel:
    """Tests for HymnAudio model."""

    def test_create_hymn_audio(self):
        """Test creating hymn audio."""
        user = User.objects.create_user(username="uploader", email="uploader@example.com", password="pass123")
        hb = HymnBook.objects.create(name="Test Book", owner_name="Owner")
        hymn = Hymn.objects.create(hymn_book=hb, number=1, title="Test Hymn", text="Text")

        audio_file = SimpleUploadedFile("test.mp3", b"fake audio content")
        audio = HymnAudio.objects.create(
            hymn=hymn, audio_file=audio_file, title="Test Audio", uploaded_by=user, format="MP3"
        )

        assert audio.hymn == hymn
        assert audio.uploaded_by == user
        assert audio.is_approved is False  # Default

    def test_hymn_audio_str(self):
        """Test string representation."""
        hb = HymnBook.objects.create(name="Test Book", owner_name="Owner")
        hymn = Hymn.objects.create(hymn_book=hb, number=1, title="Test Hymn", text="Text")

        audio_file = SimpleUploadedFile("test.mp3", b"fake audio content")
        audio = HymnAudio.objects.create(hymn=hymn, audio_file=audio_file, title="Recorded 2023")

        assert "Test Hymn" in str(audio)
        assert "Recorded 2023" in str(audio)

    def test_hymn_audio_cascade_delete(self):
        """Test cascade delete when hymn is deleted."""
        hb = HymnBook.objects.create(name="Test Book", owner_name="Owner")
        hymn = Hymn.objects.create(hymn_book=hb, number=1, title="Test Hymn", text="Text")

        audio_file = SimpleUploadedFile("test.mp3", b"fake audio content")
        audio = HymnAudio.objects.create(hymn=hymn, audio_file=audio_file)

        hymn.delete()

        assert not HymnAudio.objects.filter(id=audio.id).exists()


@pytest.mark.django_db
class TestFavoriteModel:
    """Tests for Favorite model."""

    def test_create_favorite(self):
        """Test creating favorite."""
        user = User.objects.create_user(username="user1", email="user1@example.com", password="pass123")
        hb = HymnBook.objects.create(name="Test Book", owner_name="Owner")
        hymn = Hymn.objects.create(hymn_book=hb, number=1, title="Test Hymn", text="Text")

        favorite = Favorite.objects.create(user=user, hymn=hymn)

        assert favorite.user == user
        assert favorite.hymn == hymn

    def test_favorite_unique_together(self):
        """Test that user can't favorite same hymn twice."""
        user = User.objects.create_user(username="user1", email="user1@example.com", password="pass123")
        hb = HymnBook.objects.create(name="Test Book", owner_name="Owner")
        hymn = Hymn.objects.create(hymn_book=hb, number=1, title="Test Hymn", text="Text")

        Favorite.objects.create(user=user, hymn=hymn)

        with pytest.raises(IntegrityError):
            Favorite.objects.create(user=user, hymn=hymn)

    def test_favorite_str(self):
        """Test string representation."""
        user = User.objects.create_user(username="user1", email="user1@example.com", password="pass123")
        hb = HymnBook.objects.create(name="Test Book", owner_name="Owner")
        hymn = Hymn.objects.create(hymn_book=hb, number=1, title="Test Hymn", text="Text")

        favorite = Favorite.objects.create(user=user, hymn=hymn)

        assert "user1" in str(favorite)
        assert "Test Hymn" in str(favorite)


@pytest.mark.django_db
class TestUserFollowModel:
    """Tests for UserFollow model."""

    def test_create_follow(self):
        """Test creating follow relationship."""
        user1 = User.objects.create_user(username="user1", email="user1@example.com", password="pass123")
        user2 = User.objects.create_user(username="user2", email="user2@example.com", password="pass123")

        follow = UserFollow.objects.create(follower=user1, followed=user2)

        assert follow.follower == user1
        assert follow.followed == user2

    def test_follow_unique_together(self):
        """Test that same follow can't exist twice."""
        user1 = User.objects.create_user(username="user1", email="user1@example.com", password="pass123")
        user2 = User.objects.create_user(username="user2", email="user2@example.com", password="pass123")

        UserFollow.objects.create(follower=user1, followed=user2)

        with pytest.raises(IntegrityError):
            UserFollow.objects.create(follower=user1, followed=user2)

    def test_follow_str(self):
        """Test string representation."""
        user1 = User.objects.create_user(username="user1", email="user1@example.com", password="pass123")
        user2 = User.objects.create_user(username="user2", email="user2@example.com", password="pass123")

        follow = UserFollow.objects.create(follower=user1, followed=user2)

        assert "user1" in str(follow)
        assert "user2" in str(follow)
        assert "segue" in str(follow)


@pytest.mark.django_db
class TestNotificationModel:
    """Tests for Notification model."""

    def test_create_notification(self):
        """Test creating notification."""
        user1 = User.objects.create_user(username="user1", email="user1@example.com", password="pass123")
        user2 = User.objects.create_user(username="user2", email="user2@example.com", password="pass123")

        notification = Notification.objects.create(
            recipient=user1,
            sender=user2,
            notification_type=Notification.TYPE_FOLLOW,
            title="New follower",
            message="user2 followed you",
        )

        assert notification.recipient == user1
        assert notification.sender == user2
        assert notification.is_read is False  # Default

    def test_notification_str(self):
        """Test string representation."""
        user1 = User.objects.create_user(username="user1", email="user1@example.com", password="pass123")

        notification = Notification.objects.create(
            recipient=user1,
            notification_type=Notification.TYPE_FAVORITE,
            title="New favorite",
            message="Someone favorited",
        )

        assert "user1" in str(notification)
        assert "New favorite" in str(notification)

    def test_notification_types(self):
        """Test all notification types are valid."""
        user1 = User.objects.create_user(username="user1", email="user1@example.com", password="pass123")

        types = [
            Notification.TYPE_FOLLOW,
            Notification.TYPE_FAVORITE,
            Notification.TYPE_UPLOAD_APPROVED,
            Notification.TYPE_AUDIO_APPROVED,
        ]

        for ntype in types:
            notification = Notification.objects.create(
                recipient=user1, notification_type=ntype, title="Test", message="Test message"
            )
            assert notification.notification_type == ntype
