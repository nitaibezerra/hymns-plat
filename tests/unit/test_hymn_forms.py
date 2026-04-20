"""
Testes dos forms HymnBookForm e HymnForm (CRUD via web).
"""

import pytest

from apps.hymns.forms import HymnBookForm, HymnForm


@pytest.mark.django_db
class TestHymnBookForm:
    def test_valid_minimal_data(self):
        form = HymnBookForm(data={"name": "Novo Hinário", "owner_name": "Fulano"})
        assert form.is_valid(), form.errors

    def test_valid_full_data(self):
        form = HymnBookForm(
            data={
                "name": "Hinário Completo",
                "intro_name": "Completo",
                "owner_name": "Dono",
                "description": "Descrição aqui",
            }
        )
        assert form.is_valid(), form.errors

    def test_rejects_missing_name(self):
        form = HymnBookForm(data={"owner_name": "Dono"})
        assert not form.is_valid()
        assert "name" in form.errors

    def test_rejects_missing_owner_name(self):
        form = HymnBookForm(data={"name": "Só nome"})
        assert not form.is_valid()
        assert "owner_name" in form.errors

    def test_accepts_cover_image(self, sample_image):
        form = HymnBookForm(
            data={"name": "Com Capa", "owner_name": "Dono"},
            files={"cover_image": sample_image},
        )
        assert form.is_valid(), form.errors

    def test_rejects_duplicate_name(self, hymn_book):
        """HymnBook.name é unique."""
        form = HymnBookForm(data={"name": hymn_book.name, "owner_name": "Outro"})
        assert not form.is_valid()
        assert "name" in form.errors

    def test_edit_same_name_on_existing_instance(self, hymn_book):
        """Editar mantendo o mesmo nome não deve falhar por unique."""
        form = HymnBookForm(
            data={"name": hymn_book.name, "owner_name": "Dono Alterado"},
            instance=hymn_book,
        )
        assert form.is_valid(), form.errors


@pytest.mark.django_db
class TestHymnForm:
    def test_valid_minimal_data(self, hymn_book):
        form = HymnForm(
            data={"number": 1, "title": "Hino Teste", "text": "Letra do hino"},
            hymn_book=hymn_book,
        )
        assert form.is_valid(), form.errors

    def test_valid_full_data(self, hymn_book):
        form = HymnForm(
            data={
                "number": 2,
                "title": "Hino Completo",
                "text": "Letra completa",
                "received_at": "1930-07-15",
                "offered_to": "Alguém",
                "style": "Valsa",
                "extra_instructions": "De pé",
                "repetitions": "1-4",
            },
            hymn_book=hymn_book,
        )
        assert form.is_valid(), form.errors

    def test_rejects_missing_required_fields(self, hymn_book):
        form = HymnForm(data={"number": 1}, hymn_book=hymn_book)
        assert not form.is_valid()
        assert "title" in form.errors
        assert "text" in form.errors

    def test_rejects_duplicate_number_in_same_hymnbook(self, hymn_book, hymn_factory):
        hymn_factory(hymn_book=hymn_book, number=5)
        form = HymnForm(
            data={"number": 5, "title": "Duplicado", "text": "x"},
            hymn_book=hymn_book,
        )
        assert not form.is_valid()
        assert "number" in form.errors

    def test_allows_same_number_in_different_hymnbooks(self, hymn_book, hymn_book_factory, hymn_factory):
        hymn_factory(hymn_book=hymn_book, number=7)
        other = hymn_book_factory(name="Outro Hinário", owner_name="Outro")
        form = HymnForm(
            data={"number": 7, "title": "Em outro hinário", "text": "x"},
            hymn_book=other,
        )
        assert form.is_valid(), form.errors

    def test_edit_allows_keeping_own_number(self, hymn):
        """Ao editar, manter o mesmo número não deve falhar."""
        form = HymnForm(
            data={"number": hymn.number, "title": "Título novo", "text": hymn.text},
            instance=hymn,
            hymn_book=hymn.hymn_book,
        )
        assert form.is_valid(), form.errors

    def test_edit_rejects_changing_to_existing_number(self, hymn_book, hymn_factory):
        h1 = hymn_factory(hymn_book=hymn_book, number=1)
        h2 = hymn_factory(hymn_book=hymn_book, number=2)
        form = HymnForm(
            data={"number": h1.number, "title": h2.title, "text": h2.text},
            instance=h2,
            hymn_book=hymn_book,
        )
        assert not form.is_valid()
        assert "number" in form.errors
