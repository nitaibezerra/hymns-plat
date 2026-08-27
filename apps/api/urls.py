"""
Roteamento do endpoint GraphQL.

CSRF não é decidido aqui e nem pelo middleware: `csrf_exempt` tira o endpoint
do `CsrfViewMiddleware` global e `GraphQLCsrfView` (apps/api/csrf.py) reintroduz
a exigência DENTRO do pipeline, só quando a operação muda estado — query passa
sem token (é o que o SSR do SvelteKit faz), mutation continua exigindo
`X-CSRFToken`. O GET segue semeando o cookie `csrftoken`.
"""

from __future__ import annotations

from django.urls import path
from django.views.decorators.csrf import csrf_exempt

from .csrf import GraphQLCsrfView
from .schema import schema

graphql_view = csrf_exempt(
    GraphQLCsrfView.as_view(schema=schema, graphql_ide="graphiql", multipart_uploads_enabled=True)
)

urlpatterns = [
    path("graphql/", graphql_view, name="graphql"),
]
