"""
Tipos de erro compartilhados pelas mutations.

Em vez de levantar exceções pra todo caso de borda, retornamos union types
(`Result = Success | DomainError`). O cliente GraphQL consegue ler o erro
sem inspecionar `errors[]` do envelope (que é reservado para falhas
técnicas — gateway down, schema inválido, etc.).
"""

from __future__ import annotations

import strawberry


@strawberry.type
class PermissionDeniedError:
    message: str = "Você não tem permissão para realizar essa ação."


@strawberry.type
class NotFoundError:
    message: str = "Recurso não encontrado."


@strawberry.type
class ValidationError:
    message: str
    field: str | None = None
