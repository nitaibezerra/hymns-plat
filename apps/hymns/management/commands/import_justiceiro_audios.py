"""
One-off: baixa os áudios da comitiva do Padrinho Alfredo (Justiceiro) e cria
um HymnAudio (não aprovado) para cada hino do hinário "O Justiceiro".

Pula hinos que já têm áudio. Editor revisa em /editor/audios/.

Uso:
    poetry run python manage.py import_justiceiro_audios
"""

from __future__ import annotations

import time
from urllib.request import Request, urlopen

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

from apps.hymns.models import HymnAudio, HymnBook
from apps.users.models import User

BASE_URL = "https://hinos.santodaime.org/audio/acervo/sebastiao/justiceiro/comitiva/"
SOURCE_PAGE = "https://hinos.santodaime.org/acervo/padrinho-sebastiao-mota/justiceiro-comitiva"
TITLE = "Gravado em trabalho ao vivo com a comitiva do Padrinho Alfredo, 2013"
RECORDED_AT = "2013-01-01"


def _download(url: str) -> bytes:
    req = Request(url, headers={"User-Agent": "hymns-plat-importer/1.0"})
    with urlopen(req, timeout=60) as resp:
        return resp.read()


class Command(BaseCommand):
    help = "Baixa áudios da comitiva e anexa a cada hino do hinário 'O Justiceiro'."

    def add_arguments(self, parser):
        parser.add_argument("--owner-username", default="nitai", help="username dono do upload")

    def handle(self, *args, **options):
        hb = HymnBook.objects.get(name="O Justiceiro")
        user = User.objects.get(username=options["owner_username"])
        hymns = list(hb.hymns.order_by("number"))
        self.stdout.write(self.style.NOTICE(f"Encontrados {len(hymns)} hinos no '{hb.name}'."))

        created = 0
        skipped = 0
        failed: list[tuple[int, str]] = []

        for hymn in hymns:
            if hymn.audios.exists():
                skipped += 1
                self.stdout.write(f"  [{hymn.number:03d}] já tem áudio — pulando.")
                continue

            filename = f"PadSebastiao-comitiva-{hymn.number:03d}.mp3"
            url = f"{BASE_URL}{filename}"
            self.stdout.write(f"  [{hymn.number:03d}] baixando {filename} ...", ending=" ")
            self.stdout.flush()
            try:
                data = _download(url)
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"FALHOU: {e}"))
                failed.append((hymn.number, str(e)))
                continue

            self.stdout.write(f"{len(data) / 1024:.0f} KB", ending=" ")
            self.stdout.flush()
            audio = HymnAudio(
                hymn=hymn,
                title=TITLE,
                source=SOURCE_PAGE,
                recorded_at=RECORDED_AT,
                allow_download=True,
                format="MP3",
                is_approved=False,
                uploaded_by=user,
                file_size=len(data),
            )
            audio.audio_file.save(filename, ContentFile(data), save=False)
            audio.save()
            created += 1
            self.stdout.write(self.style.SUCCESS("✓ salvo"))
            time.sleep(0.1)

        self.stdout.write("")
        self.stdout.write("=" * 60)
        self.stdout.write(self.style.SUCCESS(f"Criados:           {created}"))
        self.stdout.write(f"Pulados (já tem):  {skipped}")
        if failed:
            self.stdout.write(self.style.WARNING(f"Falharam:          {len(failed)}"))
            for n, err in failed[:20]:
                self.stdout.write(f"  hino #{n}: {err}")
        else:
            self.stdout.write("Falharam:          0")
        self.stdout.write("=" * 60)
