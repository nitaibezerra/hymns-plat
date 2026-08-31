from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Count, IntegerField, OuterRef, Subquery
from django.db.models.functions import Coalesce
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_POST
from django.views.generic import DetailView, ListView

from .forms import HymnBookEditorialForm, HymnBookForm, HymnForm
from .models import Hymn, HymnAudio, HymnBook
from .permissions import can_create_hymnbook, can_edit_hymnbook, can_publish_hymnbook
from .search import book_headline, build_book_search_qs, build_hymn_search_qs


def _annotate_card_counts(queryset):
    """Anota `n_hymns_anno` e `n_audios_anno` em cada HymnBook do queryset.

    Usado pelos templates de card (home/list) para exibir contagens. Subquery
    para áudios aprovados (uma única hit por HymnBook) — evita o problema
    clássico de cross-product de múltiplos Count distinct no mesmo annotate.
    """
    audios_subq = (
        HymnAudio.objects.filter(hymn__hymn_book=OuterRef("pk"), is_approved=True)
        .values("hymn__hymn_book")
        .annotate(c=Count("*"))
        .values("c")
    )
    return queryset.annotate(
        n_hymns_anno=Count("hymns", distinct=True),
        n_audios_anno=Coalesce(Subquery(audios_subq, output_field=IntegerField()), 0),
    )


def _hourly_featured(visible_qs, n=6):
    """Sample determinístico por hora cheia para a seção 'Em destaque' da home.

    Delegado: a regra canônica vive em `apps.hymns.featured.hourly_featured`
    (era duplicada, e a cópia de lá havia perdido o passo do `is_featured`).
    `now` é resolvido aqui de propósito, para que a seed continue observável
    por quem mocka `apps.hymns.views.timezone.now`; `_annotate_card_counts`
    entra como `annotate` pra alimentar os cards da home.
    """
    from .featured import hourly_featured

    return hourly_featured(visible_qs, n=n, now=timezone.now(), annotate=_annotate_card_counts)


class HymnBookListView(ListView):
    """List all hymn books."""

    model = HymnBook
    template_name = "hymns/hymnbook_list.html"
    context_object_name = "hymnbooks"
    paginate_by = 20

    def get_queryset(self):
        return _annotate_card_counts(HymnBook.objects.visible_to(self.request.user)).order_by("name")


class HymnBookDetailView(DetailView):
    """Display a single hymn book with all its hymns (sumário/índice)."""

    model = HymnBook
    template_name = "hymns/hymnbook_detail.html"
    context_object_name = "hymnbook"
    slug_field = "slug"
    slug_url_kwarg = "slug"

    def get(self, request, *args, **kwargs):
        # Share links antigos `?mode=corrido|carrossel` agora vivem em /ler/.
        legacy_mode = request.GET.get("mode")
        if legacy_mode in {"corrido", "carrossel"}:
            url = reverse("hymns:hymnbook_read", kwargs={"slug": kwargs.get("slug")})
            return HttpResponseRedirect(f"{url}?modo={legacy_mode}")
        return super().get(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        hymns = list(self.object.hymns.all().prefetch_related("audios").order_by("number"))
        # Set de números com áudio aprovado — usado pelo template pra ícone ▶/⊘
        # por linha e pra desabilitar o botão "Tocar hinário" quando 0 áudios.
        hymns_with_audio = {h.number for h in hymns if any(a.is_approved for a in h.audios.all())}
        context["hymns"] = hymns
        context["hymns_with_audio"] = hymns_with_audio
        context["audios_count"] = len(hymns_with_audio)
        context["can_edit"] = can_edit_hymnbook(self.request.user, self.object)
        if self.request.user.is_authenticated and self.request.user.is_staff:
            context["editorial_form"] = HymnBookEditorialForm(instance=self.object)
            # Curto e fixo: o segmented control não usa as labels longas
            # ("P1 — alta urgência") do TextChoices. Ordem casa com a
            # ordem dos choices.
            context["priority_segmented_labels"] = [
                ("P1", "P1 Urgente"),
                ("P2", "P2 Atenção"),
                ("P3", "P3"),
            ]
        return context


class HymnBookReadView(DetailView):
    """Tela de leitura imersiva (corrido ou carrossel) de um hinário.

    Sem hero/cabeçalho do hinário — apenas breadcrumb, toggle e os hinos.
    Default `modo=corrido`. `?hino=N` posiciona a tela no hino N ao carregar.
    """

    model = HymnBook
    template_name = "hymns/hymnbook_read.html"
    context_object_name = "hymnbook"
    slug_field = "slug"
    slug_url_kwarg = "slug"

    def get_queryset(self):
        return HymnBook.objects.visible_to(self.request.user)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        hymns = list(self.object.hymns.all().prefetch_related("audios").order_by("number"))
        hymns_with_audio = {h.number for h in hymns if any(a.is_approved for a in h.audios.all())}

        modo = self.request.GET.get("modo", "corrido")
        if modo not in {"corrido", "carrossel"}:
            modo = "corrido"

        try:
            initial_hymn = int(self.request.GET.get("hino", "") or 0) or None
        except ValueError:
            initial_hymn = None

        context["hymns"] = hymns
        context["hymns_with_audio"] = hymns_with_audio
        context["audios_count"] = len(hymns_with_audio)
        context["modo"] = modo
        context["initial_hymn"] = initial_hymn or ""
        return context


class HymnDetailView(DetailView):
    """Display a single hymn."""

    model = Hymn
    template_name = "hymns/hymn_detail.html"
    context_object_name = "hymn"
    pk_url_kwarg = "pk"

    def get_queryset(self):
        return Hymn.objects.select_related("hymn_book")

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        hymn = self.object

        # Check if favorited by current user
        if self.request.user.is_authenticated:
            from .models import Favorite

            context["is_favorited"] = Favorite.objects.filter(user=self.request.user, hymn=hymn).exists()

        # Get approved audios
        context["audios"] = hymn.audios.filter(is_approved=True).order_by("-created_at")

        # Permissão de edição
        context["can_edit"] = can_edit_hymnbook(self.request.user, hymn.hymn_book)

        # Marco 2.1.3 — navegação anterior/próximo dentro do hinário
        siblings = list(hymn.hymn_book.hymns.order_by("number").values("pk", "number"))
        idx = next(
            (i for i, s in enumerate(siblings) if str(s["pk"]) == str(hymn.pk)),
            None,
        )
        context["prev_hymn"] = siblings[idx - 1] if idx is not None and idx > 0 else None
        context["next_hymn"] = siblings[idx + 1] if idx is not None and idx + 1 < len(siblings) else None

        return context


def search_view(request):
    """
    Busca expandida (Marco 2.0.4): hinos + hinários, com tabs e headline.

    Querystring:
    - `q`: termo (obrigatório para retornar resultados)
    - `type`: `all` (default) | `hymns` | `books`
    - `in_hymnbook`: slug — filtra resultados de hinos a um hinário específico

    Resultados como lista heterogênea de dicts:
        {"type": "hymn"|"book", "obj": <model>, "headline": "...<mark>...", "rank": float}

    Visibilidade respeita `HymnBook.objects.visible_to(user)`.
    """
    query = request.GET.get("q", "").strip()
    search_type = request.GET.get("type", "all")
    if search_type not in {"all", "hymns", "books"}:
        search_type = "all"
    in_hymnbook_slug = request.GET.get("in_hymnbook", "").strip()

    visible_books = HymnBook.objects.visible_to(request.user)
    filter_hymnbook = None
    if in_hymnbook_slug:
        filter_hymnbook = visible_books.filter(slug=in_hymnbook_slug).first()

    results: list[dict] = []
    results_count_hymns = 0
    results_count_books = 0

    if query:
        # Os querysets vêm de `apps.hymns.search`, que é onde o resolver
        # GraphQL `Query.search` também os pega. Esta view mantinha uma cópia
        # própria das anotações (FTS + trigram + headline) apesar de o módulo
        # existir exatamente pra evitar isso, e as duas cópias divergiram: só a
        # daqui tinha `headline`, então a busca da SPA saía sem snippet.
        # Uma implementação, dois consumidores.
        hymn_qs = build_hymn_search_qs(
            query,
            request.user,
            # O filtro usa o hinário RESOLVIDO, não o slug cru: um slug
            # inexistente ou invisível resolve pra `None` e não deve filtrar
            # nada — comportamento preservado da versão anterior.
            in_hymnbook_slug=filter_hymnbook.slug if filter_hymnbook is not None else "",
        )
        book_qs = build_book_search_qs(query, request.user)

        hymn_results = list(hymn_qs[:50])
        book_results = list(book_qs[:25])
        results_count_hymns = len(hymn_results)
        results_count_books = len(book_results)

        if search_type in {"all", "hymns"}:
            for h in hymn_results:
                results.append(
                    {
                        "type": "hymn",
                        "obj": h,
                        "headline": h.headline or "",
                        "rank": h.rank or 0.0,
                    }
                )
        if search_type in {"all", "books"}:
            for b in book_results:
                results.append(
                    {
                        "type": "book",
                        "obj": b,
                        "headline": book_headline(b),
                        "rank": float(b.name_sim or 0),
                    }
                )

        if search_type == "all":
            # Em "tudo" misturamos por rank: hinos têm rank FTS (0..1), books têm
            # similaridade trigram (0..1) — comparáveis o suficiente.
            results.sort(key=lambda r: r["rank"], reverse=True)
            results = results[:50]

    context = {
        "query": query,
        "search_type": search_type,
        "results": results,
        "total": len(results),
        "results_count_all": results_count_hymns + results_count_books,
        "results_count_hymns": results_count_hymns,
        "results_count_books": results_count_books,
        "filter_hymnbook": filter_hymnbook,
    }
    return render(request, "hymns/search.html", context)


def home_view(request):
    """Home page com hero, big search e cards "Em destaque".

    Stats vêm do `/api/stats/global/` no client; aqui exponho-as direto no
    contexto também para SSR (1.ª pintura sem flicker).
    """
    from datetime import timedelta

    from django.utils import timezone

    from .models import HymnAudio, HymnRevision

    recent_hymnbooks = _hourly_featured(HymnBook.objects.visible_to(request.user), n=6)
    total_hymnbooks = HymnBook.objects.published().count()
    total_hymns = Hymn.objects.filter(hymn_book__is_published=True).count()
    total_audios = HymnAudio.objects.filter(is_approved=True).count()
    cutoff = timezone.now() - timedelta(days=30)
    active_reviewers = (
        HymnRevision.objects.filter(revised_at__gte=cutoff, revised_by__isnull=False)
        .values("revised_by")
        .distinct()
        .count()
    )

    context = {
        "recent_hymnbooks": recent_hymnbooks,
        "total_hymnbooks": total_hymnbooks,
        "total_hymns": total_hymns,
        "total_audios": total_audios,
        "active_reviewers": active_reviewers,
    }
    return render(request, "hymns/home.html", context)


@login_required
def hymnbook_create_view(request):
    """Cria um HymnBook via web (sem YAML). Restrito a Editores/Admins."""
    if not can_create_hymnbook(request.user):
        messages.error(request, "Você não tem permissão para cadastrar hinários.")
        return redirect("hymns:hymnbook_list")

    if request.method == "POST":
        form = HymnBookForm(request.POST, request.FILES)
        if form.is_valid():
            hymnbook = form.save(commit=False)
            hymnbook.owner_user = request.user
            hymnbook.save()
            messages.success(request, f"Hinário '{hymnbook.name}' criado com sucesso.")
            return redirect("hymns:hymnbook_detail", slug=hymnbook.slug)
    else:
        form = HymnBookForm()
    return render(
        request,
        "hymns/hymnbook_form.html",
        {"form": form, "title": "Novo Hinário", "submit_label": "Criar"},
    )


@login_required
def hymnbook_edit_view(request, slug):
    """Edita um HymnBook. Permissão: dono ou superuser."""
    hymnbook = get_object_or_404(HymnBook, slug=slug)
    if not can_edit_hymnbook(request.user, hymnbook):
        messages.error(request, "Você não tem permissão para editar este hinário.")
        return redirect("hymns:hymnbook_detail", slug=slug)

    if request.method == "POST":
        form = HymnBookForm(request.POST, request.FILES, instance=hymnbook)
        if form.is_valid():
            form.save()
            messages.success(request, "Hinário atualizado.")
            return redirect("hymns:hymnbook_detail", slug=hymnbook.slug)
    else:
        form = HymnBookForm(instance=hymnbook)
    return render(
        request,
        "hymns/hymnbook_form.html",
        {
            "form": form,
            "title": f"Editar: {hymnbook.name}",
            "submit_label": "Salvar",
            "hymnbook": hymnbook,
        },
    )


@login_required
@require_POST
def hymnbook_editorial_update_view(request, slug):
    """Atualiza `priority` e `is_featured` do hinário. Staff-only.

    Endpoint do painel "Curadoria editorial" no `hymnbook_detail`.
    """
    if not request.user.is_staff:
        messages.error(request, "Apenas staff pode alterar a curadoria editorial.")
        return redirect("hymns:hymnbook_detail", slug=slug)

    hymnbook = get_object_or_404(HymnBook, slug=slug)
    form = HymnBookEditorialForm(request.POST, instance=hymnbook)
    if form.is_valid():
        form.save()
        messages.success(request, "Curadoria editorial atualizada.")
    else:
        messages.error(request, "Não foi possível salvar a curadoria editorial.")
    return redirect("hymns:hymnbook_detail", slug=hymnbook.slug)


@login_required
def hymnbook_delete_view(request, slug):
    """Deleta um HymnBook. GET mostra confirmação, POST executa."""
    hymnbook = get_object_or_404(HymnBook, slug=slug)
    if not can_edit_hymnbook(request.user, hymnbook):
        messages.error(request, "Você não tem permissão para deletar este hinário.")
        return redirect("hymns:hymnbook_detail", slug=slug)

    if request.method == "POST":
        name = hymnbook.name
        hymnbook.delete()
        messages.success(request, f"Hinário '{name}' deletado.")
        return redirect("hymns:hymnbook_list")

    return render(request, "hymns/hymnbook_confirm_delete.html", {"hymnbook": hymnbook})


@login_required
@require_POST
def hymnbook_publish_view(request, slug):
    """Publica um HymnBook. Permissão: dono, editor ou superuser. Pré-requisitos
    completos descritos por `publish_readiness` (Marco 2.0.5)."""
    from .services.review import publish_readiness

    hymnbook = get_object_or_404(HymnBook, slug=slug)
    if not can_publish_hymnbook(request.user, hymnbook):
        messages.error(request, "Você não tem permissão para publicar este hinário.")
        return redirect("hymns:hymnbook_detail", slug=slug)

    report = publish_readiness(hymnbook)
    if not report["can_publish"]:
        failed = [c["label"] for c in report["checks"] if not c["ok"]]
        messages.error(
            request,
            "Hinário não pode ser publicado. Pendências: " + "; ".join(failed),
        )
        return redirect("hymns:hymnbook_detail", slug=slug)

    hymnbook.is_published = True
    hymnbook.published_at = timezone.now()
    hymnbook.published_by = request.user
    hymnbook.save(update_fields=["is_published", "published_at", "published_by", "updated_at"])
    messages.success(request, f"Hinário '{hymnbook.name}' publicado.")
    return redirect("hymns:hymnbook_detail", slug=slug)


@login_required
def hymn_history_view(request, pk):
    """Drawer HTML com timeline de revisões (Marco 2.1.8)."""
    hymn = get_object_or_404(Hymn.objects.select_related("hymn_book"), pk=pk)
    if not can_edit_hymnbook(request.user, hymn.hymn_book):
        return redirect("hymns:hymn_detail", pk=pk)
    revisions = hymn.revisions.select_related("revised_by").order_by("-revised_at")
    return render(
        request,
        "hymns/_partials/_history_drawer.html",
        {"hymn": hymn, "revisions": revisions},
    )


@login_required
def hymnbook_publish_check_view(request, slug):
    """JSON com `publish_readiness` para o modal Publicar (Fase 2)."""
    from django.http import JsonResponse

    from .services.review import publish_readiness

    hymnbook = get_object_or_404(HymnBook, slug=slug)
    if not can_publish_hymnbook(request.user, hymnbook):
        return JsonResponse({"detail": "forbidden"}, status=403)
    return JsonResponse(publish_readiness(hymnbook))


@login_required
@require_POST
def hymnbook_unpublish_view(request, slug):
    """Despublica um HymnBook. Permissão: dono, editor ou superuser."""
    hymnbook = get_object_or_404(HymnBook, slug=slug)
    if not can_publish_hymnbook(request.user, hymnbook):
        messages.error(request, "Você não tem permissão para despublicar este hinário.")
        return redirect("hymns:hymnbook_detail", slug=slug)

    hymnbook.is_published = False
    hymnbook.save(update_fields=["is_published", "updated_at"])
    messages.success(request, f"Hinário '{hymnbook.name}' despublicado.")
    return redirect("hymns:hymnbook_detail", slug=slug)


@login_required
def hymn_create_view(request, slug):
    """Cria um Hymn dentro de um HymnBook."""
    hymnbook = get_object_or_404(HymnBook, slug=slug)
    if not can_edit_hymnbook(request.user, hymnbook):
        messages.error(request, "Você não tem permissão para adicionar hinos neste hinário.")
        return redirect("hymns:hymnbook_detail", slug=slug)

    if request.method == "POST":
        form = HymnForm(request.POST, hymn_book=hymnbook)
        if form.is_valid():
            hymn = form.save(commit=False)
            hymn.hymn_book = hymnbook
            hymn.save()
            messages.success(request, f"Hino #{hymn.number} criado.")
            return redirect("hymns:hymn_detail", pk=hymn.pk)
    else:
        # Sugerir próximo número como default
        last = hymnbook.hymns.order_by("-number").first()
        initial = {"number": (last.number + 1) if last else 1}
        form = HymnForm(initial=initial, hymn_book=hymnbook)
    return render(
        request,
        "hymns/hymn_form.html",
        {
            "form": form,
            "hymnbook": hymnbook,
            "title": f"Novo Hino em {hymnbook.name}",
            "submit_label": "Criar",
        },
    )


@login_required
def hymn_edit_view(request, pk):
    """Edita um Hymn. Permissão: dono do hinário ou superuser."""
    hymn = get_object_or_404(Hymn.objects.select_related("hymn_book"), pk=pk)
    if not can_edit_hymnbook(request.user, hymn.hymn_book):
        messages.error(request, "Você não tem permissão para editar este hino.")
        return redirect("hymns:hymn_detail", pk=pk)

    if request.method == "POST":
        form = HymnForm(request.POST, instance=hymn, hymn_book=hymn.hymn_book)
        if form.is_valid():
            form.save()
            messages.success(request, "Hino atualizado.")
            return redirect("hymns:hymn_detail", pk=hymn.pk)
    else:
        form = HymnForm(instance=hymn, hymn_book=hymn.hymn_book)
    return render(
        request,
        "hymns/hymn_form.html",
        {
            "form": form,
            "hymnbook": hymn.hymn_book,
            "hymn": hymn,
            "title": f"Editar Hino #{hymn.number}",
            "submit_label": "Salvar",
        },
    )


@login_required
@require_POST
def revise_hymn_view(request, pk):
    """
    Marco 1.3 — endpoint de revisão. Aceita POST com campos editáveis +
    `review_status` final + `change_summary` opcional. Atualiza
    `last_reviewed_at`/`last_reviewed_by`. Permissão: dono, editor, superuser.
    """
    hymn = get_object_or_404(Hymn.objects.select_related("hymn_book"), pk=pk)
    if not can_edit_hymnbook(request.user, hymn.hymn_book):
        messages.error(request, "Você não tem permissão para revisar este hino.")
        return redirect("hymns:hymn_detail", pk=pk)

    editable_fields = ("number", "title", "text", "repetitions", "extra_instructions", "style", "offered_to")
    for field in editable_fields:
        if field in request.POST:
            value = request.POST.get(field, "").strip()
            if field == "number":
                try:
                    setattr(hymn, field, int(value))
                except (TypeError, ValueError):
                    messages.error(request, "Número inválido.")
                    return redirect("hymns:hymn_detail", pk=pk)
            else:
                setattr(hymn, field, value)

    new_status = request.POST.get("review_status")
    if new_status in Hymn.ReviewStatus.values:
        hymn.review_status = new_status

    hymn.last_reviewed_by = request.user
    hymn.last_reviewed_at = timezone.now()
    hymn.save()

    summary = request.POST.get("change_summary", "").strip()
    if summary:
        last_revision = hymn.revisions.order_by("-revised_at").first()
        if last_revision and last_revision.change_summary == "":
            last_revision.change_summary = summary
            last_revision.save(update_fields=["change_summary"])

    messages.success(request, f"Hino #{hymn.number} revisado.")
    return redirect("hymns:hymn_detail", pk=hymn.pk)


@login_required
def hymn_delete_view(request, pk):
    """Deleta um Hymn. GET mostra confirmação, POST executa."""
    hymn = get_object_or_404(Hymn.objects.select_related("hymn_book"), pk=pk)
    if not can_edit_hymnbook(request.user, hymn.hymn_book):
        messages.error(request, "Você não tem permissão para deletar este hino.")
        return redirect("hymns:hymn_detail", pk=pk)

    if request.method == "POST":
        hymnbook_slug = hymn.hymn_book.slug
        number = hymn.number
        hymn.delete()
        messages.success(request, f"Hino #{number} deletado.")
        return redirect("hymns:hymnbook_detail", slug=hymnbook_slug)

    return render(request, "hymns/hymn_confirm_delete.html", {"hymn": hymn})
