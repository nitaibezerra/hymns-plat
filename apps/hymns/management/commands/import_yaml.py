"""
Management command to import hymn books from YAML files.

Usage:
    python manage.py import_yaml <yaml_file_path>
    python manage.py import_yaml <yaml_file_path> --update
    python manage.py import_yaml <yaml_file_path> --skip-audios
"""

import os
from datetime import datetime
from pathlib import Path

import yaml
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.hymns.models import Hymn, HymnAudio, HymnBook
from apps.users.models import User


class Command(BaseCommand):
    help = "Import hymn books from YAML files"

    def add_arguments(self, parser):
        parser.add_argument("yaml_file", type=str, help="Path to the YAML file to import")
        parser.add_argument("--update", action="store_true", help="Update existing hymn book if it already exists")
        parser.add_argument("--dry-run", action="store_true", help="Preview import without saving to database")
        parser.add_argument(
            "--mark-reviewed",
            action="store_true",
            help="Marca os hinos importados como já revisados (use apenas com YAML 100 por cento confiável)",
        )
        parser.add_argument(
            "--skip-audios",
            action="store_true",
            help="Pula importação de áudios mesmo se o YAML trouxer o campo audios:",
        )
        parser.add_argument(
            "--owner-username",
            default="nitai",
            help="Username do User que será atribuído como uploaded_by dos áudios (default: nitai)",
        )
        parser.add_argument(
            "--mark-audios-approved",
            action="store_true",
            help="Marca áudios importados como aprovados (default: aguardam revisão)",
        )

    def handle(self, *args, **options):
        yaml_file = options["yaml_file"]
        update = options["update"]
        dry_run = options["dry_run"]
        self.mark_reviewed = options.get("mark_reviewed", False)
        self.skip_audios = options.get("skip_audios", False)
        self.mark_audios_approved = options.get("mark_audios_approved", False)
        owner_username = options.get("owner_username", "nitai")

        if not os.path.exists(yaml_file):
            raise CommandError(f"File not found: {yaml_file}")

        try:
            with open(yaml_file, encoding="utf-8") as f:
                data = yaml.safe_load(f)
        except yaml.YAMLError as e:
            raise CommandError(f"Error parsing YAML file: {e}") from e
        except Exception as e:
            raise CommandError(f"Error reading file: {e}") from e

        if "hymn_book" not in data:
            raise CommandError("YAML file must contain 'hymn_book' key")

        hymn_book_data = data["hymn_book"]
        self.yaml_dir = Path(yaml_file).resolve().parent

        name = hymn_book_data.get("name", "").strip()
        if not name:
            raise CommandError("hymn_book.name is required")

        owner_name = hymn_book_data.get("owner", "").strip()
        if not owner_name:
            raise CommandError("hymn_book.owner is required")

        intro_name = hymn_book_data.get("intro_name", "").strip()
        hymns_data = hymn_book_data.get("hymns", [])

        if not hymns_data:
            raise CommandError("No hymns found in YAML file")

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

        # Carrega o User dono dos áudios uma vez (evita query por hino).
        # Só é necessário se houver áudios pra importar.
        audio_owner: User | None = None
        if not self.skip_audios and any(h.get("audios") for h in hymns_data):
            try:
                audio_owner = User.objects.get(username=owner_username)
            except User.DoesNotExist as e:
                raise CommandError(
                    f"User com username '{owner_username}' não existe. " f"Use --owner-username com um username válido."
                ) from e

        try:
            with transaction.atomic():
                hymn_book = None
                created = False

                try:
                    hymn_book = HymnBook.objects.get(name=name)
                    if not update:
                        raise CommandError(f"Hymn book '{name}' already exists. Use --update to update it.")
                    self.stdout.write(self.style.WARNING(f"Updating existing hymn book: {name}"))
                    hymn_book.hymns.all().delete()
                except HymnBook.DoesNotExist:
                    hymn_book = HymnBook(name=name)
                    created = True

                hymn_book.owner_name = owner_name
                hymn_book.intro_name = intro_name
                hymn_book.save()

                hymns_created = 0
                audios_created = 0
                for hymn_data in hymns_data:
                    hymn = self._create_hymn(hymn_book, hymn_data)
                    hymns_created += 1
                    audios_created += self._create_audios(hymn, hymn_data, audio_owner)
                    if hymns_created % 10 == 0:
                        self.stdout.write(f"  Created {hymns_created}/{len(hymns_data)} hymns...")

                action = "Created" if created else "Updated"
                self.stdout.write(
                    self.style.SUCCESS(
                        f"\n✓ {action} hymn book '{name}' with {hymns_created} hymns "
                        f"and {audios_created} audio recordings"
                    )
                )

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
        # Texto pode vir vazio (hinos só-música, ex.: #127 de O Cruzeiro do Mestre Irineu).

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
            section=hymn_data.get("section", "").strip(),
            source=Hymn.Source.YAML,
            review_status=review_status,
        )
        return hymn

    def _create_audios(self, hymn, hymn_data, owner: User | None) -> int:
        """Cria HymnAudio para cada entry em hymn_data['audios'].

        Pula silenciosamente quando: --skip-audios ativo; hino sem campo
        audios ou lista vazia; hino já tem qualquer áudio (idempotência);
        arquivo MP3 não existe (warning, não aborta).
        """
        if self.skip_audios:
            return 0

        audios_data = hymn_data.get("audios") or []
        if not audios_data:
            return 0

        if hymn.audios.exists():
            self.stdout.write(self.style.WARNING(f"  [{hymn.number:03d}] já tem áudio — pulando importação de áudios."))
            return 0

        created = 0
        for entry in audios_data:
            rel_path = entry.get("path", "").strip()
            source_label = entry.get("source", "").strip()
            if not rel_path:
                continue

            abs_path = (self.yaml_dir / rel_path).resolve()
            if not abs_path.is_file():
                self.stdout.write(
                    self.style.WARNING(f"  [{hymn.number:03d}] arquivo não encontrado: {abs_path} — pulando.")
                )
                continue

            data = abs_path.read_bytes()
            audio = HymnAudio(
                hymn=hymn,
                source=source_label,
                format="MP3",
                is_approved=self.mark_audios_approved,
                uploaded_by=owner,
                file_size=len(data),
            )
            audio.audio_file.save(abs_path.name, ContentFile(data), save=False)
            # Bulk import: pula spawn da daemon thread de waveform (rodar
            # `backfill_audio_waveforms` depois). Senão 100+ threads disparam
            # juntas e esgotam o pool de conexões do postgres.
            audio._skip_waveform_signal = True
            audio.save()
            created += 1

        return created

    def _preview_import(self, name, owner_name, intro_name, hymns_data):
        """Preview import without saving."""
        self.stdout.write(self.style.SUCCESS("Preview of hymn book:"))
        self.stdout.write(f"  Name: {name}")
        self.stdout.write(f"  Owner: {owner_name}")
        self.stdout.write(f"  Intro Name: {intro_name}")

        total_audios = sum(len(h.get("audios") or []) for h in hymns_data)
        if total_audios:
            self.stdout.write(f"  Audios listados: {total_audios}")

        self.stdout.write("\nFirst 5 hymns:")

        for hymn_data in hymns_data[:5]:
            self.stdout.write(
                f"  {hymn_data.get('number')}. {hymn_data.get('title')} ({hymn_data.get('style', 'N/A')})"
            )

        if len(hymns_data) > 5:
            self.stdout.write(f"  ... and {len(hymns_data) - 5} more hymns")
