"""
Schema GraphQL raiz.

Marco 1: queries read-only sobre HymnBook/Hymn + globalStats, reutilizando os
managers do domínio (`HymnBook.objects.visible_to(user)`) — sem duplicação de
regra. Mutations e auth ficam pra Marco 2.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Optional

import strawberry
from django.utils import timezone
from strawberry.types import Info

from django.db.models import F

from apps.hymns import models as hymn_models
from apps.hymns.featured import hourly_featured
from apps.hymns.search import build_book_search_qs, build_hymn_search_qs
from apps.users import models as user_models


def _editor_visible_books(user):
    """Espelha o helper de `editor_views.py`: editor/admin vê tudo,
    dono comum vê só os seus."""
    if not getattr(user, "is_authenticated", False):
        return hymn_models.HymnBook.objects.none()
    if user.is_superuser or user.has_perm("hymns.can_review_any_hymnbook"):
        return hymn_models.HymnBook.objects.all()
    return hymn_models.HymnBook.objects.filter(owner_user=user)


_SORT_COLUMN_TO_FIELD = {
    "review_pct": F("review_pct"),
    "name": F("name"),
    "priority": F("priority"),
    "created_at": F("created_at"),
}


def _build_sort_expressions(sort_inputs):
    """Converte lista de `SortInput` em lista de OrderBy aplicáveis ao qs.

    Colunas/direções inválidas são silenciosamente filtradas — a UI controla
    o vocabulário e deve mandar valores válidos."""
    if not sort_inputs:
        return []
    out = []
    for s in sort_inputs:
        expr = _SORT_COLUMN_TO_FIELD.get(s.column)
        if expr is None:
            continue
        out.append(expr.asc() if s.direction == "asc" else expr.desc())
    return out

from .mutations import Mutation
from .types import (
    HymnAudioType,
    HymnBookType,
    HymnType,
    NotificationType,
    SearchKind,
    SearchResultsType,
    SortInput,
    UserProfileType,
    UserType,
)


def _user(info: Info):
    """Extrai o usuário do request. Strawberry passa context como dict."""
    request = info.context["request"] if isinstance(info.context, dict) else info.context.request
    return request.user


@strawberry.type
class GlobalStats:
    hymnbooks: int
    hymns: int
    audios: int
    active_reviewers: int


@strawberry.type
class Query:
    @strawberry.field
    def hymnbooks(self, info: Info) -> list[HymnBookType]:
        return list(hymn_models.HymnBook.objects.visible_to(_user(info)).order_by("name"))

    @strawberry.field
    def hymnbook(self, info: Info, slug: str) -> Optional[HymnBookType]:
        return hymn_models.HymnBook.objects.visible_to(_user(info)).filter(slug=slug).first()

    @strawberry.field
    def hymn(self, info: Info, pk: strawberry.ID) -> Optional[HymnType]:
        visible_books = hymn_models.HymnBook.objects.visible_to(_user(info))
        return hymn_models.Hymn.objects.filter(pk=pk, hymn_book__in=visible_books).first()

    @strawberry.field
    def current_user(self, info: Info) -> Optional[UserType]:
        user = _user(info)
        return user if getattr(user, "is_authenticated", False) else None

    @strawberry.field
    def user_profile(self, username: str) -> Optional[UserProfileType]:
        """Perfil público do usuário (`None` se username não existir)."""
        user = user_models.User.objects.filter(username=username).first()
        if user is None:
            return None
        return UserProfileType(user=user)

    @strawberry.field
    def notifications(self, info: Info, unread_only: bool = False) -> list[NotificationType]:
        """Feed de notificações do usuário autenticado.

        Anônimo recebe erro de permissão (não há `notifications` global). É
        uma queries com efeito de "self-read", então faz sentido como
        exception (não union) — o cliente nunca vai querer renderizar feed
        sem login.
        """
        user = _user(info)
        if not getattr(user, "is_authenticated", False):
            from graphql import GraphQLError

            raise GraphQLError("Autenticação necessária para listar notificações.")
        qs = user_models.Notification.objects.filter(recipient=user)
        if unread_only:
            qs = qs.filter(is_read=False)
        return list(qs.order_by("-created_at"))

    @strawberry.field
    def hourly_featured(self, info: Info) -> list[HymnBookType]:
        """Hinários "em destaque" da home, com sample determinístico por hora.

        Reusa `apps.hymns.featured.hourly_featured` — mesma seed/ordering
        prevista pelo `_hourly_featured` do monolito (a versão do worktree
        ainda não tem `is_featured`, então o helper devolve um sample puro)."""
        visible_qs = hymn_models.HymnBook.objects.visible_to(_user(info))
        return hourly_featured(visible_qs, n=6)

    @strawberry.field
    def search(self, info: Info, q: str, kind: SearchKind = SearchKind.ALL) -> SearchResultsType:
        """Busca unificada hinos/hinários.

        Reusa `apps.hymns.search.build_*_search_qs` (FTS + trigram no Postgres)
        — mesma lógica de `apps/hymns/views.py::search_view`. `kind` zera o
        bucket que não foi pedido. Visibilidade segue `HymnBook.visible_to`.
        """
        user = _user(info)
        hymns: list = []
        hymnbooks: list = []
        if kind in (SearchKind.ALL, SearchKind.HYMN):
            hymns = list(build_hymn_search_qs(q, user)[:50])
        if kind in (SearchKind.ALL, SearchKind.HYMNBOOK):
            hymnbooks = list(build_book_search_qs(q, user)[:25])
        return SearchResultsType(hymns=hymns, hymnbooks=hymnbooks)

    @strawberry.field(name="editorHymnbooks")
    def editor_hymnbooks(
        self, info: Info, sort: list[SortInput] | None = None, priority: str | None = None
    ) -> list[HymnBookType]:
        """Lista de hinários do workspace editorial.

        Paridade conceitual com `editor_hymnbook_list`: usa `_editor_visible_books`
        + `with_review_progress` pra anotar `review_pct` e permite multi-sort +
        filter por prioridade. `name` como tie-breaker final é sempre aplicado.
        """
        user = _user(info)
        qs = _editor_visible_books(user).with_review_progress()
        if priority and priority in hymn_models.HymnBook.Priority.values:
            qs = qs.filter(priority=priority)
        order_args = _build_sort_expressions(sort or [])
        order_args.append(F("name").asc())
        qs = qs.order_by(*order_args)
        return list(qs)

    @strawberry.field
    def global_stats(self) -> GlobalStats:
        """Mesmo cálculo de apps.hymns.api_views.api_global_stats."""
        cutoff = timezone.now() - timedelta(days=30)
        return GlobalStats(
            hymnbooks=hymn_models.HymnBook.objects.published().count(),
            hymns=hymn_models.Hymn.objects.filter(hymn_book__is_published=True).count(),
            audios=hymn_models.HymnAudio.objects.filter(is_approved=True).count(),
            active_reviewers=(
                hymn_models.HymnRevision.objects.filter(revised_at__gte=cutoff, revised_by__isnull=False)
                .values("revised_by")
                .distinct()
                .count()
            ),
        )


schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
    types=[HymnBookType, HymnType, HymnAudioType, UserType],
)
