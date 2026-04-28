"""
Management command to import hymn books from YAML files.

Usage:
    python manage.py import_yaml <yaml_file_path>
    python manage.py import_yaml <yaml_file_path> --update
"""

import os
from datetime import datetime

import yaml
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.hymns.models import Hymn, HymnBook


class Command(BaseCommand):
    help = "Import hymn books from YAML files"

    def add_arguments(self, parser):
        parser.add_argument("yaml_file", type=str, help="Path to the YAML file to import")
        parser.add_argument("--update", action="store_true", help="Update existing hymn book if it already exists")
        parser.add_argument("--dry-run", action="store_true", help="Preview import without saving to database")
        parser.add_argument(
            "--mark-reviewed",
            action="store_true",
            help="Marca os hinos importados como já revisados (use só se confiar 100% no YAML)",
        )

    def handle(self, *args, **options):
        yaml_file = options["yaml_file"]
        update = options["update"]
        dry_run = options["dry_run"]
        self.mark_reviewed = options.get("mark_reviewed", False)

        # Check if file exists
        if not os.path.exists(yaml_file):
            raise CommandError(f"File not found: {yaml_file}")

        # Load YAML
        try:
            with open(yaml_file, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
        except yaml.YAMLError as e:
            raise CommandError(f"Error parsing YAML file: {e}") from e
        except Exception as e:
            raise CommandError(f"Error reading file: {e}") from e

        # Validate structure
        if "hymn_book" not in data:
            raise CommandError("YAML file must contain 'hymn_book' key")

        hymn_book_data = data["hymn_book"]

        # Extract required fields
        name = hymn_book_data.get("name", "").strip()
        if not name:
            raise CommandError("hymn_book.name is required")

        owner_name = hymn_book_data.get("owner", "").strip()
        if not owner_name:
            raise CommandError("hymn_book.owner is required")

        intro_name = hymn_book_data.get("intro_name", "").strip()
        # cover_image_path = hymn_book_data.get("cover_image_path", "")  # TODO: Implement cover image upload
        hymns_data = hymn_book_data.get("hymns", [])

        if not hymns_data:
            raise CommandError("No hymns found in YAML file")

        # Check for duplicate hymn numbers
        hymn_numbers = [h.get("number") for h in hymns_data]
        duplicates = [num for num in set(hymn_numbers) if hymn_numbers.count(num) > 1]
        if duplicates:
            raise CommandError(f"Duplicate hymn numbers found in YAML: {', '.join(map(str, sorted(duplicates)))}")

        self.stdout.write(self.style.SUCCESS(f"\nImporting: {name}"))
        self.stdout.write(f"Owner: {owner_name}")
        self.stdout.write(f"Intro Name: {intro_name}")
        self.stdout.write(f"Number of hymns: {len(hymns_data)}\n")

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN MODE - No changes will be saved\n"))
            self._preview_import(name, owner_name, intro_name, hymns_data)
            return

        # Import to database
        try:
            with transaction.atomic():
                # Check if hymn book exists
                hymn_book = None
                created = False

                try:
                    hymn_book = HymnBook.objects.get(name=name)
                    if not update:
                        raise CommandError(f"Hymn book '{name}' already exists. Use --update to update it.")
                    self.stdout.write(self.style.WARNING(f"Updating existing hymn book: {name}"))
                    # Delete existing hymns
                    hymn_book.hymns.all().delete()
                except HymnBook.DoesNotExist:
                    hymn_book = HymnBook(name=name)
                    created = True

                # Update hymn book fields
                hymn_book.owner_name = owner_name
                hymn_book.intro_name = intro_name
                # Note: cover_image handling would require file management
                hymn_book.save()

                # Create hymns
                hymns_created = 0
                for hymn_data in hymns_data:
                    self._create_hymn(hymn_book, hymn_data)
                    hymns_created += 1
                    if hymns_created % 10 == 0:
                        self.stdout.write(f"  Created {hymns_created}/{len(hymns_data)} hymns...")

                action = "Created" if created else "Updated"
                self.stdout.write(self.style.SUCCESS(f"\n✓ {action} hymn book '{name}' with {hymns_created} hymns"))

        except Exception as e:
            raise CommandError(f"Error importing hymn book: {e}") from e

    def _create_hymn(self, hymn_book, hymn_data):
        """Create a hymn from YAML data."""
        number = hymn_data.get("number")
        title = hymn_data.get("title", "").strip()
        text = hymn_data.get("text", "").strip()

        if not number:
            raise ValueError(f"Hymn number is required for hymn: {title}")
        if not title:
            raise ValueError(f"Hymn title is required for hymn number: {number}")
        if not text:
            raise ValueError(f"Hymn text is required for hymn: {title}")

        # Parse received_at date
        received_at = None
        received_at_str = hymn_data.get("received_at")
        if received_at_str:
            try:
                received_at = datetime.strptime(str(received_at_str), "%Y-%m-%d").date()
            except ValueError:
                self.stdout.write(self.style.WARNING(f"  Invalid date format for hymn {number}: {received_at_str}"))

        review_status = (
            Hymn.ReviewStatus.REVIEWED if getattr(self, "mark_reviewed", False) else Hymn.ReviewStatus.NOT_REVIEWED
        )
        hymn = Hymn.objects.create(
            hymn_book=hymn_book,
            number=number,
            title=title,
            text=text,
            received_at=received_at,
            offered_to=hymn_data.get("offered_to", "").strip(),
            style=hymn_data.get("style", "").strip(),
            extra_instructions=hymn_data.get("extra_instructions", "").strip(),
            repetitions=hymn_data.get("repetitions", "").strip(),
            source=Hymn.Source.YAML,
            review_status=review_status,
        )
        return hymn

    def _preview_import(self, name, owner_name, intro_name, hymns_data):
        """Preview import without saving."""
        self.stdout.write(self.style.SUCCESS("Preview of hymn book:"))
        self.stdout.write(f"  Name: {name}")
        self.stdout.write(f"  Owner: {owner_name}")
        self.stdout.write(f"  Intro Name: {intro_name}")
        self.stdout.write("\nFirst 5 hymns:")

        for _i, hymn_data in enumerate(hymns_data[:5]):
            self.stdout.write(
                f"  {hymn_data.get('number')}. {hymn_data.get('title')} " f"({hymn_data.get('style', 'N/A')})"
            )

        if len(hymns_data) > 5:
            self.stdout.write(f"  ... and {len(hymns_data) - 5} more hymns")
