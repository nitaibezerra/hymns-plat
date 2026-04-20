from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render
from django.views.generic import DetailView, ListView

from apps.search.typesense_client import search_hymns

from .forms import HymnBookForm, HymnForm
from .models import Hymn, HymnBook


def _can_edit_hymnbook(user, hymnbook):
    """True se user pode editar/deletar o hymnbook (dono ou superuser)."""
    if not user.is_authenticated:
        return False
    return user.is_superuser or user == hymnbook.owner_user


class HymnBookListView(ListView):
    """List all hymn books."""

    model = HymnBook
    template_name = "hymns/hymnbook_list.html"
    context_object_name = "hymnbooks"
    paginate_by = 20

    def get_queryset(self):
        return HymnBook.objects.all().order_by("name")


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
        context["can_edit"] = _can_edit_hymnbook(self.request.user, self.object)
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

        # Get approved comments
        context["comments"] = hymn.comments.filter(is_approved=True, is_flagged=False).order_by("created_at")

        # Permissão de edição
        context["can_edit"] = _can_edit_hymnbook(self.request.user, hymn.hymn_book)

        return context


def search_view(request):
    """Search hymns using TypeSense."""
    query = request.GET.get("q", "").strip()
    results = []
    total = 0

    if query:
        try:
            # Search in TypeSense
            ts_results = search_hymns(query, per_page=50)
            total = ts_results.get("found", 0)

            # Get hymn IDs from results
            hymn_ids = [hit["document"]["id"] for hit in ts_results.get("hits", [])]

            # Fetch actual hymns from database
            if hymn_ids:
                hymns = Hymn.objects.filter(id__in=hymn_ids).select_related("hymn_book")
                # Preserve TypeSense order
                hymns_dict = {str(h.id): h for h in hymns}
                results = [hymns_dict[hid] for hid in hymn_ids if hid in hymns_dict]
        except Exception:
            # Fallback to database search if TypeSense fails
            results = (
                Hymn.objects.filter(title__icontains=query)
                | Hymn.objects.filter(text__icontains=query)
                | Hymn.objects.filter(hymn_book__name__icontains=query)
            ).select_related("hymn_book")[:50]
            total = results.count()

    context = {
        "query": query,
        "results": results,
        "total": total,
    }
    return render(request, "hymns/search.html", context)


def home_view(request):
    """Home page with featured hymn books and search."""
    recent_hymnbooks = HymnBook.objects.all().order_by("-created_at")[:6]
    total_hymnbooks = HymnBook.objects.count()
    total_hymns = Hymn.objects.count()

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
    if not _can_edit_hymnbook(request.user, hymnbook):
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
    if not _can_edit_hymnbook(request.user, hymnbook):
        messages.error(request, "Você não tem permissão para deletar este hinário.")
        return redirect("hymns:hymnbook_detail", slug=slug)

    if request.method == "POST":
        name = hymnbook.name
        hymnbook.delete()
        messages.success(request, f"Hinário '{name}' deletado.")
        return redirect("hymns:hymnbook_list")

    return render(request, "hymns/hymnbook_confirm_delete.html", {"hymnbook": hymnbook})


@login_required
def hymn_create_view(request, slug):
    """Cria um Hymn dentro de um HymnBook."""
    hymnbook = get_object_or_404(HymnBook, slug=slug)
    if not _can_edit_hymnbook(request.user, hymnbook):
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
    if not _can_edit_hymnbook(request.user, hymn.hymn_book):
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
def hymn_delete_view(request, pk):
    """Deleta um Hymn. GET mostra confirmação, POST executa."""
    hymn = get_object_or_404(Hymn.objects.select_related("hymn_book"), pk=pk)
    if not _can_edit_hymnbook(request.user, hymn.hymn_book):
        messages.error(request, "Você não tem permissão para deletar este hino.")
        return redirect("hymns:hymn_detail", pk=pk)

    if request.method == "POST":
        hymnbook_slug = hymn.hymn_book.slug
        number = hymn.number
        hymn.delete()
        messages.success(request, f"Hino #{number} deletado.")
        return redirect("hymns:hymnbook_detail", slug=hymnbook_slug)

    return render(request, "hymns/hymn_confirm_delete.html", {"hymn": hymn})
