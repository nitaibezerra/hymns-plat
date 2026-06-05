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

from apps.hymns import models as hymn_models
from apps.users import models as user_models


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


@strawberry_django.type(hymn_models.HymnAudio)
class HymnAudioType:
    id: strawberry.auto


@strawberry_django.type(user_models.User)
class UserType:
    id: strawberry.auto
    username: strawberry.auto
    email: strawberry.auto
