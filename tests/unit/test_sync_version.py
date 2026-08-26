"""
Marco 6 (pré-requisito) — `HymnBook.sync_version`.

Contador monotônico que o cliente offline usa para saber se o hinário que
tem em cache ficou obsoleto. Qualquer mudança em `Hymn` ou `HymnAudio`
(criação, edição ou remoção) incrementa o `sync_version` do hinário pai.

Regras que estes testes travam:
- o incremento é feito via `F()` + `.update()`, logo NÃO dispara `post_save`
  de `HymnBook` (sem cascata de signals, sem perda de corrida);
- salvar o próprio `HymnBook` não mexe no contador e não entra em recursão;
- `loaddata` (raw=True) não incrementa.
"""

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db.models import F

from apps.hymns.models import Hymn, HymnAudio, HymnBook


def _audio(hymn, **kwargs):
    """Áudio com waveform já preenchida para não acordar a thread de peaks."""
    kwargs.setdefault("waveform_peaks", [0.1, 0.2, 0.3])
    return HymnAudio.objects.create(
        hymn=hymn,
        audio_file=SimpleUploadedFile("a.mp3", b"binario", content_type="audio/mpeg"),
        **kwargs,
    )


def _version(hymn_book):
    return HymnBook.objects.values_list("sync_version", flat=True).get(pk=hymn_book.pk)


@pytest.mark.django_db
class TestSyncVersionField:
    def test_hymnbook_comeca_com_sync_version_zero(self, hymn_book):
        assert _version(hymn_book) == 0


@pytest.mark.django_db
class TestSyncVersionHymn:
    def test_criar_hino_incrementa_sync_version_do_hinario(self, hymn_book, hymn_factory):
        hymn_factory(hymn_book=hymn_book, number=1)

        assert _version(hymn_book) == 1

    def test_editar_hino_incrementa_de_novo(self, hymn_book, hymn_factory):
        hymn = hymn_factory(hymn_book=hymn_book, number=1)
        antes = _version(hymn_book)

        hymn.title = "Lua Cheia"
        hymn.save()

        assert _version(hymn_book) == antes + 1

    def test_deletar_hino_incrementa_sync_version(self, hymn_book, hymn_factory):
        hymn = hymn_factory(hymn_book=hymn_book, number=1)
        antes = _version(hymn_book)

        hymn.delete()

        assert _version(hymn_book) == antes + 1

    def test_incremento_isola_hinarios(self, hymn_book_factory, hymn_factory):
        alvo = hymn_book_factory(name="O Cruzeiro Universal")
        vizinho = hymn_book_factory(name="Nova Jerusalém")

        hymn_factory(hymn_book=alvo, number=1)

        assert _version(alvo) == 1
        assert _version(vizinho) == 0

    def test_incremento_nao_perde_corrida_com_valor_stale_em_memoria(self, hymn_book, hymn_factory):
        """
        Simula concorrência: outra transação já incrementou o contador enquanto
        a instância em memória guarda o valor antigo. Como o incremento usa
        `F()` + `.update()`, o valor do banco não é sobrescrito.
        """
        HymnBook.objects.filter(pk=hymn_book.pk).update(sync_version=F("sync_version") + 5)
        assert hymn_book.sync_version == 0  # instância em memória continua stale

        hymn_factory(hymn_book=hymn_book, number=1)

        assert _version(hymn_book) == 6


@pytest.mark.django_db
class TestSyncVersionHymnAudio:
    def test_criar_audio_incrementa_sync_version_do_hinario(self, hymn):
        antes = _version(hymn.hymn_book)

        _audio(hymn)

        assert _version(hymn.hymn_book) == antes + 1

    def test_editar_audio_incrementa_sync_version(self, hymn):
        audio = _audio(hymn)
        antes = _version(hymn.hymn_book)

        audio.is_approved = True
        audio.save()

        assert _version(hymn.hymn_book) == antes + 1

    def test_deletar_audio_incrementa_sync_version(self, hymn):
        audio = _audio(hymn)
        antes = _version(hymn.hymn_book)

        audio.delete()

        assert _version(hymn.hymn_book) == antes + 1

    def test_deletar_hino_com_audios_nao_estoura(self, hymn):
        """Cascade Hymn -> HymnAudio: os dois signals rodam sem erro."""
        _audio(hymn)
        antes = _version(hymn.hymn_book)

        hymn.delete()

        assert _version(hymn.hymn_book) > antes
        assert HymnAudio.objects.count() == 0


@pytest.mark.django_db
class TestSyncVersionHymnBook:
    def test_salvar_hinario_nao_mexe_no_contador_nem_recursa(self, hymn_book):
        antes = _version(hymn_book)

        hymn_book.description = "Hinário do Mestre"
        hymn_book.save()

        assert _version(hymn_book) == antes

    def test_salvar_hinario_com_hinos_nao_recursa(self, hymn_book, hymns_multiple):
        antes = _version(hymn_book)

        hymn_book.owner_name = "Mestre Irineu Serra"
        hymn_book.save()

        assert _version(hymn_book) == antes

    def test_save_de_instancia_stale_nao_anda_pra_tras(self, hymn_book, hymn_factory):
        """
        Regressão: a instância em memória guarda `sync_version` antigo; um
        `save()` completo (o que as views editoriais fazem) não pode reescrever
        o contador com o valor velho, senão o cliente offline nunca invalida
        o cache.
        """
        hymn_factory(hymn_book=hymn_book, number=1)
        assert hymn_book.sync_version == 0  # stale
        depois_do_bump = _version(hymn_book)

        hymn_book.description = "Editado pela view"
        hymn_book.save()

        assert _version(hymn_book) == depois_do_bump


@pytest.mark.django_db
class TestSyncVersionRaw:
    def test_loaddata_nao_incrementa(self, hymn_book):
        """`raw=True` (fixtures) não deve mexer no contador."""
        from django.db.models.signals import post_save

        hymn = Hymn(hymn_book=hymn_book, number=1, title="Lua Branca", text="Lua branca...")
        hymn.save()
        antes = _version(hymn_book)

        post_save.send(sender=Hymn, instance=hymn, created=False, raw=True)

        assert _version(hymn_book) == antes
