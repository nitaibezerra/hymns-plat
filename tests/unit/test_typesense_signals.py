"""
Testes dos Django signals que sincronizam Hymn/HymnBook com TypeSense.
"""

from unittest.mock import patch

import pytest


@pytest.mark.django_db
class TestHymnSignals:
    """Testes dos signals de post_save e post_delete em Hymn."""

    def test_hymn_post_save_calls_index_hymn_on_create(self, hymn_book, hymn_factory):
        """Criar um Hymn deve disparar index_hymn via signal."""
        with patch("apps.hymns.signals.index_hymn") as mock_index:
            hymn = hymn_factory(hymn_book=hymn_book, number=42, title="Signal Test")

            mock_index.assert_called_once()
            called_hymn = mock_index.call_args[0][0]
            assert called_hymn.id == hymn.id

    def test_hymn_post_save_calls_index_hymn_on_update(self, hymn):
        """Atualizar um Hymn deve re-disparar index_hymn."""
        with patch("apps.hymns.signals.index_hymn") as mock_index:
            hymn.title = "Título Alterado"
            hymn.save()

            mock_index.assert_called_once()

    def test_hymn_post_delete_calls_delete_hymn(self, hymn):
        """Deletar um Hymn deve disparar delete_hymn via signal."""
        hymn_id = str(hymn.id)
        with patch("apps.hymns.signals.delete_hymn") as mock_delete:
            hymn.delete()

            mock_delete.assert_called_once_with(hymn_id)

    def test_signal_swallows_index_exception(self, hymn_book, hymn_factory):
        """Se index_hymn levantar exceção, o save do Hymn não deve quebrar."""
        with patch("apps.hymns.signals.index_hymn", side_effect=Exception("TypeSense down")):
            # Should not raise
            hymn = hymn_factory(hymn_book=hymn_book, number=99, title="Resilient")
            assert hymn.pk is not None

    def test_signal_swallows_delete_exception(self, hymn):
        """Se delete_hymn levantar exceção, o delete do Hymn não deve quebrar."""
        with patch("apps.hymns.signals.delete_hymn", side_effect=Exception("TypeSense down")):
            # Should not raise
            hymn.delete()


@pytest.mark.django_db
class TestHymnBookSignals:
    """Testes de signals em HymnBook (re-indexar filhos quando metadados mudam)."""

    def test_hymnbook_create_does_not_reindex_children(self, hymn_book_factory):
        """Criar um HymnBook (sem hinos) não deve disparar index_hymn."""
        with patch("apps.hymns.signals.index_hymn") as mock_index:
            hymn_book_factory(name="Hinário Sem Hinos")

            mock_index.assert_not_called()

    def test_hymnbook_update_reindexes_children(self, hymn_book, hymns_multiple):
        """Editar metadados do HymnBook re-indexa todos os hinos filhos."""
        with patch("apps.hymns.signals.index_hymn") as mock_index:
            hymn_book.name = "Novo Nome"
            hymn_book.save()

            # hymns_multiple cria 5 hinos
            assert mock_index.call_count == 5

    def test_hymnbook_update_without_children_does_not_crash(self, hymn_book):
        """Editar HymnBook sem hinos não deve quebrar mesmo com signal ativo."""
        with patch("apps.hymns.signals.index_hymn") as mock_index:
            hymn_book.description = "nova descrição"
            hymn_book.save()

            mock_index.assert_not_called()
