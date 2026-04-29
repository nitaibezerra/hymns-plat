"""
Marco 2.0.3 — endpoints JSON da Fase 2 ligados ao app users.
"""

from __future__ import annotations

from datetime import date, timedelta

from django.db.models import Count
from django.db.models.functions import TruncDate
from django.http import JsonResponse
from django.shortcuts import get_object_or_404

from apps.hymns.models import HymnRevision

from .models import User


def api_user_heatmap(request, username):
    """Heatmap "Trabalho editorial · último ano" no perfil."""
    user = get_object_or_404(User, username=username)
    today = date.today()
    start = today - timedelta(days=365)

    rows = (
        HymnRevision.objects.filter(revised_by=user, revised_at__date__gte=start)
        .annotate(day=TruncDate("revised_at"))
        .values("day")
        .annotate(count=Count("id"))
        .order_by("day")
    )
    by_day = {row["day"]: row["count"] for row in rows}

    days = []
    for offset in range(366):
        d = start + timedelta(days=offset)
        days.append({"date": d.isoformat(), "count": by_day.get(d, 0)})
    return JsonResponse({"username": user.username, "days": days})
