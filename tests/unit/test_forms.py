"""
Tests for forms (upload and disambiguation forms).
"""

import pytest
import yaml
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.hymns.forms import DisambiguationChoiceForm, HymnBookUploadForm, HymnBookVersionForm
from apps.hymns.models import HymnBook


@pytest.mark.django_db
class TestHymnBookUploadForm:
    """Tests for HymnBook upload form."""

    def test_valid_yaml_file(self):
        """Test form with valid YAML file."""
        yaml_content = yaml.dump(
            {
                "hymn_book": {
                    "name": "Test Hinário",
                    "owner": "Test Owner",
                    "hymns": [{"number": 1, "title": "Hino 1", "text": "Letra"}],
                }
            },
            allow_unicode=True,
        )
        yaml_file = SimpleUploadedFile("test.yaml", yaml_content.encode("utf-8"))

        form = HymnBookUploadForm(files={"yaml_file": yaml_file})

        assert form.is_valid()

    def test_invalid_file_extension(self):
        """Test form rejects non-YAML files."""
        txt_file = SimpleUploadedFile("test.txt", b"not yaml content")

        form = HymnBookUploadForm(files={"yaml_file": txt_file})

        assert not form.is_valid()
        assert "yaml_file" in form.errors

    def test_file_too_large(self):
        """Test form rejects files larger than 10MB."""
        # Create a file larger than 10MB
        large_content = b"x" * (11 * 1024 * 1024)  # 11MB
        large_file = SimpleUploadedFile("large.yaml", large_content)

        form = HymnBookUploadForm(files={"yaml_file": large_file})

        assert not form.is_valid()
        assert "yaml_file" in form.errors

    def test_missing_file(self):
        """Form requires either yaml_file or pdf_file (caught by clean(), not field-level)."""
        form = HymnBookUploadForm(files={})

        assert not form.is_valid()
        # The mutual-exclusion validation lives in clean(), so the error is on __all__
        assert "__all__" in form.errors

    def test_yaml_file_max_size_boundary(self):
        """Test file exactly at 10MB limit."""
        # 10MB exactly
        content = b"x" * (10 * 1024 * 1024)
        yaml_file = SimpleUploadedFile("boundary.yaml", content)

        form = HymnBookUploadForm(files={"yaml_file": yaml_file})

        # Should be valid (at boundary)
        assert form.is_valid()


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

    def test_upload_form_with_real_yaml_structure(self):
        """Test upload form with realistic YAML structure."""
        yaml_content = yaml.dump(
            {
                "hymn_book": {
                    "name": "O Cruzeiro",
                    "owner": "Mestre Irineu",
                    "intro_name": "Cruzeiro",
                    "description": "Hinário do Mestre Irineu",
                    "hymns": [
                        {
                            "number": 1,
                            "title": "Lua Branca",
                            "text": "Da luz serena\nDo mar sagrado",
                            "style": "Valsa",
                            "received_at": "1930-07-15",
                        },
                        {
                            "number": 2,
                            "title": "Tuperci",
                            "text": "Eu canto é na altura\nPara todos ouvir",
                            "style": "Marcha",
                        },
                    ],
                }
            },
            allow_unicode=True,
        )
        yaml_file = SimpleUploadedFile("cruzeiro.yaml", yaml_content.encode("utf-8"))

        form = HymnBookUploadForm(files={"yaml_file": yaml_file})

        assert form.is_valid()
        assert form.cleaned_data["yaml_file"] is not None

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
