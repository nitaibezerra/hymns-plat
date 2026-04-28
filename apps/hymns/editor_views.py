"""
Marco 1.5 — workspace do editor.

Views namespaceadas como `editor_*` que entregam:
- Lista de hinários ordenável por progresso de revisão.
- Lista de hinos de um hinário com seu estado.
- Redirect "próximo não-revisado" para fluxo rápido.
- Form de revisão com botão "Salvar e próximo" / "Salvar e voltar".

Os templates aqui são mínimos/provisórios — a Fase 2 reescreve a UI.
"""

from __future__ import annotations

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone

from .models import Hymn, HymnBook
from .permissions import can_edit_hymnbook


def _has_editor_access(user) -> bool:
    """
    Editor (papel global) tem acesso ao workspace; donos de hinários também
    podem usar a fila para os próprios hinários — view filtra o queryset.
    """
    if not getattr(user, "is_authenticated", False):
        return False
    if user.is_superuser:
        return True
    if user.has_perm("hymns.can_review_any_hymnbook"):
        return True
    return HymnBook.objects.filter(owner_user=user).exists()


def _editor_visible_books(user):
    if user.is_superuser or user.has_perm("hymns.can_review_any_hymnbook"):
        return HymnBook.objects.all()
    return HymnBook.objects.filter(owner_user=user)


@login_required
def editor_hymnbook_list(request):
    if not _has_editor_access(request.user):
        messages.error(request, "Você não tem acesso ao workspace do editor.")
        return redirect("hymns:home")

    sort = request.GET.get("sort", "least_reviewed")
    qs = _editor_visible_books(request.user).with_review_progress()
    if sort == "most_reviewed":
        qs = qs.order_by("-review_pct", "name")
    elif sort == "recent":
        qs = qs.order_by("-created_at")
    else:
        qs = qs.order_by("review_pct", "name")

    return render(
        request,
        "hymns/editor/hymnbook_list.html",
        {"hymnbooks": list(qs), "sort": sort},
    )


@login_required
def editor_hymnbook_detail(request, slug):
    hymnbook = get_object_or_404(HymnBook, slug=slug)
    if not can_edit_hymnbook(request.user, hymnbook):
        messages.error(request, "Você não tem permissão para revisar este hinário.")
        return redirect("hymns:home")

    hymns = hymnbook.hymns.all().order_by("number")
    return render(
        request,
        "hymns/editor/hymnbook_detail.html",
        {"hymnbook": hymnbook, "hymns": hymns, "progress": hymnbook.review_progress},
    )


@login_required
def editor_next_hymn(request, slug):
    hymnbook = get_object_or_404(HymnBook, slug=slug)
    if not can_edit_hymnbook(request.user, hymnbook):
        messages.error(request, "Você não tem permissão para revisar este hinário.")
        return redirect("hymns:home")

    pending = (
        hymnbook.hymns.exclude(review_status=Hymn.ReviewStatus.REVIEWED)
        .order_by("number")
        .first()
    )
    if pending is None:
        messages.success(request, "Todos os hinos deste hinário estão revisados.")
        return redirect("hymns:editor_hymnbook_detail", slug=hymnbook.slug)
    return redirect("hymns:editor_revise_hymn", pk=pending.pk)


@login_required
def editor_revise_hymn(request, pk):
    hymn = get_object_or_404(Hymn.objects.select_related("hymn_book"), pk=pk)
    if not can_edit_hymnbook(request.user, hymn.hymn_book):
        messages.error(request, "Você não tem permissão para revisar este hino.")
        return redirect("hymns:home")

    if request.method == "POST":
        editable_fields = ("number", "title", "text", "repetitions", "extra_instructions", "style", "offered_to")
        for field in editable_fields:
            if field in request.POST:
                value = request.POST.get(field, "").strip()
                if field == "number":
                    try:
                        setattr(hymn, field, int(value))
                    except (TypeError, ValueError):
                        messages.error(request, "Número inválido.")
                        return redirect("hymns:editor_revise_hymn", pk=pk)
                else:
                    setattr(hymn, field, value)

        new_status = request.POST.get("review_status")
        if new_status in Hymn.ReviewStatus.values:
            hymn.review_status = new_status

        hymn.last_reviewed_by = request.user
        hymn.last_reviewed_at = timezone.now()
        hymn.save()

        next_action = request.POST.get("next_action", "next")
        if next_action == "next":
            pending = (
                hymn.hymn_book.hymns.exclude(review_status=Hymn.ReviewStatus.REVIEWED)
                .exclude(pk=hymn.pk)
                .order_by("number")
                .first()
            )
            if pending is not None:
                return redirect("hymns:editor_revise_hymn", pk=pending.pk)
        return redirect("hymns:editor_hymnbook_detail", slug=hymn.hymn_book.slug)

    return render(
        request,
        "hymns/editor/revise_hymn.html",
        {"hymn": hymn, "hymnbook": hymn.hymn_book},
    )
