"""
Tipos de erro compartilhados pelas mutations.

Em vez de levantar exceções pra todo caso de borda, retornamos union types
(`Result = Success | DomainError`). O cliente GraphQL consegue ler o erro
sem inspecionar `errors[]` do envelope (que é reservado para falhas
técnicas — gateway down, schema inválido, etc.).
"""

from __future__ import annotations

import strawberry
from graphql import GraphQLError

# Mensagem única de permissão negada. Compartilhada entre o union type
# (mutations) e o `GraphQLError` levantado por queries que não têm como
# devolver union (lista / objeto não-nulável).
PERMISSION_DENIED_MESSAGE = "Você não tem permissão para realizar essa ação."


@strawberry.type
class PermissionDeniedError:
    message: str = PERMISSION_DENIED_MESSAGE


@strawberry.type
class NotFoundError:
    message: str = "Recurso não encontrado."


@strawberry.type
class ValidationError:
    message: str
    field: str | None = None


def raise_permission_denied(message: str | None = None) -> None:
    """Levanta `GraphQLError` de permissão negada.

    Usado por queries: `Query.editorHymnbooks` devolve `[HymnBookType!]!` e
    `Query.editorDashboardStats` devolve um objeto não-nulável, então não há
    posição no schema pra um union de erro. A mensagem é a mesma de
    `PermissionDeniedError` — o cliente lê `errors[0].message` e mostra o mesmo
    texto que veria numa mutation.
    """
    raise GraphQLError(message or PERMISSION_DENIED_MESSAGE)
