"""
Django signals para manter TypeSense sincronizado com o banco.

Fecha dois gaps:
- Edições (admin, command, web) não re-indexam → busca stale
- Deleções deixam registros órfãos no TypeSense
"""

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.search.typesense_client import delete_hymn, index_hymn

from .models import Hymn, HymnBook


@receiver(post_save, sender=Hymn)
def index_hymn_on_save(sender, instance, **kwargs):
    try:
        index_hymn(instance)
    except Exception:
        pass


@receiver(post_delete, sender=Hymn)
def delete_hymn_on_delete(sender, instance, **kwargs):
    try:
        delete_hymn(str(instance.id))
    except Exception:
        pass


@receiver(post_save, sender=HymnBook)
def reindex_hymns_on_hymnbook_update(sender, instance, created, **kwargs):
    """
    Campos denormalizados na collection "hymns" (hymn_book_name, owner_name,
    hymn_book_slug) precisam ser atualizados nos filhos quando o pai muda.
    Em create, ainda não há hinos, então pula.
    """
    if created:
        return
    for hymn in instance.hymns.all():
        try:
            index_hymn(hymn)
        except Exception:
            pass
