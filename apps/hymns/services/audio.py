"""
Geração de waveform e duração de áudios via ffmpeg/ffprobe.

`compute_waveform_peaks` chama ffmpeg para extrair o sinal mono em float32 a
8 kHz e divide em N janelas; cada peak é o RMS da janela, normalizado pelo
máximo. O resultado é uma lista de floats em 0..1 que o frontend renderiza
como barras verticais (igual ao mockup da Fase 2).

`extract_duration_seconds` chama ffprobe.

`_run_in_thread` é um indireto trivial usado pelo signal — facilita patch em
testes (rodar inline) e em produção spawn de daemon thread (não bloqueia o
request).
"""

from __future__ import annotations

import logging
import math
import struct
import subprocess
import threading
from pathlib import Path
from typing import Callable

logger = logging.getLogger(__name__)


def extract_duration_seconds(path: str | Path) -> int | None:
    """Retorna a duração inteira em segundos via ffprobe, ou None se falhar."""
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "csv=p=0",
                str(path),
            ],
            capture_output=True,
            text=True,
            timeout=15,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired) as e:
        logger.warning("ffprobe falhou para %s: %s", path, e)
        return None
    if result.returncode != 0:
        return None
    try:
        return int(round(float(result.stdout.strip())))
    except (TypeError, ValueError):
        return None


def compute_waveform_peaks(path: str | Path, num_samples: int = 120) -> list[float]:
    """
    Retorna `num_samples` peaks normalizados (0..1) representando a amplitude
    RMS do áudio. Lista vazia em caso de erro.
    """
    try:
        proc = subprocess.run(
            [
                "ffmpeg",
                "-v",
                "error",
                "-i",
                str(path),
                "-ac",
                "1",
                "-filter:a",
                "aresample=8000",
                "-map",
                "0:a",
                "-f",
                "f32le",
                "-",
            ],
            capture_output=True,
            timeout=120,
            check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired) as e:
        logger.warning("ffmpeg falhou para %s: %s", path, e)
        return []
    if proc.returncode != 0 or not proc.stdout:
        return []

    raw = proc.stdout
    n_floats = len(raw) // 4
    if n_floats == 0:
        return []
    samples = struct.unpack(f"<{n_floats}f", raw[: n_floats * 4])

    if num_samples <= 0:
        return []
    window = max(1, n_floats // num_samples)
    peaks: list[float] = []
    for i in range(num_samples):
        start = i * window
        end = start + window if i < num_samples - 1 else n_floats
        chunk = samples[start:end] if start < n_floats else ()
        if not chunk:
            peaks.append(0.0)
            continue
        # RMS — robusto para sinal AC.
        rms = math.sqrt(sum(s * s for s in chunk) / len(chunk))
        peaks.append(rms)

    peak_max = max(peaks) if peaks else 0.0
    if peak_max <= 0:
        return [0.0] * num_samples
    return [round(p / peak_max, 4) for p in peaks]


def _run_in_thread(fn: Callable, *args, **kwargs) -> None:
    """Spawn de daemon thread. Em testes, patch para rodar inline."""
    threading.Thread(target=fn, args=args, kwargs=kwargs, daemon=True).start()


def populate_waveform_for_audio(audio_pk) -> None:
    """
    Worker que recarrega o HymnAudio, gera peaks e duration, e salva.
    Idempotente: se peaks já existem, não faz nada.
    """
    from apps.hymns.models import HymnAudio

    try:
        audio = HymnAudio.objects.get(pk=audio_pk)
    except HymnAudio.DoesNotExist:
        return
    if audio.waveform_peaks:
        return
    if not audio.audio_file:
        return

    path = audio.audio_file.path
    peaks = compute_waveform_peaks(path)
    duration = extract_duration_seconds(path) if not audio.duration else audio.duration

    HymnAudio.objects.filter(pk=audio.pk).update(
        waveform_peaks=peaks,
        duration=duration,
    )
