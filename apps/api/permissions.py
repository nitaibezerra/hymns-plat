"""
Gate de permissão da camada GraphQL.

O plano do Marco 2 pedia este módulo com o helper `gate(user, check, *args)` e
ele nunca foi criado. Sem ele, cada resolver importava `_is_editor_or_admin` —
helper PRIVADO de `apps.hymns.permissions` — direto de `types.py` e
`mutations.py`, e repetia à mão o par
`if not check(...): return PermissionDeniedError()`.

Este módulo é a fronteira: as checagens de domínio continuam morando em
`apps.hymns.permissions` (fonte única da regra); aqui só damos a elas nomes
públicos e a tradução para o formato de erro do GraphQL.

Duas traduções, porque o schema oferece duas posições para o erro:
- `gate` devolve o `PermissionDeniedError` para as mutations, que o declaram na
  union de resultado.
- `require` levanta `GraphQLError` para as queries, cujo tipo de retorno é
  lista ou objeto não-nulável e não tem posição para union.
"""

from __future__ import annotations

from apps.hymns.permissions import _is_authenticated, _is_editor_or_admin

from .errors import PermissionDeniedError, raise_permission_denied


def is_authenticated(user) -> bool:
    """True se há usuário logado."""
    return _is_authenticated(user)


def is_staff(user) -> bool:
    """True se o usuário é da equipe (`is_staff`) — curadoria editorial.

    Mais restrito que `is_editor_or_admin`: editor comum edita o conteúdo de um
    hinário, mas curadoria global (prioridade da fila, destaque na home) é
    decisão da equipe.
    """
    return _is_authenticated(user) and bool(user.is_staff)


def is_editor_or_admin(user) -> bool:
    """True se o usuário tem papel editorial (grupo `editor` ou superuser)."""
    return _is_editor_or_admin(user)


def gate(user, check, *args, message: str | None = None) -> PermissionDeniedError | None:
    """Aplica `check(user, *args)`; devolve `None` se passa e
    `PermissionDeniedError` se não.

    Uso em mutation:

        if denied := gate(user, can_edit_hymnbook, hymnbook):
            return denied
    """
    if check(user, *args):
        return None
    return PermissionDeniedError(message=message) if message else PermissionDeniedError()


def require(user, check, *args, message: str | None = None) -> None:
    """Versão para queries: levanta `GraphQLError` em vez de devolver o erro."""
    if not check(user, *args):
        raise_permission_denied(message)
