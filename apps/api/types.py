"""
Tipos GraphQL para o domínio hymns.

Marco 1: campos mínimos pra introspection passar. Marcos seguintes expandem
com relacionamentos (HymnBook.hymns, Hymn.audios), filters e ordering.
"""

from __future__ import annotations

import strawberry
import strawberry_django

from apps.hymns import models as hymn_models
from apps.users import models as user_models


@strawberry_django.type(hymn_models.HymnBook)
class HymnBookType:
    id: strawberry.auto
    name: strawberry.auto
    slug: strawberry.auto
    is_published: strawberry.auto


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
