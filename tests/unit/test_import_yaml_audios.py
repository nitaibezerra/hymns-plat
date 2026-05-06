"""
Tests for the audio-import feature of the import_yaml command.

Cobre:
- Auto-detect do campo `audios:` (extensão produzida pelo hymns-scraper).
- Resolução de path relativo ao YAML.
- Idempotência por hino com áudio existente.
- Flag --skip-audios.
- Arquivo MP3 ausente: warning + continua.
- --mark-audios-approved.
- --owner-username e atribuição de uploaded_by.
- --dry-run não cria HymnAudio.
"""

from pathlib import Path

import pytest
from django.core.management import call_command

from apps.hymns.models import Hymn, HymnAudio, HymnBook

# Bytes mínimos pra um MP3 não-vazio. Não é um MP3 válido, mas o import só lê
# tamanho/conteúdo via FileField — não decodifica. Suficiente pra teste.
FAKE_MP3_BYTES = b"\xff\xfb\x90\x00fake-mp3-payload-for-tests"


def _make_yaml_with_audios(tmp_path: Path, audios_for_hymn1: list[dict] | None) -> Path:
    """Cria YAML+MP3 fake numa pasta temporária. Retorna o path do YAML."""
    audios_block = ""
    if audios_for_hymn1 is not None:
        audios_block = "\n      audios:\n"
        for entry in audios_for_hymn1:
            audios_block += f"        - path: {entry['path']}\n"
            audios_block += f"          source: {entry['source']}\n"

    yaml_text = f"""hymn_book:
  name: Test Book
  owner: Test Owner
  hymns:
    - number: 1
      title: First
      text: |
        line one
        line two{audios_block}
    - number: 2
      title: Second
      text: |
        another line
"""
    yaml_path = tmp_path / "book.yaml"
    yaml_path.write_text(yaml_text)
    return yaml_path


def _write_mp3(tmp_path: Path, rel_path: str) -> Path:
    abs_path = tmp_path / rel_path
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    abs_path.write_bytes(FAKE_MP3_BYTES)
    return abs_path


@pytest.fixture
def nitai_user(user_factory):
    """O default de --owner-username é `nitai`. Cria-o pra os testes."""
    return user_factory(email="nitai@example.com")


def test_yaml_without_audios_field_is_noop(db, nitai_user, tmp_path):
    """Comportamento legado: YAML sem `audios:` não cria HymnAudio."""
    yaml_path = _make_yaml_with_audios(tmp_path, audios_for_hymn1=None)
    call_command("import_yaml", str(yaml_path))
    assert HymnBook.objects.count() == 1
    assert Hymn.objects.count() == 2
    assert HymnAudio.objects.count() == 0


def test_yaml_with_audios_creates_hymn_audio_records(db, nitai_user, tmp_path):
    _write_mp3(tmp_path, "audios/001.mp3")
    yaml_path = _make_yaml_with_audios(
        tmp_path,
        audios_for_hymn1=[{"path": "audios/001.mp3", "source": "Studio Recording 2024"}],
    )

    call_command("import_yaml", str(yaml_path))

    assert HymnAudio.objects.count() == 1
    hymn1 = Hymn.objects.get(number=1)
    audio = hymn1.audios.get()
    assert audio.source == "Studio Recording 2024"
    assert audio.format == "MP3"
    assert audio.is_approved is False
    assert audio.file_size == len(FAKE_MP3_BYTES)
    assert audio.audio_file.name.endswith(".mp3")


def test_audio_path_resolved_relative_to_yaml_file(db, nitai_user, tmp_path):
    """O `path:` do YAML é interpretado relativo ao diretório do YAML, não ao
    CWD do comando — caso o usuário rode de outro lugar."""
    sub = tmp_path / "scraper-out" / "cruzeiro"
    sub.mkdir(parents=True)
    yaml_path = _make_yaml_with_audios(sub, audios_for_hymn1=[{"path": "audios/001.mp3", "source": "X"}])
    _write_mp3(sub, "audios/001.mp3")

    # Roda do tmp_path (não de `sub`) pra evitar dependência de CWD
    call_command("import_yaml", str(yaml_path))
    assert HymnAudio.objects.count() == 1


def test_skip_audios_flag_omits_audio_creation(db, nitai_user, tmp_path):
    _write_mp3(tmp_path, "audios/001.mp3")
    yaml_path = _make_yaml_with_audios(tmp_path, audios_for_hymn1=[{"path": "audios/001.mp3", "source": "X"}])

    call_command("import_yaml", str(yaml_path), "--skip-audios")
    assert HymnAudio.objects.count() == 0


def test_idempotent_skips_hymns_with_existing_audio(db, nitai_user, tmp_path):
    """Re-rodar (sem --update) com hinos pré-existentes que já têm áudio
    deve preservar os áudios e não duplicar."""
    _write_mp3(tmp_path, "audios/001.mp3")
    yaml_path = _make_yaml_with_audios(tmp_path, audios_for_hymn1=[{"path": "audios/001.mp3", "source": "X"}])

    # Primeira vez: cria 1 áudio
    call_command("import_yaml", str(yaml_path))
    assert HymnAudio.objects.count() == 1

    # Segunda vez com --update: hinos são deletados (cascade derruba os áudios),
    # depois recriados. Após a reinjeção, o áudio é importado de novo:
    call_command("import_yaml", str(yaml_path), "--update")
    assert HymnAudio.objects.count() == 1, "deve continuar 1 áudio (não duplicar)"


def test_missing_audio_file_warns_and_continues(db, nitai_user, tmp_path):
    """Path inválido não aborta o import — apenas pula esse áudio. Hinos
    seguintes continuam normalmente."""
    yaml_path = _make_yaml_with_audios(
        tmp_path,
        audios_for_hymn1=[{"path": "audios/missing.mp3", "source": "X"}],
    )

    call_command("import_yaml", str(yaml_path))
    assert HymnBook.objects.count() == 1
    assert Hymn.objects.count() == 2
    assert HymnAudio.objects.count() == 0


def test_mark_audios_approved_sets_is_approved_true(db, nitai_user, tmp_path):
    _write_mp3(tmp_path, "audios/001.mp3")
    yaml_path = _make_yaml_with_audios(tmp_path, audios_for_hymn1=[{"path": "audios/001.mp3", "source": "X"}])

    call_command("import_yaml", str(yaml_path), "--mark-audios-approved")
    audio = HymnAudio.objects.get()
    assert audio.is_approved is True


def test_owner_username_assigns_uploaded_by(db, user_factory, tmp_path):
    user = user_factory(email="someone@example.com")
    _write_mp3(tmp_path, "audios/001.mp3")
    yaml_path = _make_yaml_with_audios(tmp_path, audios_for_hymn1=[{"path": "audios/001.mp3", "source": "X"}])

    call_command("import_yaml", str(yaml_path), "--owner-username", user.username)
    audio = HymnAudio.objects.get()
    assert audio.uploaded_by_id == user.id


def test_hymn_with_empty_text_is_allowed(db, nitai_user, tmp_path):
    """Hinos só-música (ex.: #127 de O Cruzeiro) têm texto vazio no portal-fonte.
    Devem ser importados normalmente — quem decide se completar é o editor."""
    yaml_text = """hymn_book:
  name: Music Only Book
  owner: Test Owner
  hymns:
    - number: 1
      title: First
      text: |
        com letra
    - number: 127
      title: Hino 127
      text: ''
"""
    yaml_path = tmp_path / "book.yaml"
    yaml_path.write_text(yaml_text)

    call_command("import_yaml", str(yaml_path))
    assert HymnBook.objects.count() == 1
    hymn_127 = Hymn.objects.get(number=127)
    assert hymn_127.text == ""


def test_audio_import_skips_waveform_signal_thread(db, nitai_user, tmp_path):
    """Durante import_yaml em massa, o signal de waveform NÃO deve disparar
    a thread daemon (esgota conexões no postgres com 100+ áudios). O backfill
    fica pra o comando dedicado `backfill_audio_waveforms`."""
    from unittest.mock import patch

    _write_mp3(tmp_path, "audios/001.mp3")
    yaml_path = _make_yaml_with_audios(tmp_path, audios_for_hymn1=[{"path": "audios/001.mp3", "source": "X"}])

    with patch("apps.hymns.services.audio._run_in_thread") as mock_run:
        call_command("import_yaml", str(yaml_path))

    assert not mock_run.called, "signal de waveform não deve spawn thread durante import_yaml"
    audio = HymnAudio.objects.get()
    assert audio.waveform_peaks == []  # vazio até backfill


def test_dry_run_does_not_create_audios(db, nitai_user, tmp_path):
    _write_mp3(tmp_path, "audios/001.mp3")
    yaml_path = _make_yaml_with_audios(tmp_path, audios_for_hymn1=[{"path": "audios/001.mp3", "source": "X"}])

    call_command("import_yaml", str(yaml_path), "--dry-run")
    assert HymnBook.objects.count() == 0
    assert HymnAudio.objects.count() == 0
