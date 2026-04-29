"""
Querysets/managers do app hymns.

`HymnBookQuerySet.published()` retorna só publicados; `visible_to(user)` é a
versão "consciente do papel" usada por views públicas (lista, home, busca) —
inclui hinários não-publicados que `user` pode ver: dono, editor (com
`hymns.can_review_any_hymnbook`) e superuser.
"""

from __future__ import annotations

from django.db import models
from django.db.models import Case, Count, F, IntegerField, Q, Value, When
from django.db.models.functions import Coalesce


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
        Anota cada HymnBook com `total_hymns`, `reviewed_hymns` e `review_pct`
        em uma única query (sem N+1).
        """
        # Import local para evitar ciclo (managers ↔ models).
        from .models import Hymn

        return self.annotate(
            total_hymns=Count("hymns"),
            reviewed_hymns=Count("hymns", filter=Q(hymns__review_status=Hymn.ReviewStatus.REVIEWED)),
            in_review_hymns=Count("hymns", filter=Q(hymns__review_status=Hymn.ReviewStatus.IN_REVIEW)),
        ).annotate(
            review_pct=Case(
                When(total_hymns=0, then=Value(0)),
                default=(F("reviewed_hymns") * 100) / Coalesce(F("total_hymns"), 1),
                output_field=IntegerField(),
            )
        )


HymnBookManager = models.Manager.from_queryset(HymnBookQuerySet)
