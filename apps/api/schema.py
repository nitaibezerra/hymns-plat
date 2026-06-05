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

from apps.hymns import models as hymn_models
from apps.hymns.featured import hourly_featured
from apps.hymns.search import build_book_search_qs, build_hymn_search_qs
from apps.users import models as user_models

from .mutations import Mutation
from .types import HymnAudioType, HymnBookType, HymnType, SearchKind, SearchResultsType, UserProfileType, UserType


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
