"""
Django signals do app hymns.

1. Mantêm `Hymn.search_vector` atualizado via PostgreSQL FTS (sem TypeSense).
2. Marco 1.3 — gravam `HymnRevision` em cada UPDATE editorial de `Hymn`,
   capturando o diff dos campos alterados para a trilha de auditoria.
3. Marco 6 (pré-requisito) — incrementam `HymnBook.sync_version` a cada
   mudança em `Hymn`/`HymnAudio`, para o cliente offline saber que o hinário
   que tem em cache ficou obsoleto.
"""

from django.db import connection
from django.db.models import F
from django.db.models.signals import post_delete, post_save, pre_save
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
    # Bulk imports (ex.: import_yaml com 100+ áudios) marcam essa flag pra
    # evitar spawn de N threads simultâneas que esgotariam o pool de conexões
    # do postgres. Backfill fica para o comando `backfill_audio_waveforms`.
    if getattr(instance, "_skip_waveform_signal", False):
        return
    if instance.waveform_peaks:
        return
    if not instance.audio_file:
        return
    audio_service._run_in_thread(audio_service.populate_waveform_for_audio, instance.pk)


# --------------------------------------------------------------------------- #
# Marco 6 — HymnBook.sync_version
# --------------------------------------------------------------------------- #
#
# O incremento usa `F()` + `.update()` de propósito:
# - `.update()` não dispara `post_save` de `HymnBook`, então não há cascata de
#   signals (nem re-cômputo desnecessário dos search vectors dos filhos);
# - `F()` resolve o incremento no banco, então duas transações concorrentes não
#   se sobrescrevem (o que aconteceria com `instance.sync_version += 1; save()`).


def _bump_sync_version(hymn_book_id):
    """Incrementa o contador de sincronização de um hinário, se ele existir."""
    if not hymn_book_id:
        return
    HymnBook.objects.filter(pk=hymn_book_id).update(sync_version=F("sync_version") + 1)


def _hymn_book_id_for_audio(instance):
    """
    Descobre o hinário de um áudio sem materializar o `Hymn` inteiro.

    Durante o cascade de `Hymn.delete()` os áudios são removidos antes do hino,
    mas o hino já pode ter desaparecido em outros caminhos (ex.: cascade a
    partir do próprio hinário). Nesse caso devolve `None` e o bump é ignorado.
    """
    if not instance.hymn_id:
        return None
    return Hymn.objects.filter(pk=instance.hymn_id).values_list("hymn_book_id", flat=True).first()


@receiver(pre_save, sender=HymnBook)
def _preserve_sync_version_on_hymnbook_save(sender, instance, raw=False, **kwargs):
    """
    Protege o contador de saves que carregam uma instância stale.

    Um `HymnBook` lido antes de um bump guarda o valor antigo em memória; um
    `save()` completo (o que as views/forms editoriais fazem) reescreveria
    esse valor e faria o contador ANDAR PRA TRÁS — o cliente offline nunca
    perceberia que o cache dele expirou. Aqui o valor é relido do banco
    imediatamente antes do UPDATE.
    """
    if raw or not instance.pk:
        return
    atual = HymnBook.objects.filter(pk=instance.pk).values_list("sync_version", flat=True).first()
    if atual is not None:
        instance.sync_version = atual


@receiver(post_save, sender=Hymn)
def _bump_sync_version_on_hymn_save(sender, instance, raw=False, **kwargs):
    if raw:
        return
    _bump_sync_version(instance.hymn_book_id)


@receiver(post_delete, sender=Hymn)
def _bump_sync_version_on_hymn_delete(sender, instance, **kwargs):
    _bump_sync_version(instance.hymn_book_id)


@receiver(post_save, sender=HymnAudio)
def _bump_sync_version_on_audio_save(sender, instance, raw=False, **kwargs):
    if raw:
        return
    _bump_sync_version(_hymn_book_id_for_audio(instance))


@receiver(post_delete, sender=HymnAudio)
def _bump_sync_version_on_audio_delete(sender, instance, **kwargs):
    _bump_sync_version(_hymn_book_id_for_audio(instance))
