"""
Tipos GraphQL para o domínio hymns.

Marco 1: campos mínimos pra introspection passar.
Marco 4.A: estende `HymnBookType` com `stats` (paridade com `_annotate_card_counts`
em `apps/hymns/views.py`); adiciona campos relacionais a `HymnType`/`HymnAudioType`
e tipos de apoio (`UserProfileType`, `NotificationType`, `HeatmapBucketType`).
"""

from __future__ import annotations

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
