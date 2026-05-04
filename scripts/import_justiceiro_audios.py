"""
One-off: baixa os áudios da comitiva do Padrinho Alfredo (Justiceiro) do
servidor https://hinos.santodaime.org e cria HymnAudio para cada hino do
hinário "O Justiceiro" no nosso DB.

Pula hinos que já têm áudio. Não aprova nada — fica para o editor revisar
em /editor/audios/.

Metadados (copiados do áudio aprovado do hino 5):
- title: 'Gravado em trabalho ao vivo com a comitiva do Padrinho Alfredo, 2013'
- source: URL do acervo
- recorded_at: 2013-01-01
- format: MP3
- is_approved: False
- uploaded_by: nitai

Uso:
    DJANGO_SETTINGS_MODULE=config.settings.local uv run python scripts/import_justiceiro_audios.py
"""

from __future__ import annotations

import sys
import time
from urllib.request import Request, urlopen

import django

django.setup()

from django.core.files.base import ContentFile  # noqa: E402

from apps.hymns.models import HymnAudio, HymnBook  # noqa: E402
from apps.users.models import User  # noqa: E402

BASE_URL = "https://hinos.santodaime.org/audio/acervo/sebastiao/justiceiro/comitiva/"
SOURCE_PAGE = "https://hinos.santodaime.org/acervo/padrinho-sebastiao-mota/justiceiro-comitiva"
TITLE = "Gravado em trabalho ao vivo com a comitiva do Padrinho Alfredo, 2013"
RECORDED_AT = "2013-01-01"


def download(url: str) -> bytes:
    req = Request(url, headers={"User-Agent": "hymns-plat-importer/1.0"})
    with urlopen(req, timeout=60) as resp:
        return resp.read()


def main() -> int:
    hb = HymnBook.objects.get(name="O Justiceiro")
    user = User.objects.get(username="nitai")

    hymns = list(hb.hymns.order_by("number"))
    print(f"Encontrados {len(hymns)} hinos no '{hb.name}'.")

    created = 0
    skipped_existing = 0
    failed: list[tuple[int, str]] = []

    for hymn in hymns:
        if hymn.audios.exists():
            skipped_existing += 1
            print(f"  [{hymn.number:03d}] já tem áudio — pulando.")
            continue

        filename = f"PadSebastiao-comitiva-{hymn.number:03d}.mp3"
        url = f"{BASE_URL}{filename}"
        try:
            print(f"  [{hymn.number:03d}] baixando {filename} ...", end=" ", flush=True)
            data = download(url)
            print(f"{len(data) / 1024:.0f} KB", end=" ", flush=True)
        except Exception as e:
            print(f"FALHOU: {e}")
            failed.append((hymn.number, str(e)))
            continue

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
        print("✓ salvo")
        time.sleep(0.1)  # pequena pausa para não sobrecarregar o servidor

    print()
    print("=" * 60)
    print(f"Criados:           {created}")
    print(f"Pulados (já tem):  {skipped_existing}")
    print(f"Falharam:          {len(failed)}")
    if failed:
        print("Falhas:")
        for n, err in failed[:20]:
            print(f"  hino #{n}: {err}")
    print("=" * 60)
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
