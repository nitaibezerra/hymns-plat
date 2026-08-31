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
    # A contagem vive em `editor_views` porque o resolver GraphQL
    # `Query.editorPendingBookCount` lê o MESMO número — o header do monolito e
    # o da SPA precisam mostrar o mesmo badge.
    from .editor_views import editor_pending_book_count

    return {
        "editor_can_review": True,
        "editor_pending_count": editor_pending_book_count(user),
    }
