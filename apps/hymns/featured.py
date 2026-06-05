"""
Seleção rotativa por hora cheia para a seção "Em destaque" da home.

Espelha `apps/hymns/views.py::_hourly_featured` do repositório principal:
embaralha os hinários `visible_to(user)` com seed na timestamp da hora
cheia atual e devolve até `n` deles. Mesma seleção volta dentro da mesma
hora; troca quando a hora vira.

Mantido em módulo separado para reuso por (1) o resolver GraphQL
`Query.hourlyFeatured` e (2) futuras chamadas do SSR após migrar a home.
"""

from __future__ import annotations

import random

from django.utils import timezone


def hourly_featured(visible_qs, n: int = 6) -> list:
    """Retorna até `n` HymnBooks de `visible_qs` em ordem determinística por hora."""
    now = timezone.now()
    seed = int(now.replace(minute=0, second=0, microsecond=0).timestamp())
    rng = random.Random(seed)

    ids = [str(pk) for pk in visible_qs.values_list("id", flat=True)]
    if not ids:
        return []
    rng.shuffle(ids)
    selected = ids[:n]

    order = {pk: i for i, pk in enumerate(selected)}
    books = list(visible_qs.filter(id__in=selected))
    books.sort(key=lambda b: order[str(b.id)])
    return books
