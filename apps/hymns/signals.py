"""
Django signals do app hymns.

1. Mantêm `Hymn.search_vector` atualizado via PostgreSQL FTS (sem TypeSense).
2. Marco 1.3 — gravam `HymnRevision` em cada UPDATE editorial de `Hymn`,
   capturando o diff dos campos alterados para a trilha de auditoria.
"""

from django.db import connection
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import Hymn, HymnAudio, HymnBook, HymnRevision
from .services import audio as audio_service

# Campos cuja mudança é considerada "edição editorial" e dispara HymnRevision.
_EDITORIAL_FIELDS = (
    "title",
    "text",
    "repetitions",
    "extra_instructions",
    "style",
    "received_at",
    "offered_to",
    "review_status",
    "number",
)

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


def _serialize_for_diff(value):
    """JSON-friendly representation usada no `field_diff`."""
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


@receiver(pre_save, sender=Hymn)
def _capture_hymn_pre_state(sender, instance, raw=False, **kwargs):
    """
    Antes de salvar um Hymn já existente, lê o estado atual do banco e anexa
    em `instance._pre_save_state` para o post_save consultar e gerar a diff.
    """
    if raw or not instance.pk:
        instance._pre_save_state = None
        return
    try:
        previous = Hymn.objects.get(pk=instance.pk)
    except Hymn.DoesNotExist:
        instance._pre_save_state = None
        return
    instance._pre_save_state = {f: getattr(previous, f) for f in _EDITORIAL_FIELDS}


@receiver(post_save, sender=Hymn)
def _create_hymn_revision_on_edit(sender, instance, created, raw=False, **kwargs):
    """
    Cria HymnRevision em dois cenários:
    1. Criação de Hymn com `source != MANUAL` (OCR/YAML) — registra origem
       como primeiro evento na timeline editorial (Marco 2.0.2).
    2. UPDATE de Hymn já existente em que algum campo editorial mudou.

    Pula loaddata (raw) e INSERTs sem source automático.
    """
    if raw:
        return

    if created:
        if instance.source != Hymn.Source.MANUAL:
            HymnRevision.objects.create(
                hymn=instance,
                revised_by=None,
                previous_status="",
                new_status=instance.review_status,
                change_summary=f"Criado via {instance.get_source_display()}",
                field_diff={},
            )
        return

    previous = getattr(instance, "_pre_save_state", None)
    if not previous:
        return

    diff = {}
    for field in _EDITORIAL_FIELDS:
        old = previous.get(field)
        new = getattr(instance, field)
        if old != new:
            diff[field] = {"old": _serialize_for_diff(old), "new": _serialize_for_diff(new)}

    if not diff:
        return

    HymnRevision.objects.create(
        hymn=instance,
        revised_by=instance.last_reviewed_by,
        previous_status=previous.get("review_status", ""),
        new_status=instance.review_status,
        field_diff=diff,
    )


@receiver(post_save, sender=HymnAudio)
def _generate_waveform_for_audio(sender, instance, created, raw=False, **kwargs):
    """
    Gera waveform_peaks em background quando um áudio é salvo sem peaks.
    Pula loaddata e atualizações de áudios que já têm peaks.
    """
    if raw:
        return
    if instance.waveform_peaks:
        return
    if not instance.audio_file:
        return
    audio_service._run_in_thread(audio_service.populate_waveform_for_audio, instance.pk)
