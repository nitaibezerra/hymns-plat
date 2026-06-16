"""
Roteamento do endpoint GraphQL.

- POST /graphql/ é protegido por CSRF (middleware padrão do Django).
- GET /graphql/ aplica `ensure_csrf_cookie` para que o cliente SPA possa
  inicializar a sessão e ler o cookie `csrftoken` antes da primeira mutation.
"""

from __future__ import annotations

from django.urls import path
from django.views.decorators.csrf import ensure_csrf_cookie
from strawberry.django.views import GraphQLView

from .schema import schema

graphql_view = ensure_csrf_cookie(GraphQLView.as_view(schema=schema, graphql_ide="graphiql"))

urlpatterns = [
    path("graphql/", graphql_view, name="graphql"),
]
