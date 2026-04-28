from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.postgres.search import SearchQuery, SearchRank, TrigramSimilarity
from django.db.models import F, Func, Q, Value
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.http import require_POST
from django.views.generic import DetailView, ListView

from .forms import HymnBookForm, HymnForm
from .models import Hymn, HymnBook
from .permissions import can_edit_hymnbook, can_publish_hymnbook


class UnaccentFunc(Func):
    """Invoca a função SQL `unaccent(text)` da extension unaccent."""

    function = "unaccent"


class HymnBookListView(ListView):
    """List all hymn books."""

    model = HymnBook
    template_name = "hymns/hymnbook_list.html"
    context_object_name = "hymnbooks"
    paginate_by = 20

    def get_queryset(self):
        return HymnBook.objects.visible_to(self.request.user).order_by("name")


class HymnBookDetailView(DetailView):
    """Display a single hymn book with all its hymns."""

    model = HymnBook
    template_name = "hymns/hymnbook_detail.html"
    context_object_name = "hymnbook"
    slug_field = "slug"
    slug_url_kwarg = "slug"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["hymns"] = self.object.hymns.all().order_by("number")
        context["can_edit"] = can_edit_hymnbook(self.request.user, self.object)
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

        return context


def search_view(request):
    """
    Busca hinos usando PostgreSQL full-text search + trigram (typo tolerance).

    - `search_vector` (tsvector, GIN-indexed) dá stemming PT e ranking por campo.
    - `TrigramSimilarity` em `title` cobre typos que o FTS não pega.
    - `websearch` aceita sintaxe tipo Google: "virgem maria", daime OR santo, -maria.
    """
    query = request.GET.get("q", "").strip()
    results = []
    total = 0

    if query:
        tsquery = SearchQuery(query, config="portuguese", search_type="websearch")
        visible_books = HymnBook.objects.visible_to(request.user)
        qs = (
            Hymn.objects.annotate(
                rank=SearchRank(F("search_vector"), tsquery),
                title_sim=TrigramSimilarity(UnaccentFunc("title"), UnaccentFunc(Value(query))),
            )
            .filter(hymn_book__in=visible_books)
            .filter(Q(search_vector=tsquery) | Q(title_sim__gt=0.3))
            .select_related("hymn_book")
            .order_by("-rank", "-title_sim")
        )
        results = list(qs[:50])
        total = len(results)

    context = {
        "query": query,
        "results": results,
        "total": total,
    }
    return render(request, "hymns/search.html", context)


def home_view(request):
    """Home page with featured hymn books and search."""
    recent_hymnbooks = HymnBook.objects.visible_to(request.user).order_by("-created_at")[:6]
    total_hymnbooks = HymnBook.objects.published().count()
    total_hymns = Hymn.objects.filter(hymn_book__is_published=True).count()

    context = {
        "recent_hymnbooks": recent_hymnbooks,
        "total_hymnbooks": total_hymnbooks,
        "total_hymns": total_hymns,
    }
    return render(request, "hymns/home.html", context)


@login_required
def hymnbook_create_view(request):
    """Cria um HymnBook via web (sem YAML)."""
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
    """Publica um HymnBook. Permissão: dono, editor ou superuser. Pré-requisito:
    todos os hinos devem estar REVIEWED."""
    hymnbook = get_object_or_404(HymnBook, slug=slug)
    if not can_publish_hymnbook(request.user, hymnbook):
        messages.error(request, "Você não tem permissão para publicar este hinário.")
        return redirect("hymns:hymnbook_detail", slug=slug)

    if not hymnbook.is_fully_reviewed:
        messages.error(
            request,
            "Hinário não pode ser publicado: todos os hinos precisam estar revisados.",
        )
        return redirect("hymns:hymnbook_detail", slug=slug)

    hymnbook.is_published = True
    hymnbook.published_at = timezone.now()
    hymnbook.published_by = request.user
    hymnbook.save(update_fields=["is_published", "published_at", "published_by", "updated_at"])
    messages.success(request, f"Hinário '{hymnbook.name}' publicado.")
    return redirect("hymns:hymnbook_detail", slug=slug)


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
