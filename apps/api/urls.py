"""
Roteamento do endpoint GraphQL. Marco 1: GET (GraphiQL em dev) + POST (queries).
"""

from __future__ import annotations

from django.urls import path
from strawberry.django.views import GraphQLView

from .schema import schema

urlpatterns = [
    path("graphql/", GraphQLView.as_view(schema=schema, graphql_ide="graphiql"), name="graphql"),
]
