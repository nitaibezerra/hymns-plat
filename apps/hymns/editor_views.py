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

import json

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_POST

from .models import Hymn, HymnAudio, HymnBook
from .permissions import can_edit_hymnbook


def _has_editor_access(user) -> bool:
    """
    Editor (papel global) ou superuser têm acesso ao workspace. Donos comuns
    não — toda edição editorial agora exige o papel formal (mesma regra de
    `can_edit_hymnbook`).
    """
    if not getattr(user, "is_authenticated", False):
        return False
    if user.is_superuser:
        return True
    return user.has_perm("hymns.can_review_any_hymnbook")


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


def _next_pending_hymn(hymnbook, current_hymn=None):
    """Próximo hino não-revisado dentro do hinário.

    Estratégia de fila linear: prefere hinos com `number > current.number`;
    fallback para o primeiro pendente global (wrap-around) quando estamos no
    fim do hinário. Sempre exclui o hino atual para evitar redirect circular
    em casos de borda (status ainda em transição etc.).
    """
    qs = hymnbook.hymns.exclude(review_status=Hymn.ReviewStatus.REVIEWED)
    if current_hymn is not None:
        qs = qs.exclude(pk=current_hymn.pk)
        higher = qs.filter(number__gt=current_hymn.number).order_by("number").first()
        if higher is not None:
            return higher
    return qs.order_by("number").first()


@login_required
def editor_quick_review(request, slug):
    """Tela 07c · Revisão ágil — fluxo rápido só de `style` + `repetitions`.

    Esta view nunca modifica `review_status`, `last_reviewed_at` ou
    `last_reviewed_by`. A marcação como REVIEWED continua exigindo a tela
    completa (`editor_revise_hymn`). O signal de `HymnRevision` cria audit
    trail automaticamente quando um dos dois campos muda.
    """
    from .forms import QuickReviewForm

    hymnbook = get_object_or_404(HymnBook, slug=slug)
    if not can_edit_hymnbook(request.user, hymnbook):
        messages.error(request, "Você não tem permissão para revisar este hinário.")
        return redirect("hymns:home")

    hymns = list(hymnbook.hymns.all().order_by("number"))
    if not hymns:
        messages.info(request, "Hinário sem hinos para revisar.")
        return redirect("hymns:editor_hymnbook_detail", slug=hymnbook.slug)

    # Seleção do hino atual via ?h=<number>; default = primeiro.
    requested = request.GET.get("h")
    current = None
    if requested:
        try:
            current = next(h for h in hymns if h.number == int(requested))
        except (ValueError, StopIteration):
            current = None
    if current is None:
        current = hymns[0]

    if request.method == "POST":
        form = QuickReviewForm(request.POST, instance=current)
        if form.is_valid():
            form.save()
        # Avança independente de erros de form (erros simples num CharField
        # aqui são pouco prováveis; se ocorrerem, fica visível no GET seguinte).
        idx = hymns.index(current)
        if idx + 1 < len(hymns):
            next_h = hymns[idx + 1]
            url = reverse("hymns:editor_quick_review", kwargs={"slug": hymnbook.slug})
            return redirect(f"{url}?h={next_h.number}")
        return redirect("hymns:editor_hymnbook_detail", slug=hymnbook.slug)

    idx = hymns.index(current)
    prev_hymn = hymns[idx - 1] if idx > 0 else None
    next_hymn = hymns[idx + 1] if idx + 1 < len(hymns) else None
    return render(
        request,
        "hymns/editor/quick_review.html",
        {
            "hymnbook": hymnbook,
            "current_hymn": current,
            "prev_hymn": prev_hymn,
            "next_hymn": next_hymn,
            "position": idx + 1,
            "total": len(hymns),
            # Presets fixos da revisão ágil — ordem casa com os atalhos M/V/Z
            # e 1/2/3/4 (design Fase 2 chat2.md). NÃO use `Hymn.CANONICAL_*`
            # aqui: aquela lista é mais ampla e tem ordem própria; misturaria
            # os atalhos.
            "quick_styles": ["Marcha", "Valsa", "Mazurca"],
            "quick_repetitions": ["1-2,3-4", "1-4", "1-2,3-4,1-4", "3-4,1-4"],
        },
    )


@login_required
def editor_next_hymn(request, slug):
    hymnbook = get_object_or_404(HymnBook, slug=slug)
    if not can_edit_hymnbook(request.user, hymnbook):
        messages.error(request, "Você não tem permissão para revisar este hinário.")
        return redirect("hymns:home")

    current = None
    from_pk = request.GET.get("from")
    if from_pk:
        current = hymnbook.hymns.filter(pk=from_pk).first()

    pending = _next_pending_hymn(hymnbook, current)
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

        next_action = request.POST.get("next_action", "next")
        # Autosave dispara via fetch() do JS com `autosave=1` no body. NÃO usar
        # HX-Request como sinal: `<body hx-boost="true">` no base.html faz
        # com que o HTMX adicione esse header em TODOS os submits, mascarando
        # o submit normal como autosave e quebrando o redirect de navegação.
        # O form da tela de revisão também declara `hx-boost="false"` para
        # garantir que o submit faça uma navegação tradicional.
        is_autosave = request.POST.get("autosave") == "1"

        # "Marcar revisado e avançar" (next_action=next) precisa marcar o hino
        # como REVIEWED mesmo se o radio ficou em outro estado. O autosave NÃO
        # aplica essa regra (continua salvando o estado atual).
        if next_action == "next" and not is_autosave:
            hymn.review_status = Hymn.ReviewStatus.REVIEWED

        hymn.last_reviewed_by = request.user
        hymn.last_reviewed_at = timezone.now()
        hymn.save()

        if is_autosave:
            return JsonResponse({"ok": True, "saved_at": timezone.now().isoformat()})

        if next_action == "next":
            pending = _next_pending_hymn(hymn.hymn_book, hymn)
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

    audio = hymn.audios.filter(is_approved=True).first() or hymn.audios.first()

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
            "common_repetitions": list(Hymn.CANONICAL_REPETITIONS),
            "common_styles": list(Hymn.CANONICAL_STYLES),
            "audio": audio,
            "audio_observations": list(HymnAudio.QUALITY_OBSERVATIONS),
            "audio_mismatch_reasons": HymnAudio.MismatchReason.choices,
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


@login_required
@require_POST
def editor_hymn_audio_review(request, hymn_pk, audio_pk):
    """Atualiza decisões de revisão de áudio (is_match, quality, mismatch_reason).

    Aceita JSON parcial — só os campos presentes são atualizados. Qualquer
    update marca `reviewed_by`/`reviewed_at`. Save() do model força
    `is_approved=False` em mismatches e zera os campos da vertente oposta.
    """
    hymn = get_object_or_404(Hymn.objects.select_related("hymn_book"), pk=hymn_pk)
    audio = get_object_or_404(HymnAudio, pk=audio_pk, hymn=hymn)
    if not can_edit_hymnbook(request.user, hymn.hymn_book):
        return HttpResponseForbidden("Sem permissão para revisar este áudio.")

    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "JSON inválido"}, status=400)
    if not isinstance(payload, dict):
        return JsonResponse({"error": "Payload deve ser objeto"}, status=400)

    if "is_match" in payload:
        v = payload["is_match"]
        audio.is_match = bool(v) if v is not None else None

    if "quality_rating" in payload:
        v = payload["quality_rating"]
        audio.quality_rating = v if v in {1, 2, 3, 4, 5} else None

    if "quality_observations" in payload:
        valid = set(HymnAudio.QUALITY_OBSERVATIONS)
        obs = payload["quality_observations"] or []
        audio.quality_observations = [o for o in obs if o in valid]

    if "mismatch_reason" in payload:
        valid = {c[0] for c in HymnAudio.MismatchReason.choices}
        v = payload["mismatch_reason"]
        audio.mismatch_reason = v if v in valid else ""

    audio.reviewed_by = request.user
    audio.reviewed_at = timezone.now()
    audio.save()

    return JsonResponse(
        {
            "is_match": audio.is_match,
            "quality_rating": audio.quality_rating,
            "quality_observations": audio.quality_observations,
            "mismatch_reason": audio.mismatch_reason,
            "is_approved": audio.is_approved,
        }
    )


@login_required
@require_POST
def editor_preview_render(request):
    """Renderiza o corpo do hino para um par `{text, repetitions}` arbitrário.

    Permite que o editor (live preview na tela 07 · Revisar Hino) reuse exatamente
    o `render_hymn_body` que renderiza as telas públicas (corrido/carrossel/
    hymn_detail) — single source of truth para o markup das barras de repetição.

    A view é leve (não toca DB), mas exige login + acesso ao workspace do
    editor (mesma política de `_has_editor_access`).
    """
    if not _has_editor_access(request.user):
        return HttpResponseForbidden("Sem acesso ao workspace do editor.")
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "JSON inválido"}, status=400)
    if not isinstance(payload, dict):
        return JsonResponse({"error": "Payload deve ser objeto"}, status=400)

    from .templatetags.hymn_extras import render_hymn_body_for_text

    text = str(payload.get("text") or "")
    repetitions = str(payload.get("repetitions") or "")
    return JsonResponse({"html": render_hymn_body_for_text(text, repetitions)})
