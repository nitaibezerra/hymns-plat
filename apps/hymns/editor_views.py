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

from .models import Hymn, HymnAudio, HymnBook
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


def _pending_audios_for(user):
    """Áudios não aprovados que `user` tem permissão de aprovar."""
    qs = HymnAudio.objects.filter(is_approved=False).select_related("hymn", "hymn__hymn_book", "uploaded_by")
    if user.is_superuser or user.has_perm("hymns.can_review_any_hymnbook"):
        return qs
    return qs.filter(hymn__hymn_book__owner_user=user)


@login_required
def editor_pending_audios(request):
    """Lista áudios aguardando aprovação."""
    if not _has_editor_access(request.user):
        messages.error(request, "Você não tem acesso ao workspace do editor.")
        return redirect("hymns:home")
    audios = list(_pending_audios_for(request.user).order_by("-created_at"))
    return render(
        request,
        "hymns/editor/pending_audios.html",
        {"audios": audios},
    )


@login_required
def editor_approve_audio(request, pk):
    audio = get_object_or_404(HymnAudio.objects.select_related("hymn", "hymn__hymn_book"), pk=pk)
    if not can_edit_hymnbook(request.user, audio.hymn.hymn_book):
        messages.error(request, "Você não tem permissão para aprovar este áudio.")
        return redirect("hymns:editor_pending_audios")
    if request.method != "POST":
        return redirect("hymns:editor_pending_audios")
    audio.is_approved = True
    audio.save(update_fields=["is_approved", "updated_at"])
    messages.success(request, f"Áudio aprovado: {audio.title or audio.hymn.title}.")
    return redirect("hymns:editor_pending_audios")


@login_required
def editor_reject_audio(request, pk):
    audio = get_object_or_404(HymnAudio.objects.select_related("hymn", "hymn__hymn_book"), pk=pk)
    if not can_edit_hymnbook(request.user, audio.hymn.hymn_book):
        messages.error(request, "Você não tem permissão para rejeitar este áudio.")
        return redirect("hymns:editor_pending_audios")
    if request.method != "POST":
        return redirect("hymns:editor_pending_audios")
    audio.delete()
    messages.success(request, "Áudio rejeitado e removido.")
    return redirect("hymns:editor_pending_audios")


@login_required
def editor_hymnbook_list(request):
    from datetime import timedelta

    from .models import Hymn, HymnRevision

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

    # Stats inline (4 hinários · 173 hinos pendentes · 89 revisados · 7 dias)
    visible_ids = list(_editor_visible_books(request.user).values_list("pk", flat=True))
    pending_hymns = (
        Hymn.objects.filter(hymn_book_id__in=visible_ids).exclude(review_status=Hymn.ReviewStatus.REVIEWED).count()
    )
    cutoff = timezone.now() - timedelta(days=7)
    recent_reviewed = HymnRevision.objects.filter(
        hymn__hymn_book_id__in=visible_ids,
        revised_at__gte=cutoff,
        new_status=Hymn.ReviewStatus.REVIEWED,
    ).count()

    # Continuar revisão: último hino com revisão do user, ainda não REVIEWED
    resume = (
        HymnRevision.objects.filter(revised_by=request.user)
        .exclude(hymn__review_status=Hymn.ReviewStatus.REVIEWED)
        .select_related("hymn", "hymn__hymn_book")
        .order_by("-revised_at")
        .first()
    )

    pending_audios_count = _pending_audios_for(request.user).count()

    return render(
        request,
        "hymns/editor/hymnbook_list.html",
        {
            "hymnbooks": list(qs),
            "sort": sort,
            "stats": {
                "books": len(visible_ids),
                "pending_hymns": pending_hymns,
                "recent_reviewed": recent_reviewed,
            },
            "resume": resume,
            "pending_audios_count": pending_audios_count,
        },
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

    pending = hymnbook.hymns.exclude(review_status=Hymn.ReviewStatus.REVIEWED).order_by("number").first()
    if pending is None:
        messages.success(request, "Todos os hinos deste hinário estão revisados.")
        return redirect("hymns:editor_hymnbook_detail", slug=hymnbook.slug)
    return redirect("hymns:editor_revise_hymn", pk=pending.pk)


@login_required
def editor_revise_hymn(request, pk):
    from django.http import JsonResponse

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

        # Marco 2.1.5 — autosave HTMX devolve JSON com timestamp.
        if request.POST.get("autosave") == "1" or request.headers.get("HX-Request"):
            return JsonResponse({"ok": True, "saved_at": timezone.now().isoformat()})

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

    # Posição na fila + restantes
    book_hymns = list(hymn.hymn_book.hymns.order_by("number").values_list("pk", "review_status"))
    total = len(book_hymns)
    position = next((i + 1 for i, t in enumerate(book_hymns) if str(t[0]) == str(hymn.pk)), 0)
    remaining = sum(1 for _pk, status in book_hymns if status != Hymn.ReviewStatus.REVIEWED)
    if hymn.review_status != Hymn.ReviewStatus.REVIEWED:
        remaining = max(remaining - 1, 0)

    return render(
        request,
        "hymns/editor/revise_hymn.html",
        {
            "hymn": hymn,
            "hymnbook": hymn.hymn_book,
            "position": position,
            "total": total,
            "remaining": remaining,
            "inline_diff": _compute_inline_diff(hymn.ocr_text, hymn.text),
            "ocr_line_confidences": _compute_ocr_line_confidences(hymn.ocr_text, hymn.text),
            "common_repetitions": _common_field_values(hymn.hymn_book, "repetitions", top=4),
            "common_styles": _common_field_values(hymn.hymn_book, "style", top=3),
        },
    )


def _common_field_values(book, field: str, top: int) -> list[str]:
    """Top-N valores não-vazios mais usados em `field` dentro do hinário.

    Sugestões editoriais por hinário ajudam a manter consistência interna
    (cada livro tem vocabulário próprio: estilos, padrões de repetição).
    """
    from django.db.models import Count

    rows = book.hymns.exclude(**{field: ""}).values(field).annotate(c=Count("id")).order_by("-c", field)[:top]
    return [row[field] for row in rows]


def _compute_inline_diff(ocr: str, current: str) -> dict:
    """Diff entre OCR e texto revisado em duas camadas (linha → palavra).

    Estratégia:
    1. SequenceMatcher no nível de **linhas** alinha pares OCR↔current.
    2. Para opcodes `replace` 1-para-1, segundo SequenceMatcher no nível de
       **palavras** gera tokens `eq`/`sub`/`add`/`del`.
    3. `replace` n-para-m (n≠m), `insert`, `delete` → linhas inteiras
       marcadas como `add` ou `del`.

    Retorna `{lines: [{kind, tokens}], changes, adds, dels}` onde:
    - `changes` = nº de substituições intra-linha (palavras trocadas)
    - `adds`    = nº de linhas acrescentadas
    - `dels`    = nº de linhas removidas
    """
    import difflib
    import re

    if not ocr:
        return {"lines": [], "changes": 0, "adds": 0, "dels": 0}

    ocr_lines = ocr.splitlines()
    cur_lines = current.splitlines()
    matcher = difflib.SequenceMatcher(None, ocr_lines, cur_lines)

    lines: list[dict] = []
    changes = adds = dels = 0

    def _word_diff(before: str, after: str) -> list[dict]:
        before_tokens = re.findall(r"\S+|\s+", before)
        after_tokens = re.findall(r"\S+|\s+", after)
        sm = difflib.SequenceMatcher(None, before_tokens, after_tokens)
        out: list[dict] = []
        for op, i1, i2, j1, j2 in sm.get_opcodes():
            if op == "equal":
                out.append({"kind": "eq", "text": "".join(before_tokens[i1:i2])})
            elif op == "replace":
                out.append(
                    {
                        "kind": "sub",
                        "sub": "".join(before_tokens[i1:i2]),
                        "add": "".join(after_tokens[j1:j2]),
                    }
                )
            elif op == "insert":
                out.append({"kind": "add", "text": "".join(after_tokens[j1:j2])})
            elif op == "delete":
                out.append({"kind": "del", "text": "".join(before_tokens[i1:i2])})
        return out

    for op, i1, i2, j1, j2 in matcher.get_opcodes():
        if op == "equal":
            for line in ocr_lines[i1:i2]:
                lines.append({"kind": "eq", "tokens": [{"kind": "eq", "text": line}]})
        elif op == "replace" and (i2 - i1) == (j2 - j1):
            # Pares 1-para-1: word-level diff por linha.
            for before, after in zip(ocr_lines[i1:i2], cur_lines[j1:j2], strict=True):
                tokens = _word_diff(before, after)
                # Linha inteira pode contar como uma substituição editorial.
                if any(t["kind"] in ("sub", "add", "del") for t in tokens):
                    changes += 1
                lines.append({"kind": "replace", "tokens": tokens})
        else:
            # n-para-m, insert, delete → linhas inteiras marcadas.
            for line in ocr_lines[i1:i2]:
                lines.append({"kind": "del", "tokens": [{"kind": "del", "text": line}]})
                dels += 1
            for line in cur_lines[j1:j2]:
                lines.append({"kind": "add", "tokens": [{"kind": "add", "text": line}]})
                adds += 1

    return {"lines": lines, "changes": changes, "adds": adds, "dels": dels}


def _compute_ocr_line_confidences(ocr: str, current: str) -> list[int]:
    """Sinal posterior de fidelidade do OCR por linha.

    Não armazenamos confiança por-linha do Tesseract; ao invés disso, calculamos
    a similaridade entre cada linha do OCR e a linha mais próxima do texto
    revisado. Lines que o editor reescreveu pesado caem para perto de 0; lines
    intactas ficam em 100. É o melhor sinal disponível com o esquema atual e
    é editorialmente útil — destaca exatamente onde o OCR errou.
    """
    import difflib

    if not ocr:
        return []
    current_lines = [ln for ln in current.splitlines() if ln.strip()]
    out: list[int] = []
    for ocr_line in ocr.splitlines():
        if not ocr_line.strip():
            continue
        if not current_lines:
            out.append(0)
            continue
        best = max(difflib.SequenceMatcher(None, ocr_line, candidate).ratio() for candidate in current_lines)
        out.append(round(best * 100))
    return out
