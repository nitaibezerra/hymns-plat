"""
Tests for forms (upload and disambiguation forms).
"""

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.hymns.forms import DisambiguationChoiceForm, HymnBookPdfUploadForm, HymnBookVersionForm
from apps.hymns.models import HymnBook


@pytest.mark.django_db
class TestHymnBookPdfUploadForm:
    """Tests for HymnBookPdfUploadForm (PDF-only upload form)."""

    @staticmethod
    def _pdf(name="test.pdf", content=b"%PDF-1.4 dummy"):
        return SimpleUploadedFile(name, content, content_type="application/pdf")

    def test_valid_pdf_with_metadata(self):
        form = HymnBookPdfUploadForm(
            data={"name": "Hinário Teste", "owner_name": "Dono Teste"},
            files={"pdf_file": self._pdf()},
        )
        assert form.is_valid(), form.errors

    def test_invalid_file_extension(self):
        txt = SimpleUploadedFile("not-a-pdf.txt", b"abc", content_type="text/plain")
        form = HymnBookPdfUploadForm(
            data={"name": "X", "owner_name": "Y"},
            files={"pdf_file": txt},
        )
        assert not form.is_valid()
        assert "pdf_file" in form.errors

    def test_file_too_large(self):
        big = SimpleUploadedFile("big.pdf", b"x" * (51 * 1024 * 1024), content_type="application/pdf")
        form = HymnBookPdfUploadForm(
            data={"name": "X", "owner_name": "Y"},
            files={"pdf_file": big},
        )
        assert not form.is_valid()
        assert "pdf_file" in form.errors

    def test_missing_pdf(self):
        form = HymnBookPdfUploadForm(data={"name": "X", "owner_name": "Y"}, files={})
        assert not form.is_valid()
        assert "pdf_file" in form.errors

    def test_missing_name(self):
        form = HymnBookPdfUploadForm(data={"owner_name": "Y"}, files={"pdf_file": self._pdf()})
        assert not form.is_valid()
        assert "name" in form.errors

    def test_missing_owner(self):
        form = HymnBookPdfUploadForm(data={"name": "X"}, files={"pdf_file": self._pdf()})
        assert not form.is_valid()
        assert "owner_name" in form.errors

    def test_pdf_at_size_boundary(self):
        boundary = SimpleUploadedFile("boundary.pdf", b"x" * (50 * 1024 * 1024), content_type="application/pdf")
        form = HymnBookPdfUploadForm(
            data={"name": "X", "owner_name": "Y"},
            files={"pdf_file": boundary},
        )
        assert form.is_valid(), form.errors


@pytest.mark.django_db
class TestHymnBookVersionForm:
    """Tests for HymnBookVersion form."""

    def test_valid_version_form(self):
        """Test form with valid data."""
        form = HymnBookVersionForm(data={"version_name": "Versão 2023", "description": "Test description"})

        assert form.is_valid()

    def test_missing_required_fields(self):
        """Test form with missing required fields."""
        form = HymnBookVersionForm(data={})

        assert not form.is_valid()
        assert "version_name" in form.errors

    def test_optional_description(self):
        """Test that description is optional."""
        form = HymnBookVersionForm(data={"version_name": "Versão 2023"})

        assert form.is_valid()

    def test_version_name_max_length(self):
        """Test version_name respects max_length."""
        # 101 characters (over the limit of 100)
        long_name = "x" * 101

        form = HymnBookVersionForm(data={"version_name": long_name})

        assert not form.is_valid()
        assert "version_name" in form.errors


@pytest.mark.django_db
class TestDisambiguationChoiceForm:
    """Tests for disambiguation choice form."""

    def test_create_new_choice(self):
        """Test choosing to create new hymnbook."""
        form = DisambiguationChoiceForm(data={"choice": "create_new"})

        assert form.is_valid()

    def test_add_version_choice_with_hymnbook(self):
        """Test choosing to add version with hymnbook selected."""
        hb = HymnBook.objects.create(name="Existing", owner_name="Owner")

        form = DisambiguationChoiceForm(
            data={"choice": "add_version", "selected_hymnbook": str(hb.id), "version_name": "V2"}
        )

        assert form.is_valid()

    def test_add_version_choice_missing_hymnbook(self):
        """Test add_version without selecting hymnbook."""
        form = DisambiguationChoiceForm(data={"choice": "add_version", "version_name": "V2"})

        assert not form.is_valid()
        assert "selected_hymnbook" in form.errors or "__all__" in form.errors

    def test_add_version_choice_missing_version_name(self):
        """Test add_version without version name."""
        hb = HymnBook.objects.create(name="Existing", owner_name="Owner")

        form = DisambiguationChoiceForm(data={"choice": "add_version", "selected_hymnbook": str(hb.id)})

        assert not form.is_valid()
        assert "version_name" in form.errors or "__all__" in form.errors

    def test_cancel_choice(self):
        """Test choosing to cancel."""
        form = DisambiguationChoiceForm(data={"choice": "cancel"})

        assert form.is_valid()

    def test_invalid_choice(self):
        """Test invalid choice value."""
        form = DisambiguationChoiceForm(data={"choice": "invalid_option"})

        assert not form.is_valid()
        assert "choice" in form.errors

    def test_missing_choice(self):
        """Test missing choice field."""
        form = DisambiguationChoiceForm(data={})

        assert not form.is_valid()
        assert "choice" in form.errors


@pytest.mark.django_db
class TestFormIntegration:
    """Integration tests for forms."""

    def test_upload_form_with_pdf_metadata(self):
        """Realistic upload: PDF + Brazilian-Portuguese metadata."""
        pdf_file = SimpleUploadedFile("o-cruzeiro.pdf", b"%PDF-1.4 dummy", content_type="application/pdf")
        form = HymnBookPdfUploadForm(
            data={"name": "O Cruzeiro", "owner_name": "Mestre Irineu"},
            files={"pdf_file": pdf_file},
        )
        assert form.is_valid(), form.errors
        assert form.cleaned_data["pdf_file"] is not None
        assert form.cleaned_data["name"] == "O Cruzeiro"
        assert form.cleaned_data["owner_name"] == "Mestre Irineu"

    def test_version_form_saves_correctly(self):
        """Test that version form data can be saved."""
        hb = HymnBook.objects.create(name="Test Hymnbook", owner_name="Test Owner")

        form = HymnBookVersionForm(
            data={
                "version_name": "Edição 2023",
                "description": "Versão revisada em 2023",
            }
        )

        assert form.is_valid()

        # Save and set hymn_book manually (as done in view)
        version = form.save(commit=False)
        version.hymn_book = hb
        version.uploaded_by = None
        version.save()

        assert version.hymn_book == hb
        assert version.version_name == "Edição 2023"
        assert version.description == "Versão revisada em 2023"
