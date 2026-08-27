"""
Extrator único do request/usuário do contexto Strawberry.

Havia TRÊS cópias disso: `schema.py::_user`, `types.py::_user_from_info` e
`mutations.py::_request`. Todas com o mesmo `isinstance(info.context, dict)`
— a integração Django do Strawberry entrega o contexto como dict em algumas
versões e como objeto com `.request` em outras.
"""

from __future__ import annotations

from strawberry.types import Info


def request_from_info(info: Info):
    """`HttpRequest` do contexto Strawberry, seja dict ou objeto."""
    context = info.context
    return context["request"] if isinstance(context, dict) else context.request


def user_from_info(info: Info):
    """`request.user` — `AnonymousUser` quando não há sessão."""
    return request_from_info(info).user
