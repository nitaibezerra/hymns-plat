"""
Tests for the import_yaml management command.
"""

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.hymns.models import Hymn, HymnBook


class TestImportYamlCommand:
    """Test suite for import_yaml command."""

    def test_imports_valid_yaml(self, db, sample_yaml_valid):
        """Test importing a valid YAML file creates hymnbook and hymns."""
        call_command("import_yaml", sample_yaml_valid)

        assert HymnBook.objects.count() == 1
        hymnbook = HymnBook.objects.first()
        assert hymnbook.name == "O Cruzeiro"
        assert hymnbook.owner_name == "Mestre Irineu"
        assert hymnbook.intro_name == "Cruzeiro"
        assert hymnbook.hymns.count() == 2

    def test_imports_minimal_yaml(self, db, tmp_path):
        """Test importing YAML with minimal required fields."""
        yaml_content = """hymn_book:
  name: Minimal Book
  owner: Owner
  hymns:
    - number: 1
      title: Title
      text: Text
"""
        yaml_file = tmp_path / "minimal.yaml"
        yaml_file.write_text(yaml_content)

        call_command("import_yaml", str(yaml_file))
        assert HymnBook.objects.count() == 1
        hymnbook = HymnBook.objects.first()
        assert hymnbook.name == "Minimal Book"
        assert hymnbook.owner_name == "Owner"
        assert hymnbook.hymns.count() == 1

    def test_raises_error_on_nonexistent_file(self, db):
        """Test that command raises error when file doesn't exist."""
        with pytest.raises(CommandError, match="File not found"):
            call_command("import_yaml", "/nonexistent/file.yaml")

    def test_raises_error_on_invalid_yaml(self, db, tmp_path):
        """Test that command raises error on malformed YAML."""
        yaml_file = tmp_path / "malformed.yaml"
        yaml_file.write_text("invalid: yaml: content: [")

        with pytest.raises(CommandError, match="Error parsing YAML"):
            call_command("import_yaml", str(yaml_file))

    def test_raises_error_on_missing_hymn_book_key(self, db, tmp_path):
        """Test that command raises error when 'hymn_book' key is missing."""
        yaml_file = tmp_path / "no_hymn_book.yaml"
        yaml_file.write_text("name: Test\nhymns: []")

        with pytest.raises(CommandError, match="must contain 'hymn_book' key"):
            call_command("import_yaml", str(yaml_file))

    def test_raises_error_on_missing_name(self, db, tmp_path):
        """Test that command raises error when name is missing."""
        yaml_content = """hymn_book:
  owner: Owner
  hymns:
    - number: 1
      title: Title
      text: Text
"""
        yaml_file = tmp_path / "no_name.yaml"
        yaml_file.write_text(yaml_content)

        with pytest.raises(CommandError, match="hymn_book.name is required"):
            call_command("import_yaml", str(yaml_file))

    def test_raises_error_on_missing_owner(self, db, tmp_path):
        """Test that command raises error when owner is missing."""
        yaml_content = """hymn_book:
  name: Test Book
  hymns:
    - number: 1
      title: Title
      text: Text
"""
        yaml_file = tmp_path / "no_owner.yaml"
        yaml_file.write_text(yaml_content)

        with pytest.raises(CommandError, match="hymn_book.owner is required"):
            call_command("import_yaml", str(yaml_file))

    def test_raises_error_on_empty_hymns(self, db, tmp_path):
        """Test that command raises error when hymns list is empty."""
        yaml_content = """hymn_book:
  name: Test Book
  owner: Owner
  hymns: []
"""
        yaml_file = tmp_path / "no_hymns.yaml"
        yaml_file.write_text(yaml_content)

        with pytest.raises(CommandError, match="No hymns found"):
            call_command("import_yaml", str(yaml_file))

    def test_raises_error_on_duplicate_hymn_numbers(self, db, sample_yaml_duplicates):
        """Test that command raises error on duplicate hymn numbers."""
        with pytest.raises(CommandError, match="Duplicate hymn numbers found"):
            call_command("import_yaml", sample_yaml_duplicates)

    def test_raises_error_on_missing_hymn_title(self, db, tmp_path):
        """Test that command raises error when hymn is missing title."""
        yaml_content = """hymn_book:
  name: Test Book
  owner: Owner
  hymns:
    - number: 1
      text: Text
"""
        yaml_file = tmp_path / "no_title.yaml"
        yaml_file.write_text(yaml_content)

        with pytest.raises(CommandError, match="Hymn title is required"):
            call_command("import_yaml", str(yaml_file))

    def test_allows_hymn_without_text(self, db, tmp_path):
        """Hinos só-música (ex.: #127 de O Cruzeiro do Mestre Irineu) têm texto
        vazio — devem ser aceitos. Editor preenche depois se quiser."""
        yaml_content = """hymn_book:
  name: Test Book
  owner: Owner
  hymns:
    - number: 1
      title: Title
"""
        yaml_file = tmp_path / "no_text.yaml"
        yaml_file.write_text(yaml_content)

        call_command("import_yaml", str(yaml_file))
        from apps.hymns.models import Hymn

        hymn = Hymn.objects.get(number=1)
        assert hymn.text == ""

    def test_raises_error_on_duplicate_hymnbook_without_update(self, db, sample_yaml_valid):
        """Test that command raises error when hymnbook exists and --update not used."""
        # Import once
        call_command("import_yaml", sample_yaml_valid)

        # Try to import again without --update
        with pytest.raises(CommandError, match="already exists.*Use --update"):
            call_command("import_yaml", sample_yaml_valid)

    def test_updates_existing_hymnbook_with_update_flag(self, db, sample_yaml_valid, tmp_path):
        """Test that --update flag updates existing hymnbook."""
        # Import once
        call_command("import_yaml", sample_yaml_valid)
        assert HymnBook.objects.count() == 1
        assert Hymn.objects.count() == 2

        # Create updated YAML with different hymns
        yaml_content = """hymn_book:
  name: O Cruzeiro
  owner: Mestre Irineu
  intro_name: Cruzeiro Updated
  hymns:
    - number: 1
      title: Updated Hymn
      text: Updated text
"""
        yaml_file = tmp_path / "updated.yaml"
        yaml_file.write_text(yaml_content)

        # Import with --update
        call_command("import_yaml", str(yaml_file), "--update")

        # Verify update
        assert HymnBook.objects.count() == 1
        hymnbook = HymnBook.objects.first()
        assert hymnbook.intro_name == "Cruzeiro Updated"
        assert hymnbook.hymns.count() == 1
        assert hymnbook.hymns.first().title == "Updated Hymn"

    def test_dry_run_does_not_save_to_database(self, db, sample_yaml_valid, capsys):
        """Test that --dry-run preview doesn't save to database."""
        call_command("import_yaml", sample_yaml_valid, "--dry-run")

        # Verify nothing was saved
        assert HymnBook.objects.count() == 0
        assert Hymn.objects.count() == 0

        # Verify output contains preview message
        captured = capsys.readouterr()
        assert "DRY RUN MODE" in captured.out
        assert "Preview of hymn book" in captured.out

    def test_parses_received_at_date(self, db, sample_yaml_valid):
        """Test that received_at date is correctly parsed."""
        call_command("import_yaml", sample_yaml_valid)

        hymn = Hymn.objects.get(number=1)
        assert hymn.received_at is not None
        assert hymn.received_at.year == 1930
        assert hymn.received_at.month == 7
        assert hymn.received_at.day == 15

    def test_handles_invalid_date_format_gracefully(self, db, tmp_path, capsys):
        """Test that invalid date format doesn't crash, just logs warning."""
        yaml_content = """hymn_book:
  name: Test Book
  owner: Owner
  hymns:
    - number: 1
      title: Title
      text: Text
      received_at: invalid-date
"""
        yaml_file = tmp_path / "invalid_date.yaml"
        yaml_file.write_text(yaml_content)

        call_command("import_yaml", str(yaml_file))

        # Verify hymn was created without date
        assert Hymn.objects.count() == 1
        hymn = Hymn.objects.first()
        assert hymn.received_at is None

        # Verify warning was logged
        captured = capsys.readouterr()
        assert "Invalid date format" in captured.out

    def test_creates_hymns_with_optional_fields(self, db, tmp_path):
        """Test that optional hymn fields are correctly saved."""
        yaml_content = """hymn_book:
  name: Test Book
  owner: Owner
  hymns:
    - number: 1
      title: Title
      text: Text
      style: Valsa
      offered_to: John Doe
      extra_instructions: Sing slowly
      repetitions: 1-4
"""
        yaml_file = tmp_path / "with_optional.yaml"
        yaml_file.write_text(yaml_content)

        call_command("import_yaml", str(yaml_file))

        hymn = Hymn.objects.first()
        assert hymn.style == "Valsa"
        assert hymn.offered_to == "John Doe"
        assert hymn.extra_instructions == "Sing slowly"
        assert hymn.repetitions == "1-4"

    def test_outputs_progress_messages(self, db, sample_yaml_valid, capsys):
        """Test that command outputs informative messages."""
        call_command("import_yaml", sample_yaml_valid)

        captured = capsys.readouterr()
        assert "Importing: O Cruzeiro" in captured.out
        assert "Owner: Mestre Irineu" in captured.out
        assert "Number of hymns: 2" in captured.out
        assert "Created hymn book" in captured.out

    def test_transaction_rollback_on_error(self, db, tmp_path):
        """Test that database changes are rolled back on error."""
        # Create YAML with an error in the middle (missing number on second hymn)
        yaml_content = """hymn_book:
  name: Test Book
  owner: Owner
  hymns:
    - number: 1
      title: First
      text: Text
    - title: Second
      text: Text
"""
        yaml_file = tmp_path / "with_error.yaml"
        yaml_file.write_text(yaml_content)

        # Try to import
        with pytest.raises(CommandError):
            call_command("import_yaml", str(yaml_file))

        # Verify nothing was saved (transaction rolled back)
        assert HymnBook.objects.count() == 0
        assert Hymn.objects.count() == 0

    def test_imports_multiple_hymns(self, db, tmp_path):
        """Test importing multiple hymns creates all of them."""
        yaml_content = """hymn_book:
  name: Test Book
  owner: Owner
  hymns:
    - number: 1
      title: Hymn 1
      text: Text 1
    - number: 2
      title: Hymn 2
      text: Text 2
    - number: 3
      title: Hymn 3
      text: Text 3
    - number: 4
      title: Hymn 4
      text: Text 4
    - number: 5
      title: Hymn 5
      text: Text 5
"""
        yaml_file = tmp_path / "multiple.yaml"
        yaml_file.write_text(yaml_content)

        call_command("import_yaml", str(yaml_file))

        assert Hymn.objects.count() == 5
        assert list(Hymn.objects.values_list("number", flat=True)) == [1, 2, 3, 4, 5]
