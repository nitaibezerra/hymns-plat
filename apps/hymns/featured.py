"""
Seleção rotativa por hora cheia para a seção "Em destaque" da home.

FONTE ÚNICA da regra: `apps/hymns/views.py::_hourly_featured` delega para cá
e o resolver GraphQL `Query.hourlyFeatured` chama direto. Antes havia duas
implementações e a daqui era a degradada — não embaralhava `is_featured=True`
primeiro, então a curadoria editorial (admin, painel editorial e a mutation
`updateHymnBookEditorial`) não tinha efeito nenhum na home servida pela API.

A regra, em ordem:
1. Embaralha os `is_featured=True` de `visible_qs` e toma até `n`.
2. Se sobrou espaço, completa com os demais, também embaralhados.
3. Devolve os objetos na ordem sorteada.

A seed é o timestamp da hora cheia, então a mesma seleção volta dentro da mesma
hora e troca quando a hora vira.
"""

from __future__ import annotations

import random

from django.utils import timezone


def hourly_featured(visible_qs, n: int = 6, now=None, annotate=None) -> list:
    """Retorna até `n` HymnBooks de `visible_qs` em ordem determinística por hora.

    `now` permite ao chamador fixar a hora que gera a seed (a home resolve
    `timezone.now()` no próprio módulo pra manter os testes que mockam de lá
    no controle). `annotate` é um callable opcional aplicado ao queryset final
    — a home injeta `_annotate_card_counts` pra alimentar os cards sem que a
    regra de seleção precise conhecer as anotações.
    """
    now = now or timezone.now()
    seed = int(now.replace(minute=0, second=0, microsecond=0).timestamp())
    rng = random.Random(seed)

    featured_ids = [str(pk) for pk in visible_qs.filter(is_featured=True).values_list("id", flat=True)]
    rng.shuffle(featured_ids)
    selected = featured_ids[:n]

    if len(selected) < n:
        rest_ids = [str(pk) for pk in visible_qs.exclude(id__in=selected).values_list("id", flat=True)]
        rng.shuffle(rest_ids)
        selected.extend(rest_ids[: n - len(selected)])

    if not selected:
        return []

    order = {pk: i for i, pk in enumerate(selected)}
    qs = visible_qs.filter(id__in=selected)
    if annotate is not None:
        qs = annotate(qs)
    books = list(qs)
    books.sort(key=lambda b: order[str(b.id)])
    return books
