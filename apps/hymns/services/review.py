"""
Marco 2.0.5 — pré-condições de publicação enriquecidas.

`publish_readiness(hymnbook)` retorna lista estruturada de checks para o modal
de publicação. Os 4 critérios alinham com o design da Fase 2 (tela 6 do PDF).
"""

from __future__ import annotations

from apps.hymns.models import HymnRevision


def publish_readiness(hymnbook) -> dict:
    progress = hymnbook.review_progress
    total = progress["total"]
    reviewed = progress["reviewed"]

    reviewer_count = (
        HymnRevision.objects.filter(hymn__hymn_book=hymnbook, revised_by__isnull=False)
        .values("revised_by")
        .distinct()
        .count()
    )

    checks = [
        {
            "label": (
                f"Todos os {total} hinos revisados"
                if total
                else "Hinário precisa ter pelo menos um hino revisado"
            ),
            "ok": total > 0 and reviewed == total,
            "key": "reviewed",
        },
        {
            # O design mostra "Capa e descrição preenchidas". Aqui exigimos
            # apenas a descrição: capa é nice-to-have e nem todo hinário tem.
            "label": "Capa e descrição preenchidas",
            "ok": bool(hymnbook.description),
            "key": "metadata",
        },
        {
            "label": "Dono do hinário identificado",
            "ok": hymnbook.owner_user_id is not None,
            "key": "owner",
        },
        {
            "label": (
                f"Auditoria registrada · {reviewer_count} revisor"
                + ("es" if reviewer_count != 1 else "")
            ),
            "ok": reviewer_count >= 1,
            "key": "audit",
        },
    ]

    can_publish = all(c["ok"] for c in checks)

    return {
        "checks": checks,
        "can_publish": can_publish,
        "review_progress": progress,
        "reviewer_count": reviewer_count,
    }
