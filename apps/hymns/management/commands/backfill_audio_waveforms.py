"""
Popula `HymnAudio.waveform_peaks` para todos os áudios que ainda não têm.

Uso:
    poetry run python manage.py backfill_audio_waveforms
"""

from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.hymns.models import HymnAudio
from apps.hymns.services.audio import populate_waveform_for_audio


class Command(BaseCommand):
    help = "Gera peaks de waveform para áudios sem waveform_peaks pré-computado."

    def handle(self, *args, **options):
        qs = HymnAudio.objects.filter(waveform_peaks=[]).order_by("created_at")
        total = qs.count()
        self.stdout.write(self.style.NOTICE(f"Áudios sem peaks: {total}"))

        ok = 0
        fail = 0
        for i, audio in enumerate(qs, start=1):
            self.stdout.write(f"  [{i:>3}/{total}] {audio.audio_file.name} ...", ending=" ")
            self.stdout.flush()
            try:
                populate_waveform_for_audio(audio.pk)
                audio.refresh_from_db()
                if audio.waveform_peaks:
                    self.stdout.write(self.style.SUCCESS("✓"))
                    ok += 1
                else:
                    self.stdout.write(self.style.WARNING("vazio (ffmpeg falhou)"))
                    fail += 1
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"erro: {e}"))
                fail += 1

        self.stdout.write("")
        self.stdout.write("=" * 50)
        self.stdout.write(self.style.SUCCESS(f"OK:    {ok}"))
        if fail:
            self.stdout.write(self.style.WARNING(f"Falha: {fail}"))
        self.stdout.write("=" * 50)
