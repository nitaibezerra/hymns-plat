"""
Data migration: popula search_vector para todos os hinos existentes.

Sem isso, hinos criados antes do campo search_vector teriam value NULL e não
apareceriam na busca até serem editados (disparando o signal).
"""

from django.db import migrations

BACKFILL_SQL = """
    UPDATE hymns_hymn h
    SET search_vector =
        setweight(to_tsvector('portuguese', coalesce(h.title, '')), 'A') ||
        setweight(to_tsvector('portuguese', coalesce(h.text, '')), 'B') ||
        setweight(to_tsvector('portuguese', coalesce(hb.name, '')), 'C') ||
        setweight(to_tsvector('portuguese', coalesce(hb.owner_name, '')), 'D')
    FROM hymns_hymnbook hb
    WHERE h.hymn_book_id = hb.id
"""


def backfill(apps, schema_editor):
    schema_editor.execute(BACKFILL_SQL)


def clear(apps, schema_editor):
    Hymn = apps.get_model("hymns", "Hymn")
    Hymn.objects.all().update(search_vector=None)


class Migration(migrations.Migration):

    dependencies = [
        ("hymns", "0004_enable_postgres_search"),
    ]

    operations = [
        migrations.RunPython(backfill, clear),
    ]
