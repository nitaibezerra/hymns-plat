"""
Mutations GraphQL — Marco 2.

Decisões de design:
- `login` retorna union (`LoginSuccess` | `LoginError`) em vez de levantar erro,
  porque "credenciais inválidas" é resultado normal de tentativa, não exceção.
  Exceções do GraphQL ficam reservadas para erros de programa (gateway down,
  permissão negada, etc.).
- Mutations que mexem em hinos/hinários gateiam por
  `apps.hymns.permissions` (mesma regra usada pelas views) — sem duplicação.
"""

from __future__ import annotations

from typing import Annotated, Union

import strawberry
from django.contrib.auth import authenticate
from django.contrib.auth import login as django_login
from django.contrib.auth import logout as django_logout
from strawberry.types import Info

from apps.hymns import models as hymn_models
from apps.hymns.forms import HymnForm
from apps.hymns.permissions import _is_editor_or_admin

from .errors import NotFoundError, PermissionDeniedError, ValidationError
from .types import HymnType, ReviewStatus, UserType


@strawberry.input
class HymnUpdateInput:
    title: str | None = strawberry.UNSET
    text: str | None = strawberry.UNSET
    number: int | None = strawberry.UNSET
    section: str | None = strawberry.UNSET
    style: str | None = strawberry.UNSET
    repetitions: str | None = strawberry.UNSET
    extra_instructions: str | None = strawberry.UNSET
    offered_to: str | None = strawberry.UNSET


def _request(info: Info):
    """Obtém o `HttpRequest` do contexto Strawberry."""
    return info.context["request"] if isinstance(info.context, dict) else info.context.request


@strawberry.type
class LoginSuccess:
    user: UserType


@strawberry.type
class LoginError:
    message: str


@strawberry.type
class ToggleFavoriteSuccess:
    favorited: bool


LoginResult = Annotated[Union[LoginSuccess, LoginError], strawberry.union("LoginResult")]


@strawberry.type
class Mutation:
    @strawberry.mutation
    def login(self, info: Info, username: str, password: str) -> LoginResult:
        request = _request(info)
        user = authenticate(request, username=username, password=password)
        if user is None:
            return LoginError(message="Credenciais inválidas.")
        django_login(request, user)
        return LoginSuccess(user=user)

    @strawberry.mutation
    def logout(self, info: Info) -> bool:
        django_logout(_request(info))
        return True

    @strawberry.mutation
    def set_review_status(self, info: Info, pk: strawberry.ID, status: ReviewStatus) -> Annotated[
        Union[HymnType, PermissionDeniedError, NotFoundError],
        strawberry.union("SetReviewStatusResult"),
    ]:
        user = _request(info).user
        if not _is_editor_or_admin(user):
            return PermissionDeniedError()

        hymn = hymn_models.Hymn.objects.filter(pk=pk).first()
        if hymn is None:
            return NotFoundError()

        hymn.review_status = status.value if hasattr(status, "value") else status
        hymn.last_reviewed_by = user
        hymn.save()
        return hymn

    @strawberry.mutation
    def update_hymn(self, info: Info, pk: strawberry.ID, input: HymnUpdateInput) -> Annotated[
        Union[HymnType, PermissionDeniedError, NotFoundError, ValidationError],
        strawberry.union("UpdateHymnResult"),
    ]:
        user = _request(info).user
        if not _is_editor_or_admin(user):
            return PermissionDeniedError()

        hymn = hymn_models.Hymn.objects.filter(pk=pk).first()
        if hymn is None:
            return NotFoundError()

        # Coleta só os campos que vieram (UNSET = não tocar)
        data = {}
        for fname in HymnForm.Meta.fields:
            value = getattr(input, fname, strawberry.UNSET)
            if value is strawberry.UNSET:
                data[fname] = getattr(hymn, fname)
            else:
                data[fname] = value

        form = HymnForm(data=data, instance=hymn, hymn_book=hymn.hymn_book)
        if not form.is_valid():
            # Reporta o primeiro erro (cliente pode pedir mais via outra mutation)
            field, errors = next(iter(form.errors.items()))
            return ValidationError(message=errors[0], field=field)

        form.save()
        return hymn

    @strawberry.mutation
    def toggle_favorite(self, info: Info, hymn_pk: strawberry.ID) -> Annotated[
        Union[ToggleFavoriteSuccess, PermissionDeniedError, NotFoundError],
        strawberry.union("ToggleFavoriteResult"),
    ]:
        user = _request(info).user
        if not getattr(user, "is_authenticated", False):
            return PermissionDeniedError(message="É preciso estar autenticado para favoritar hinos.")

        hymn = hymn_models.Hymn.objects.filter(pk=hymn_pk).first()
        if hymn is None:
            return NotFoundError()

        existing = hymn_models.Favorite.objects.filter(user=user, hymn=hymn).first()
        if existing:
            existing.delete()
            return ToggleFavoriteSuccess(favorited=False)
        hymn_models.Favorite.objects.create(user=user, hymn=hymn)
        return ToggleFavoriteSuccess(favorited=True)
