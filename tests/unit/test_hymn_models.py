"""
Unit tests for Hymn models.
"""

import pytest
from django.db import IntegrityError

from apps.hymns.models import Hymn, HymnBook


@pytest.mark.django_db
class TestHymnBookModel:
    """Tests for HymnBook model."""

    def test_create_hymnbook(self):
        """Test creating a hymn book."""
        hymn_book = HymnBook.objects.create(name="O Cruzeiro", owner_name="Mestre Irineu", intro_name="Cruzeiro")
        assert hymn_book.id is not None
        assert hymn_book.name == "O Cruzeiro"
        assert hymn_book.owner_name == "Mestre Irineu"
        assert hymn_book.intro_name == "Cruzeiro"
        assert hymn_book.slug == "o-cruzeiro"

    def test_hymnbook_auto_slug(self):
        """Test that slug is auto-generated from name."""
        hymn_book = HymnBook.objects.create(name="Hinário do Padrinho Sebastião", owner_name="Padrinho Sebastião")
        assert hymn_book.slug == "hinario-do-padrinho-sebastiao"

    def test_hymnbook_unique_name(self):
        """Test that hymn book name must be unique."""
        HymnBook.objects.create(name="O Cruzeiro", owner_name="Mestre Irineu")
        with pytest.raises(IntegrityError):
            HymnBook.objects.create(name="O Cruzeiro", owner_name="Outro")

    def test_hymnbook_str(self):
        """Test string representation."""
        hymn_book = HymnBook.objects.create(name="O Cruzeiro", owner_name="Mestre Irineu")
        assert str(hymn_book) == "O Cruzeiro"

    def test_hymnbook_hymn_count(self):
        """Test hymn count property."""
        hymn_book = HymnBook.objects.create(name="O Cruzeiro", owner_name="Mestre Irineu")
        assert hymn_book.hymn_count == 0

        # Add hymns
        Hymn.objects.create(hymn_book=hymn_book, number=1, title="Lua Branca", text="Lua branca...")
        Hymn.objects.create(hymn_book=hymn_book, number=2, title="Tuperci", text="Tuperci...")
        assert hymn_book.hymn_count == 2

    def test_hymnbook_with_owner_user(self, user_factory):
        """Test hymn book with owner user link."""
        user = user_factory(email="mestre@example.com")
        hymn_book = HymnBook.objects.create(name="O Cruzeiro", owner_name="Mestre Irineu", owner_user=user)
        assert hymn_book.owner_user == user
        assert hymn_book in user.owned_hymnbooks.all()


@pytest.mark.django_db
class TestHymnModel:
    """Tests for Hymn model."""

    @pytest.fixture
    def hymn_book(self):
        """Create a hymn book for tests."""
        return HymnBook.objects.create(name="O Cruzeiro", owner_name="Mestre Irineu")

    def test_create_hymn(self, hymn_book):
        """Test creating a hymn."""
        hymn = Hymn.objects.create(
            hymn_book=hymn_book, number=1, title="Lua Branca", text="Lua branca...\nDa luz serena"
        )
        assert hymn.id is not None
        assert hymn.hymn_book == hymn_book
        assert hymn.number == 1
        assert hymn.title == "Lua Branca"
        assert hymn.text == "Lua branca...\nDa luz serena"

    def test_hymn_with_optional_fields(self, hymn_book):
        """Test hymn with all optional fields."""
        from datetime import date

        hymn = Hymn.objects.create(
            hymn_book=hymn_book,
            number=1,
            title="Lua Branca",
            text="Lua branca...",
            received_at=date(1930, 7, 15),
            offered_to="Padrinho Sebastião",
            style="Valsa",
            extra_instructions="Cantar devagar",
            repetitions="1-4, 5-8",
        )
        assert hymn.received_at == date(1930, 7, 15)
        assert hymn.offered_to == "Padrinho Sebastião"
        assert hymn.style == "Valsa"
        assert hymn.extra_instructions == "Cantar devagar"
        assert hymn.repetitions == "1-4, 5-8"

    def test_hymn_unique_number_per_book(self, hymn_book):
        """Test that hymn number must be unique within a hymn book."""
        Hymn.objects.create(hymn_book=hymn_book, number=1, title="Lua Branca", text="...")
        with pytest.raises(IntegrityError):
            Hymn.objects.create(hymn_book=hymn_book, number=1, title="Outro Hino", text="...")

    def test_hymn_same_number_different_books(self):
        """Test that same number can exist in different hymn books."""
        book1 = HymnBook.objects.create(name="O Cruzeiro", owner_name="Mestre Irineu")
        book2 = HymnBook.objects.create(name="Hinário do Padrinho Sebastião", owner_name="Padrinho Sebastião")

        hymn1 = Hymn.objects.create(hymn_book=book1, number=1, title="Lua Branca", text="...")
        hymn2 = Hymn.objects.create(hymn_book=book2, number=1, title="Outro Hino", text="...")

        assert hymn1.number == hymn2.number
        assert hymn1.hymn_book != hymn2.hymn_book

    def test_hymn_str(self, hymn_book):
        """Test string representation."""
        hymn = Hymn.objects.create(hymn_book=hymn_book, number=1, title="Lua Branca", text="...")
        assert str(hymn) == "O Cruzeiro - 1. Lua Branca"

    def test_hymn_full_title(self, hymn_book):
        """Test full_title property."""
        hymn = Hymn.objects.create(hymn_book=hymn_book, number=1, title="Lua Branca", text="...")
        assert hymn.full_title == "O Cruzeiro - 1. Lua Branca"

    def test_hymn_ordering(self, hymn_book):
        """Test that hymns are ordered by hymn_book and number."""
        hymn3 = Hymn.objects.create(hymn_book=hymn_book, number=3, title="Terceiro", text="...")
        hymn1 = Hymn.objects.create(hymn_book=hymn_book, number=1, title="Primeiro", text="...")
        hymn2 = Hymn.objects.create(hymn_book=hymn_book, number=2, title="Segundo", text="...")

        hymns = list(Hymn.objects.all())
        assert hymns == [hymn1, hymn2, hymn3]

    def test_hymn_cascade_delete(self, hymn_book):
        """Test that hymns are deleted when hymn book is deleted."""
        Hymn.objects.create(hymn_book=hymn_book, number=1, title="Lua Branca", text="...")
        Hymn.objects.create(hymn_book=hymn_book, number=2, title="Tuperci", text="...")

        assert Hymn.objects.count() == 2
        hymn_book.delete()
        assert Hymn.objects.count() == 0


@pytest.mark.django_db
class TestHymnBookSlugGeneration:
    """Tests for HymnBook slug generation."""

    def test_slug_auto_generated_on_create(self):
        """Test that slug is automatically generated on create."""
        book = HymnBook.objects.create(name="Hinário do Padrinho Alfredo", owner_name="Padrinho Alfredo")
        assert book.slug == "hinario-do-padrinho-alfredo"

    def test_slug_with_special_characters(self):
        """Test slug generation with special characters."""
        book = HymnBook.objects.create(name="O Cruzeiro - Edição Especial", owner_name="Mestre Irineu")
        assert book.slug == "o-cruzeiro-edicao-especial"

    def test_slug_with_accents(self):
        """Test slug generation with accented characters."""
        book = HymnBook.objects.create(name="Hinário de São José", owner_name="São José")
        assert book.slug == "hinario-de-sao-jose"

    def test_slug_preserved_on_update(self):
        """Test that slug is preserved when updating other fields."""
        book = HymnBook.objects.create(name="Test Book", owner_name="Test Owner")
        original_slug = book.slug
        book.description = "Updated description"
        book.save()
        assert book.slug == original_slug

    def test_slug_not_regenerated_if_already_set(self):
        """Test that existing slug is not overwritten."""
        book = HymnBook.objects.create(name="Test Book", owner_name="Test Owner", slug="custom-slug")
        assert book.slug == "custom-slug"
        book.name = "New Name"
        book.save()
        assert book.slug == "custom-slug"


@pytest.mark.django_db
class TestHymnBookCoverImage:
    """Tests for HymnBook cover image handling."""

    def test_hymnbook_with_cover_image(self, sample_image):
        """Test creating hymn book with cover image."""
        book = HymnBook.objects.create(name="Test Book", owner_name="Test Owner", cover_image=sample_image)
        assert book.cover_image is not None
        assert "test_cover" in book.cover_image.name

    def test_hymnbook_without_cover_image(self):
        """Test creating hymn book without cover image."""
        book = HymnBook.objects.create(name="Test Book", owner_name="Test Owner")
        assert not book.cover_image

    def test_hymnbook_cover_image_optional(self):
        """Test that cover image is optional."""
        book = HymnBook.objects.create(name="Test Book", owner_name="Test Owner", cover_image=None)
        assert book.cover_image.name is None or book.cover_image.name == ""


@pytest.mark.django_db
class TestHymnBookTimestamps:
    """Tests for HymnBook timestamp fields."""

    def test_created_at_auto_set(self):
        """Test that created_at is automatically set."""
        book = HymnBook.objects.create(name="Test Book", owner_name="Test Owner")
        assert book.created_at is not None

    def test_updated_at_auto_set(self):
        """Test that updated_at is automatically set."""
        book = HymnBook.objects.create(name="Test Book", owner_name="Test Owner")
        assert book.updated_at is not None

    def test_updated_at_changes_on_save(self):
        """Test that updated_at changes when model is saved."""
        book = HymnBook.objects.create(name="Test Book", owner_name="Test Owner")
        original_updated_at = book.updated_at
        book.description = "New description"
        book.save()
        book.refresh_from_db()
        assert book.updated_at > original_updated_at


@pytest.mark.django_db
class TestHymnBookRelationships:
    """Tests for HymnBook relationships."""

    def test_hymnbook_hymns_relationship(self):
        """Test that hymns can be accessed from hymn book."""
        book = HymnBook.objects.create(name="Test Book", owner_name="Test Owner")
        Hymn.objects.create(hymn_book=book, number=1, title="Hymn 1", text="Text 1")
        Hymn.objects.create(hymn_book=book, number=2, title="Hymn 2", text="Text 2")
        assert book.hymns.count() == 2

    def test_hymnbook_owner_user_relationship(self, user_factory):
        """Test owner_user relationship with User model."""
        user = user_factory(email="owner@example.com")
        book = HymnBook.objects.create(name="Test Book", owner_name="Test Owner", owner_user=user)
        assert book.owner_user == user
        assert book in user.owned_hymnbooks.all()


@pytest.mark.django_db
class TestHymnEdgeCases:
    """Tests for Hymn model edge cases."""

    def test_hymn_with_empty_optional_fields(self):
        """Test hymn with all optional fields empty."""
        book = HymnBook.objects.create(name="Test Book", owner_name="Test Owner")
        hymn = Hymn.objects.create(hymn_book=book, number=1, title="Test", text="Test text")
        assert hymn.received_at is None
        assert hymn.offered_to == ""
        assert hymn.style == ""
        assert hymn.extra_instructions == ""
        assert hymn.repetitions == ""

    def test_hymn_with_very_long_text(self):
        """Test hymn with very long text."""
        book = HymnBook.objects.create(name="Test Book", owner_name="Test Owner")
        long_text = "Lorem ipsum " * 1000
        hymn = Hymn.objects.create(hymn_book=book, number=1, title="Long Hymn", text=long_text)
        assert len(hymn.text) > 10000

    def test_hymn_with_multiline_text(self):
        """Test hymn with multiline text."""
        book = HymnBook.objects.create(name="Test Book", owner_name="Test Owner")
        text = "Line 1\nLine 2\nLine 3\nLine 4"
        hymn = Hymn.objects.create(hymn_book=book, number=1, title="Multiline", text=text)
        assert "\n" in hymn.text
        assert hymn.text.count("\n") == 3

    def test_hymn_number_can_be_zero(self):
        """Test that hymn number can be zero."""
        book = HymnBook.objects.create(name="Test Book", owner_name="Test Owner")
        hymn = Hymn.objects.create(hymn_book=book, number=0, title="Zero", text="Text")
        assert hymn.number == 0

    def test_hymn_with_large_number(self):
        """Test hymn with large number."""
        book = HymnBook.objects.create(name="Test Book", owner_name="Test Owner")
        hymn = Hymn.objects.create(hymn_book=book, number=9999, title="Large Number", text="Text")
        assert hymn.number == 9999


@pytest.mark.django_db
class TestHymnOptionalFields:
    """Tests for Hymn optional fields."""

    def test_hymn_received_at_field(self):
        """Test received_at field."""
        from datetime import date

        book = HymnBook.objects.create(name="Test Book", owner_name="Test Owner")
        received_date = date(1930, 7, 15)
        hymn = Hymn.objects.create(hymn_book=book, number=1, title="Test", text="Text", received_at=received_date)
        assert hymn.received_at == received_date

    def test_hymn_style_field(self):
        """Test style field."""
        book = HymnBook.objects.create(name="Test Book", owner_name="Test Owner")
        hymn = Hymn.objects.create(hymn_book=book, number=1, title="Test", text="Text", style="Valsa")
        assert hymn.style == "Valsa"

    def test_hymn_repetitions_field(self):
        """Test repetitions field."""
        book = HymnBook.objects.create(name="Test Book", owner_name="Test Owner")
        hymn = Hymn.objects.create(hymn_book=book, number=1, title="Test", text="Text", repetitions="1-4, 5-8")
        assert hymn.repetitions == "1-4, 5-8"


@pytest.mark.django_db
class TestHymnAudioReviewFields:
    """Marco Fase 2 — Audio Review.

    Revisor pode confirmar (✓ Confere) ou marcar mismatch (✗ Não confere) num
    áudio. Quando ✓: avalia qualidade 1-5 + observações. Quando ✗: marca
    motivo + áudio é forçado a `is_approved=False` e quality fields são
    zerados (não fazem sentido). Toggle entre as duas vertentes limpa os
    campos da outra.
    """

    def _make_audio(self):
        from apps.hymns.models import HymnAudio

        book = HymnBook.objects.create(name="B", owner_name="O")
        hymn = Hymn.objects.create(hymn_book=book, number=1, title="t", text="x")
        return HymnAudio.objects.create(hymn=hymn, audio_file="x.mp3", is_approved=True)

    def test_review_fields_default_none(self):
        audio = self._make_audio()
        assert audio.is_match is None
        assert audio.quality_rating is None
        assert audio.quality_observations == []
        assert audio.mismatch_reason == ""
        assert audio.reviewed_by is None
        assert audio.reviewed_at is None

    def test_is_match_false_clears_quality_and_force_unapproves(self):
        audio = self._make_audio()
        audio.is_match = True
        audio.quality_rating = 4
        audio.quality_observations = ["Voz baixa"]
        audio.save()
        # Mudou opinião: agora é mismatch.
        audio.is_match = False
        audio.mismatch_reason = "incomplete"
        audio.save()
        audio.refresh_from_db()
        assert audio.is_match is False
        assert audio.is_approved is False  # mismatch nunca aprova
        assert audio.quality_rating is None  # zerado
        assert audio.quality_observations == []
        assert audio.mismatch_reason == "incomplete"

    def test_is_match_true_clears_mismatch_reason(self):
        audio = self._make_audio()
        audio.is_match = False
        audio.mismatch_reason = "wrong_lyrics"
        audio.save()
        audio.is_match = True
        audio.save()
        audio.refresh_from_db()
        assert audio.is_match is True
        assert audio.mismatch_reason == ""

    def test_quality_rating_validators(self):
        from django.core.exceptions import ValidationError

        from apps.hymns.models import HymnAudio

        audio = self._make_audio()
        audio.is_match = True
        audio.quality_rating = 0
        with pytest.raises(ValidationError):
            audio.full_clean()
        audio.quality_rating = 6
        with pytest.raises(ValidationError):
            audio.full_clean()
        audio.quality_rating = 3
        audio.full_clean()  # ok
        # Garante que o campo está mesmo no model.
        assert HymnAudio._meta.get_field("quality_rating").null is True

    def test_mismatch_reason_choices(self):
        from apps.hymns.models import HymnAudio

        valid = {c[0] for c in HymnAudio.MismatchReason.choices}
        assert valid == {"other_hymn", "incomplete", "wrong_lyrics", "inaudible", "other"}

    def test_quality_observations_class_constant(self):
        from apps.hymns.models import HymnAudio

        assert "Ruído de fundo" in HymnAudio.QUALITY_OBSERVATIONS
        assert "Voz baixa" in HymnAudio.QUALITY_OBSERVATIONS
        assert "Cortes" in HymnAudio.QUALITY_OBSERVATIONS
        assert "Excelente captação" in HymnAudio.QUALITY_OBSERVATIONS
        assert "Mestre de cerimônias" in HymnAudio.QUALITY_OBSERVATIONS
