"""
Gate de CSRF do endpoint GraphQL: query livre, mutation protegida.

Contexto (Marco 4 — Frente 1). O endpoint inteiro estava embrulhado em
`ensure_csrf_cookie` com o `CsrfViewMiddleware` ativo, então TODO `POST
/graphql/` exigia cookie `csrftoken` + header `X-CSRFToken`. O SSR do
SvelteKit roda em Node, sem cookie jar: toda rota renderizava
`Falha ao carregar: HTTP 403`. A decisão fixada em
`_plan/plano-headless-graphql.md` é "CSRF token via header X-CSRFToken **em
mutations**" — leitura pública não tem efeito colateral a proteger.

GraphQL fala por um único endpoint POST, então o gate não pode ser por método
HTTP: ele olha o **tipo da operação que vai executar**. Daí o desenho:

1. `csrf_exempt` na view (feito em `urls.py`) tira o endpoint do middleware.
2. O corpo é parseado UMA vez (`parse_http_body` memoizado) e reaproveitado
   tanto pelo gate quanto pela execução.
3. Se a operação selecionada muda estado, quem decide é o **verificador
   oficial do Django** (`CsrfViewMiddleware.process_view`) — nada de comparar
   token à mão aqui.
4. GET/HEAD seguem com `ensure_csrf_cookie`, que é o que semeia o cookie lido
   pelo GraphiQL e pelo primeiro load do cliente.
"""

from __future__ import annotations

from django.http import HttpRequest, HttpResponse
from django.middleware.csrf import CsrfViewMiddleware
from django.views.decorators.csrf import ensure_csrf_cookie
from graphql import OperationType, get_operation_ast, parse
from strawberry.django.views import GraphQLView

# Métodos que, por RFC 9110, não mudam estado — os mesmos que o
# `CsrfViewMiddleware` deixa passar sem token.
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS", "TRACE"})

_UNPARSED = object()


def _csrf_protected_callback(request: HttpRequest) -> None:  # pragma: no cover
    """Callback entregue ao verificador do Django.

    `process_view` nunca chama o callback: ele só checa se tem o atributo
    `csrf_exempt`. Esta função existe justamente para NÃO ter — se
    passássemos a própria view (que é `csrf_exempt`), o verificador liberaria
    tudo.
    """
    return None


def _is_state_changing(query: str | None, operation_name: str | None) -> bool:
    """`True` se a operação que o graphql-core vai executar não é uma query.

    Usa `get_operation_ast`, a MESMA função que o graphql-core usa para
    escolher a operação a executar — então respeitar `operationName` sai de
    graça: num documento com `query Stats` + `mutation Sair`, o gate segue o
    nome pedido e não a primeira definição do arquivo.

    Fail-closed de propósito quando não é possível decidir (documento
    ambíguo, `operationName` inexistente): pedir o token é o erro barato.
    Documento vazio ou inválido é fail-open porque nada executa — o pipeline
    do Strawberry devolve 400 logo depois.
    """
    if not query:
        return False
    try:
        document = parse(query)
    except Exception:
        return False
    operation = get_operation_ast(document, operation_name)
    if operation is None:
        return True
    return operation.operation is not OperationType.QUERY


class GraphQLCsrfView(GraphQLView):
    """`GraphQLView` que exige CSRF só quando a operação muda estado."""

    # Sentinela de classe: cada request tem sua própria instância de view
    # (Django cria uma em `as_view`), então atribuir em `self` dá cache por
    # request sem precisar de `__init__`.
    _parsed_body: object = _UNPARSED

    def parse_http_body(self, request_adapter):  # type: ignore[override]
        """Memoiza o parse do corpo da requisição.

        O gate precisa saber o tipo da operação ANTES de executar, e a
        execução precisa do mesmo corpo depois. Sem o cache, um upload
        multipart (`uploadAudio`) seria remontado duas vezes.
        """
        if self._parsed_body is _UNPARSED:
            self._parsed_body = super().parse_http_body(request_adapter)
        return self._parsed_body

    def requires_csrf(self, request: HttpRequest) -> bool:
        """`True` se alguma operação da requisição muda estado."""
        try:
            request_data = self.parse_http_body(self.request_adapter_class(request))
        except Exception:
            # Corpo ilegível: o pipeline do Strawberry vai responder 400 e
            # nada executa, então não há efeito colateral a proteger.
            return False
        batch = request_data if isinstance(request_data, list) else [request_data]
        return any(_is_state_changing(item.query, item.operation_name) for item in batch)

    def csrf_rejection(self, request: HttpRequest) -> HttpResponse | None:
        """Resposta 403 do Django, ou `None` se a requisição pode seguir."""
        if not self.requires_csrf(request):
            return None
        verifier = CsrfViewMiddleware(get_response=lambda _request: None)
        return verifier.process_view(request, _csrf_protected_callback, (), {})

    def dispatch(self, request: HttpRequest, *args, **kwargs):
        if request.method in SAFE_METHODS:
            # Semeia o cookie `csrftoken`: o GraphiQL manda ele em
            # `x-csrftoken` e o cliente web lê ele antes da primeira mutation.
            # `ensure_csrf_cookie` traz o próprio `process_response`, então o
            # cookie sai mesmo com o endpoint fora do middleware de CSRF.
            return ensure_csrf_cookie(super().dispatch)(request, *args, **kwargs)

        rejection = self.csrf_rejection(request)
        if rejection is not None:
            return rejection
        return super().dispatch(request, *args, **kwargs)
