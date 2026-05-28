"""Context processors do app hymns.

`editor_workspace` injeta dois sinais no header global:
- `editor_can_review`  — usuário tem acesso ao workspace editorial.
- `editor_pending_count` — quantos hinários visíveis a esse usuário ainda
  têm pelo menos um hino não revisado. Alimenta o badge da CTA pill
  "Fila de revisão" no header (handoff Fase 2.x §2).

Só executa para usuários autenticados com permissão de revisor. Para anon
ou usuários sem permissão devolve dict vazio — a CTA nem renderiza.
"""

from __future__ import annotations


def editor_workspace(request):
    user = getattr(request, "user", None)
    if not user or not user.is_authenticated:
        return {}

    has_access = user.is_superuser or user.has_perm("hymns.can_review_any_hymnbook")
    if not has_access:
        return {}

    # Import local para evitar custo em settings/migrations e ciclo com models.
    from .editor_views import _editor_visible_books
    from .models import Hymn

    visible_ids = list(_editor_visible_books(user).values_list("pk", flat=True))
    if not visible_ids:
        return {"editor_can_review": True, "editor_pending_count": 0}

    pending_book_ids = (
        Hymn.objects.filter(hymn_book_id__in=visible_ids)
        .exclude(review_status=Hymn.ReviewStatus.REVIEWED)
        .values_list("hymn_book_id", flat=True)
        .distinct()
    )
    return {
        "editor_can_review": True,
        "editor_pending_count": pending_book_ids.count(),
    }
