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


def optional_request_from_info(info: Info):
    """Igual a `request_from_info`, mas devolve `None` em vez de estourar.

    Existe para o punhado de resolvers que precisam do request como MELHORIA e
    não como requisito — hoje `HymnAudioType.url`, que usa o host pra completar
    uma URL relativa de mídia e tem fallback quando não há host. Fora do ciclo
    de request/response (execução direta de `schema.execute_sync` sem
    `context_value`) o contexto pode ser `None`, dict vazio ou objeto sem
    `.request`; as três formas caem no mesmo `None`.

    Quem exige sessão continua usando `request_from_info`/`user_from_info`: ali,
    contexto ausente é bug de integração e estourar é o certo.
    """
    context = getattr(info, "context", None)
    if context is None:
        return None
    if isinstance(context, dict):
        return context.get("request")
    return getattr(context, "request", None)


def user_from_info(info: Info):
    """`request.user` — `AnonymousUser` quando não há sessão."""
    return request_from_info(info).user
