"""
Querysets/managers do app hymns.

`HymnBookQuerySet.published()` retorna só publicados; `visible_to(user)` é a
versão "consciente do papel" usada por views públicas (lista, home, busca) —
inclui hinários não-publicados que `user` pode ver: dono, editor (com
`hymns.can_review_any_hymnbook`) e superuser.
"""

from __future__ import annotations

from django.db import models
from django.db.models import Case, Count, F, IntegerField, OuterRef, Q, Subquery, Value, When
from django.db.models.functions import Coalesce


def _pct(num_field: str, den_field: str):
    """Helper: % inteiro `num/den * 100`, com 0 quando o denominador é 0.

    Útil pra anotações empilhadas — evita repetir o `Case/When` em cada métrica.
    """
    return Case(
        When(**{den_field: 0}, then=Value(0)),
        default=(F(num_field) * 100) / Coalesce(F(den_field), 1),
        output_field=IntegerField(),
    )


class HymnBookQuerySet(models.QuerySet):
    def published(self):
        return self.filter(is_published=True)

    def visible_to(self, user):
        if not getattr(user, "is_authenticated", False):
            return self.published()
        if user.is_superuser or user.has_perm("hymns.can_review_any_hymnbook"):
            return self.all()
        return self.filter(Q(is_published=True) | Q(owner_user=user))

    def with_review_progress(self):
        """
        Anota cada HymnBook com 4 métricas de completude (`review_pct`,
        `style_pct`, `reps_pct`, `audio_pct`) em uma única query.

        Cuidado: `style_hymns`/`reps_hymns`/`audio_hymns` usam `Subquery` (não
        `Count(filter=...)` empilhado) — caso contrário, múltiplos JOINs no
        mesmo nível disparam o famoso *cross-product* do ORM que multiplica
        valores. O padrão segue `_annotate_card_counts` em `views.py`.
        """
        # Import local para evitar ciclo (managers ↔ models).
        from .models import Hymn

        style_subq = (
            Hymn.objects.filter(hymn_book=OuterRef("pk"))
            .exclude(style="")
            .values("hymn_book")
            .annotate(c=Count("*"))
            .values("c")
        )
        reps_subq = (
            Hymn.objects.filter(hymn_book=OuterRef("pk"))
            .exclude(repetitions="")
            .values("hymn_book")
            .annotate(c=Count("*"))
            .values("c")
        )
        audio_subq = (
            Hymn.objects.filter(hymn_book=OuterRef("pk"), audios__is_approved=True)
            .values("hymn_book")
            .annotate(c=Count("pk", distinct=True))
            .values("c")
        )

        return self.annotate(
            total_hymns=Count("hymns", distinct=True),
            reviewed_hymns=Count(
                "hymns",
                filter=Q(hymns__review_status=Hymn.ReviewStatus.REVIEWED),
                distinct=True,
            ),
            in_review_hymns=Count(
                "hymns",
                filter=Q(hymns__review_status=Hymn.ReviewStatus.IN_REVIEW),
                distinct=True,
            ),
            style_hymns=Coalesce(Subquery(style_subq, output_field=IntegerField()), 0),
            reps_hymns=Coalesce(Subquery(reps_subq, output_field=IntegerField()), 0),
            audio_hymns=Coalesce(Subquery(audio_subq, output_field=IntegerField()), 0),
        ).annotate(
            review_pct=_pct("reviewed_hymns", "total_hymns"),
            style_pct=_pct("style_hymns", "total_hymns"),
            reps_pct=_pct("reps_hymns", "total_hymns"),
            audio_pct=_pct("audio_hymns", "total_hymns"),
        )


HymnBookManager = models.Manager.from_queryset(HymnBookQuerySet)
