"""
Marco 2.0.3 — endpoints JSON da Fase 2 ligados ao app hymns.

Padrão: cada endpoint retorna JSON com forma estável documentada via testes em
`tests/unit/test_api_endpoints.py`. Endpoints que mexem com revisão exigem
@login_required; stats globais são públicos.
"""

from __future__ import annotations

from datetime import timedelta

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone

from .models import Hymn, HymnAudio, HymnBook, HymnRevision
from .permissions import can_edit_hymnbook


def api_global_stats(request):
    """Stats da home: hinários publicados, hinos visíveis, áudios, revisores ativos."""
    hymnbooks = HymnBook.objects.published().count()
    hymns = Hymn.objects.filter(hymn_book__is_published=True).count()
    audios = HymnAudio.objects.filter(is_approved=True).count()
    cutoff = timezone.now() - timedelta(days=30)
    active_reviewers = (
        HymnRevision.objects.filter(revised_at__gte=cutoff, revised_by__isnull=False)
        .values("revised_by")
        .distinct()
        .count()
    )
    return JsonResponse(
        {
            "hymnbooks": hymnbooks,
            "hymns": hymns,
            "audios": audios,
            "active_reviewers": active_reviewers,
        }
    )


@login_required
def api_editor_resume(request):
    """
    Retorna o último hino que `request.user` revisou que ainda não está
    REVIEWED — alimenta o sticky "Continuar revisão" do workspace.
    """
    pending = (
        HymnRevision.objects.filter(revised_by=request.user)
        .exclude(hymn__review_status=Hymn.ReviewStatus.REVIEWED)
        .select_related("hymn", "hymn__hymn_book")
        .order_by("-revised_at")
        .first()
    )
    if pending is None:
        return JsonResponse({"hymn": None})
    h = pending.hymn
    return JsonResponse(
        {
            "hymn": {
                "pk": str(h.pk),
                "number": h.number,
                "title": h.title,
                "hymnbook_slug": h.hymn_book.slug,
                "hymnbook_name": h.hymn_book.name,
            }
        }
    )


@login_required
def api_hymn_history(request, pk):
    """Timeline para o drawer de histórico (Marco 2.1.8)."""
    hymn = get_object_or_404(Hymn.objects.select_related("hymn_book"), pk=pk)
    if not can_edit_hymnbook(request.user, hymn.hymn_book):
        return JsonResponse({"detail": "forbidden"}, status=403)
    revisions = list(
        hymn.revisions.select_related("revised_by")
        .order_by("-revised_at")
        .values(
            "id",
            "revised_at",
            "previous_status",
            "new_status",
            "change_summary",
            "field_diff",
            "revised_by__username",
        )
    )
    payload = [
        {
            "id": str(r["id"]),
            "revised_at": r["revised_at"].isoformat(),
            "previous_status": r["previous_status"],
            "new_status": r["new_status"],
            "change_summary": r["change_summary"],
            "field_diff": r["field_diff"],
            "revised_by": r["revised_by__username"],
        }
        for r in revisions
    ]
    return JsonResponse({"revisions": payload})


@login_required
def api_hymn_diff(request, pk):
    """Dados para o painel "Fonte original / Diff" no revisor."""
    hymn = get_object_or_404(Hymn.objects.select_related("hymn_book"), pk=pk)
    if not can_edit_hymnbook(request.user, hymn.hymn_book):
        return JsonResponse({"detail": "forbidden"}, status=403)
    return JsonResponse(
        {
            "ocr_text": hymn.ocr_text,
            "current_text": hymn.text,
            "avg_confidence": hymn.ocr_avg_confidence,
            "source": hymn.source,
        }
    )


def api_hymnbook_queue(request, slug):
    """Fila do player Spotify-style. Retorna TODOS os hinos do livro com flag
    `hasAudio` (JS filtra para construir queue de reprodução; UI do índice
    usa a lista completa para renderizar ▶/⊘ por linha).

    Sem `HymnAudio.is_primary`: a primeira gravação aprovada por `created_at`
    ASC é a que toca."""
    hb = get_object_or_404(HymnBook.objects.visible_to(request.user), slug=slug)
    hymns_qs = hb.hymns.prefetch_related("audios").order_by("number")
    hymns_payload = []
    for h in hymns_qs:
        approved = sorted(
            (a for a in h.audios.all() if a.is_approved),
            key=lambda a: a.created_at,
        )
        first = approved[0] if approved else None
        hymns_payload.append(
            {
                "n": h.number,
                "title": h.title,
                "style": h.style or "",
                "hasAudio": bool(first),
                "audioUrl": first.audio_file.url if first else None,
                "duration": first.duration if first else None,
            }
        )
    return JsonResponse(
        {
            "book": {
                "slug": hb.slug,
                "name": hb.name,
                "owner": hb.owner_name,
            },
            "hymns": hymns_payload,
        }
    )
