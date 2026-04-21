"""
Django signals que mantêm Hymn.search_vector atualizado.

Substituem os signals antigos que sincronizavam com TypeSense. Agora a busca
vive 100% no PostgreSQL usando FTS nativo — sem dual-writes nem risco de drift.
"""

from django.db import connection
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Hymn, HymnBook

# Recomputa search_vector via UPDATE ... FROM. Usamos SQL direto porque
# Django's ORM .update() não permite joined field references, e o vector
# denormaliza campos do HymnBook (name, owner_name).
_UPDATE_HYMN_VECTOR_SQL = """
    UPDATE hymns_hymn h
    SET search_vector =
        setweight(to_tsvector('portuguese', coalesce(h.title, '')), 'A') ||
        setweight(to_tsvector('portuguese', coalesce(h.text, '')), 'B') ||
        setweight(to_tsvector('portuguese', coalesce(hb.name, '')), 'C') ||
        setweight(to_tsvector('portuguese', coalesce(hb.owner_name, '')), 'D')
    FROM hymns_hymnbook hb
    WHERE h.hymn_book_id = hb.id
"""


def _update_vector_for_hymn(pk):
    with connection.cursor() as cursor:
        cursor.execute(_UPDATE_HYMN_VECTOR_SQL + " AND h.id = %s", [str(pk)])


def _update_vectors_for_hymnbook(hymnbook_pk):
    with connection.cursor() as cursor:
        cursor.execute(_UPDATE_HYMN_VECTOR_SQL + " AND h.hymn_book_id = %s", [str(hymnbook_pk)])


@receiver(post_save, sender=Hymn)
def update_hymn_search_vector(sender, instance, **kwargs):
    _update_vector_for_hymn(instance.pk)


@receiver(post_save, sender=HymnBook)
def repopulate_children_vectors(sender, instance, created, **kwargs):
    """
    Quando metadados denormalizados (name, owner_name) do HymnBook mudam,
    re-computa os vectors de todos os hinos filhos.
    """
    if created:
        return
    _update_vectors_for_hymnbook(instance.pk)
