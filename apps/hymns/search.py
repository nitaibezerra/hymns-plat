"""
Querysets de busca compartilhados.

Extrai a lógica de `apps/hymns/views.py::search_view` (full-text + trigram)
para que tanto a view HTML quanto o resolver GraphQL `Query.search`
reusem exatamente as mesmas regras (limiar de similaridade, ordering,
gating por visibilidade). Sem reimplementar nada em Python — a busca
acontece no Postgres via `UnaccentFunc` + `TrigramSimilarity` + FTS.
"""

from __future__ import annotations

from django.contrib.postgres.search import SearchHeadline, SearchQuery, SearchRank, TrigramSimilarity
from django.db.models import F, Func, Q, Value

from .models import Hymn, HymnBook


class UnaccentFunc(Func):
    """Invoca a função SQL `unaccent(text)` da extension unaccent."""

    function = "unaccent"


#: Trecho da letra devolvido pela busca, com o termo envolto em `<mark>`.
#: Os limites vêm de `search_view` e são o contrato visual da tela de busca:
#: mudar aqui muda o tamanho do snippet renderizado.
HEADLINE_MAX_WORDS = 20
HEADLINE_MIN_WORDS = 8

#: Quantos caracteres da descrição do hinário servem de "snippet".
#: Hinário não tem `search_vector` na descrição, então o equivalente ao
#: headline de hino é a descrição truncada — é o que `search_view` faz.
BOOK_HEADLINE_CHARS = 140


def build_hymn_search_qs(query: str, user, *, in_hymnbook_slug: str = ""):
    """Queryset de hinos para o termo `query`, gateado por `visible_to(user)`.

    Mesma combinação de FTS (`search_vector`) + trigram do título usada
    por `search_view`. Devolve um queryset vazio se `query` estiver vazio.

    Annota também `headline`: o trecho da letra com o termo envolto em
    `<mark>`, calculado pelo Postgres (`ts_headline`). Está aqui e não na view
    porque a tela de busca do monolito e a da SPA precisam do MESMO snippet —
    até 2026-08-31 a view tinha sua própria cópia da anotação e o resolver
    GraphQL não tinha nenhuma, e era por isso que o `/busca` da SPA listava só
    títulos enquanto o do Django mostrava o verso onde o termo aparece.
    """
    if not query:
        return Hymn.objects.none()

    visible_books = HymnBook.objects.visible_to(user)
    tsquery = SearchQuery(query, config="portuguese", search_type="websearch")
    qs = (
        Hymn.objects.annotate(
            rank=SearchRank(F("search_vector"), tsquery),
            title_sim=TrigramSimilarity(UnaccentFunc("title"), UnaccentFunc(Value(query))),
            headline=SearchHeadline(
                "text",
                tsquery,
                config="portuguese",
                start_sel="<mark>",
                stop_sel="</mark>",
                max_words=HEADLINE_MAX_WORDS,
                min_words=HEADLINE_MIN_WORDS,
            ),
        )
        .filter(hymn_book__in=visible_books)
        .filter(Q(search_vector=tsquery) | Q(title_sim__gt=0.3))
        .select_related("hymn_book")
        .order_by("-rank", "-title_sim")
    )
    if in_hymnbook_slug:
        qs = qs.filter(hymn_book__slug=in_hymnbook_slug)
    return qs


def build_book_search_qs(query: str, user):
    """Queryset de hinários para o termo `query`, gateado por `visible_to(user)`.

    Trigram em `name` e `owner_name`, mesma `view`.
    """
    if not query:
        return HymnBook.objects.none()

    visible_books = HymnBook.objects.visible_to(user)
    return (
        visible_books.annotate(
            name_sim=TrigramSimilarity(UnaccentFunc("name"), UnaccentFunc(Value(query))),
            owner_sim=TrigramSimilarity(UnaccentFunc("owner_name"), UnaccentFunc(Value(query))),
        )
        .filter(Q(name_sim__gt=0.2) | Q(owner_sim__gt=0.2))
        .order_by("-name_sim", "-owner_sim")
    )


def book_headline(book) -> str:
    """ "Snippet" de um hinário: a descrição truncada.

    Espelha `search_view`. Função em vez de anotação porque não há nada pra o
    Postgres destacar — a descrição não entra em `search_vector`.
    """
    description = book.description or ""
    return description[:BOOK_HEADLINE_CHARS]
