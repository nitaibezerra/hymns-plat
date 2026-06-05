"""
Tipos GraphQL para o domínio hymns.

Marco 1: campos mínimos pra introspection passar.
Marco 4.A: estende `HymnBookType` com `stats` (paridade com `_annotate_card_counts`
em `apps/hymns/views.py`); adiciona campos relacionais a `HymnType`/`HymnAudioType`
e tipos de apoio (`UserProfileType`, `NotificationType`, `HeatmapBucketType`).
"""

from __future__ import annotations

import enum

import strawberry
import strawberry_django
from django.db.models import Count, Q
from strawberry.types import Info

from apps.hymns import models as hymn_models
from apps.hymns.permissions import _is_editor_or_admin
from apps.users import models as user_models


def _user_from_info(info: Info):
    """Atalho pra extrair `request.user` do contexto Strawberry."""
    request = info.context["request"] if isinstance(info.context, dict) else info.context.request
    return request.user


@strawberry.type
class HymnBookStatsType:
    """Contagens equivalentes às anotações dos cards (`_annotate_card_counts`)."""

    hymns_total: int
    hymns_reviewed: int
    audios_approved: int


@strawberry_django.type(hymn_models.HymnBook)
class HymnBookType:
    id: strawberry.auto
    name: strawberry.auto
    slug: strawberry.auto
    is_published: strawberry.auto

    @strawberry.field
    def stats(self) -> HymnBookStatsType:
        """Total de hinos / hinos revisados / áudios aprovados deste hinário.

        Reusa o mesmo padrão de `_annotate_card_counts`: `Count` em hinos +
        contagem condicional de áudios aprovados em uma única agregação.
        """
        agg = hymn_models.Hymn.objects.filter(hymn_book=self).aggregate(
            total=Count("id", distinct=True),
            reviewed=Count(
                "id",
                filter=Q(review_status=hymn_models.Hymn.ReviewStatus.REVIEWED),
                distinct=True,
            ),
        )
        audios_approved = hymn_models.HymnAudio.objects.filter(hymn__hymn_book=self, is_approved=True).count()
        return HymnBookStatsType(
            hymns_total=agg["total"] or 0,
            hymns_reviewed=agg["reviewed"] or 0,
            audios_approved=audios_approved,
        )

    @strawberry.field
    def hymns(self) -> list["HymnType"]:
        """Coleção de hinos deste hinário ordenada por `number` (mesma ordem
        do sumário/corrido/carrossel no monolito)."""
        return list(hymn_models.Hymn.objects.filter(hymn_book=self).order_by("number"))


ReviewStatus = strawberry.enum(hymn_models.Hymn.ReviewStatus, name="ReviewStatus")


@strawberry_django.type(hymn_models.Hymn)
class HymnType:
    id: strawberry.auto
    number: strawberry.auto
    title: strawberry.auto
    review_status: ReviewStatus

    @strawberry.field
    def previous_in_book(self) -> "HymnType | None":
        """Hino imediatamente anterior (mesmo hinário) por `number`."""
        return (
            hymn_models.Hymn.objects.filter(hymn_book=self.hymn_book, number__lt=self.number)
            .order_by("-number")
            .first()
        )

    @strawberry.field
    def next_in_book(self) -> "HymnType | None":
        """Hino imediatamente posterior (mesmo hinário) por `number`."""
        return (
            hymn_models.Hymn.objects.filter(hymn_book=self.hymn_book, number__gt=self.number).order_by("number").first()
        )

    @strawberry.field
    def siblings_with_same_number(self, info: Info) -> list["HymnType"]:
        """Outros hinos com o mesmo `number` em hinários `visible_to(user)`.

        Espelha a disambiguação que o monolito faz no detalhe do hino (links
        "este número aparece também em…"). Exclui o próprio hino.
        """
        user = _user_from_info(info)
        visible_books = hymn_models.HymnBook.objects.visible_to(user)
        return list(
            hymn_models.Hymn.objects.filter(number=self.number, hymn_book__in=visible_books)
            .exclude(pk=self.pk)
            .select_related("hymn_book")
            .order_by("hymn_book__name")
        )

    @strawberry.field
    def audios(self, info: Info, approved_only: bool = True) -> list["HymnAudioType"]:
        """Áudios deste hino com gating de visibilidade.

        - `approved_only=True` (default) sempre limita a `is_approved=True`,
          mantendo o comportamento do player público.
        - `approved_only=False` libera pendentes para quem pode ver: editor/admin
          vê todos; uploader autenticado vê os próprios (+ aprovados de qualquer
          um); anônimo segue restrito a aprovados.
        """
        user = _user_from_info(info)
        base = hymn_models.HymnAudio.objects.filter(hymn=self)
        if approved_only or not getattr(user, "is_authenticated", False):
            return list(base.filter(is_approved=True).order_by("-created_at"))
        if _is_editor_or_admin(user):
            return list(base.order_by("-created_at"))
        return list(base.filter(Q(is_approved=True) | Q(uploaded_by=user)).order_by("-created_at"))


@strawberry_django.type(hymn_models.HymnAudio)
class HymnAudioType:
    id: strawberry.auto
    waveform_peaks: list[int]

    @strawberry.field
    def url(self) -> str:
        """URL pública do arquivo de áudio (FileField.url do backend ativo)."""
        return self.audio_file.url if self.audio_file else ""

    @strawberry.field
    def duration_seconds(self) -> float | None:
        """Duração em segundos (None se o backfill ainda não preencheu)."""
        return float(self.duration) if self.duration is not None else None

    @strawberry.field
    def uploaded_by(self) -> "UserType | None":
        return self.uploaded_by


@strawberry_django.type(user_models.User)
class UserType:
    id: strawberry.auto
    username: strawberry.auto
    email: strawberry.auto


@strawberry.enum
class SearchKind(enum.Enum):
    """Filtro de tipo para `Query.search`."""

    ALL = "all"
    HYMN = "hymn"
    HYMNBOOK = "hymnbook"


@strawberry.type
class SearchResultsType:
    """Resultados heterogêneos da busca (hinos e/ou hinários)."""

    hymns: list[HymnType]
    hymnbooks: list[HymnBookType]


@strawberry.type
class HeatmapBucketType:
    """Bucket diário do heatmap "Trabalho editorial · último ano".

    Mesma forma do JSON exposto por `apps/users/api_views.py::api_user_heatmap`."""

    date: str
    count: int


@strawberry.type
class NotificationType:
    """Item da feed de notificações do usuário autenticado."""

    id: strawberry.ID
    notification_type: str
    title: str
    message: str
    link: str
    is_read: bool
    created_at: str


@strawberry.type
class UserProfileType:
    """Agregado de perfil público: usuário + contagens + paginações + heatmap.

    Usado pela tela `/u/[username]` do SPA, com paridade conceitual ao
    `user_detail.html` + `api_user_heatmap` do monolito.
    """

    user: UserType

    @strawberry.field
    def followers_count(self) -> int:
        return user_models.UserFollow.objects.filter(followed=self.user).count()

    @strawberry.field
    def following_count(self) -> int:
        return user_models.UserFollow.objects.filter(follower=self.user).count()

    @strawberry.field
    def uploaded_audios(self) -> list[HymnAudioType]:
        return list(hymn_models.HymnAudio.objects.filter(uploaded_by=self.user).order_by("-created_at"))

    @strawberry.field
    def followers(self, first: int = 20, offset: int = 0) -> list[UserType]:
        """Página de seguidores (mais recentes primeiro). `first` é capado em 100."""
        first = max(0, min(first, 100))
        offset = max(0, offset)
        rows = (
            user_models.UserFollow.objects.filter(followed=self.user)
            .select_related("follower")
            .order_by("-created_at")[offset : offset + first]
        )
        return [row.follower for row in rows]

    @strawberry.field
    def following(self, first: int = 20, offset: int = 0) -> list[UserType]:
        """Página de quem o usuário segue (mais recentes primeiro). `first` é capado em 100."""
        first = max(0, min(first, 100))
        offset = max(0, offset)
        rows = (
            user_models.UserFollow.objects.filter(follower=self.user)
            .select_related("followed")
            .order_by("-created_at")[offset : offset + first]
        )
        return [row.followed for row in rows]
