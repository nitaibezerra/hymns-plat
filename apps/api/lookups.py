"""
Busca de objetos tolerante a `ID` malformado.

`strawberry.ID` chega como string e os PKs do domínio são UUID. Um id que não
é UUID fazia o ORM levantar `django.core.exceptions.ValidationError` de dentro
do resolver, e a mensagem CRUA do validador — com o placeholder `%(value)s`
sem interpolar — escapava para `errors[]` do envelope, que é reservado para
falhas técnicas.

Do ponto de vista do cliente, id malformado e id inexistente são a mesma
coisa: o recurso não está lá. Os dois viram `None` aqui, e os resolvers
traduzem `None` para `NotFoundError` (mutations) ou `null` (queries nullable).
"""

from __future__ import annotations

from django.core.exceptions import ValidationError as DjangoValidationError


def get_or_none(queryset, **lookups):
    """`queryset.filter(**lookups).first()`, devolvendo `None` em id malformado."""
    try:
        return queryset.filter(**lookups).first()
    except (DjangoValidationError, ValueError, TypeError):
        return None
