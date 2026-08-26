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
from django.db.models import F
from django.utils import timezone
from strawberry.types import Info

from apps.hymns import models as hymn_models
from apps.hymns.editor_views import (
    _editor_visible_books,
    _has_editor_access,
    _parse_sort,
    _pending_audios_for,
    _sort_expression,
)
from apps.hymns.featured import hourly_featured
from apps.hymns.search import build_book_search_qs, build_hymn_search_qs
from apps.users import models as user_models

from .errors import raise_permission_denied
from .mutations import Mutation
from .types import (
    EditorDashboardStatsType,
    HymnAudioType,
    HymnBookType,
    HymnType,
    NotificationType,
    OCRTaskType,
    PublishReadinessCheckType,
    PublishReadinessType,
    SearchKind,
    SearchResultsType,
    SortInput,
    UserProfileType,
    UserType,
)


def _build_sort_expressions(sort_inputs):
    """Converte lista de `SortInput` em lista de OrderBy aplicáveis ao qs.

    Serializa os pares no mesmo formato da URL do workspean(`metric:dir,...`)
    e delega a `_parse_sort` + `_sort_expression` de `editor_views.py`: assim
    o vocabulário (`review`, `comp`, `audio`, `recent`), a validação de direção,
    a deduplicação (1ª ocorrência vence) e a ordem de prioridade dos cliques
    são exatamente os mesmos do dashboard HTML — uma única fonte da verdade.
    """
    raw = ",".join(f"{s.column}:{s.direction}" for s in (sort_inputs or []))
    return [expr for expr in (_sort_expression(m, d) for m, d in _parse_sort(raw)) if expr is not None]


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
        self, info: Info, sort: list[SortInput] | None = None, priority: str = "all"
    ) -> list[HymnBookType]:
        """Lista de hinários do workspace editorial.

        Paridade de comportamento com `editor_hymnbook_list`: `_editor_visible_books`
        + `with_review_progress()`, multi-sort no vocabulário dos chips
        (`review`/`comp`/`audio`/`recent`) e filtro por prioridade.

        `priority="all"` (default) não filtra e promove `priority` a sort
        PRIMÁRIO — P1 antes de P2 antes de P3 — deixando os sorts do usuário
        como secundários, igual à view. `name` fecha como tie-breaker estável.
        """
        user = _user(info)
        if not _has_editor_access(user):
            raise_permission_denied()
        qs = _editor_visible_books(user).with_review_progress()
        if priority in hymn_models.HymnBook.Priority.values:
            qs = qs.filter(priority=priority)
        order_args: list = []
        if priority == "all":
            order_args.append("priority")  # CharField P1/P2/P3 — asc = P1 primeiro
        order_args.extend(_build_sort_expressions(sort or []))
        order_args.append(F("name").asc())
        return list(qs.order_by(*order_args))

    @strawberry.field(name="editorDashboardStats")
    def editor_dashboard_stats(self, info: Info) -> EditorDashboardStatsType:
        """Stats agregadas do workspace (paridade com `editor_hymnbook_list` stats inline)."""
        from datetime import timedelta

        from apps.hymns.models import HymnRevision

        user = _user(info)
        if not _has_editor_access(user):
            raise_permission_denied()
        visible_qs = _editor_visible_books(user)
        visible_ids = list(visible_qs.values_list("pk", flat=True))

        total = len(visible_ids)
        pending_hymns = (
            hymn_models.Hymn.objects.filter(hymn_book_id__in=visible_ids)
            .exclude(review_status=hymn_models.Hymn.ReviewStatus.REVIEWED)
            .count()
        )
        cutoff = timezone.now() - timedelta(days=7)
        recent = HymnRevision.objects.filter(
            hymn__hymn_book_id__in=visible_ids,
            revised_at__gte=cutoff,
            new_status=hymn_models.Hymn.ReviewStatus.REVIEWED,
        ).count()
        p1 = visible_qs.filter(priority=hymn_models.HymnBook.Priority.P1).count()

        pending_audios = _pending_audios_for(user).count()

        rev = (
            HymnRevision.objects.filter(revised_by=user)
            .exclude(hymn__review_status=hymn_models.Hymn.ReviewStatus.REVIEWED)
            .select_related("hymn")
            .order_by("-revised_at")
            .first()
        )
        resume_hymn = rev.hymn if rev else None

        return EditorDashboardStatsType(
            total_hinarios=total,
            pending_hymns=pending_hymns,
            recent_reviewed7d=recent,
            p1_count=p1,
            pending_audios_count=pending_audios,
            resume_hymn=resume_hymn,
        )

    @strawberry.field(name="pendingAudios")
    def pending_audios(self, info: Info) -> list[HymnAudioType]:
        """Áudios aguardando aprovação que o usuário pode revisar.

        Reusa `_pending_audios_for` de `editor_views` — mesma regra de escopo
        que a tela `/editor/audios-pendentes/`."""
        user = _user(info)
        if not _has_editor_access(user):
            raise_permission_denied()
        return list(_pending_audios_for(user).order_by("-created_at"))

    @strawberry.field(name="publishReadiness")
    def publish_readiness_query(self, info: Info, slug: str) -> Optional[PublishReadinessType]:
        """Snapshot de pré-condições de publicação. Retorna `None` se o
        hinário não existe ou o usuário não tem permissão de publicar."""
        from apps.hymns.permissions import can_publish_hymnbook
        from apps.hymns.services.review import publish_readiness as _readiness

        user = _user(info)
        hb = hymn_models.HymnBook.objects.filter(slug=slug).first()
        if hb is None or not can_publish_hymnbook(user, hb):
            return None
        report = _readiness(hb)
        return PublishReadinessType(
            can_publish=report["can_publish"],
            checks=[PublishReadinessCheckType(key=c["key"], label=c["label"], ok=c["ok"]) for c in report["checks"]],
        )

    @strawberry.field(name="ocrTask")
    def ocr_task(self, info: Info, id: strawberry.ID) -> Optional[OCRTaskType]:
        """OCRTask por id, gateada ao próprio uploader ou editor/admin."""
        user = _user(info)
        if not getattr(user, "is_authenticated", False):
            return None
        task = hymn_models.OCRTask.objects.filter(pk=id).first()
        if task is None:
            return None
        if user.is_superuser or user.has_perm("hymns.can_review_any_hymnbook") or task.user_id == user.pk:
            return task
        return None

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
