"""
Testes de infraestrutura PostgreSQL para busca: extensions, search_vector field,
índice GIN.
"""

import pytest
from django.db import connection


@pytest.mark.django_db
class TestPostgresExtensions:
    def test_pg_trgm_extension_enabled(self):
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_extension WHERE extname='pg_trgm'")
            assert cursor.fetchone() is not None

    def test_unaccent_extension_enabled(self):
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_extension WHERE extname='unaccent'")
            assert cursor.fetchone() is not None


@pytest.mark.django_db
class TestHymnSearchVectorField:
    def test_hymn_has_search_vector_field(self):
        from apps.hymns.models import Hymn

        field_names = [f.name for f in Hymn._meta.get_fields()]
        assert "search_vector" in field_names

    def test_search_vector_field_is_nullable(self):
        from apps.hymns.models import Hymn

        field = Hymn._meta.get_field("search_vector")
        assert field.null is True

    def test_gin_index_exists_on_search_vector(self):
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT indexname FROM pg_indexes
                WHERE tablename = 'hymns_hymn'
                  AND indexdef ILIKE '%gin%'
                  AND indexdef ILIKE '%search_vector%'
                """
            )
            assert cursor.fetchone() is not None
