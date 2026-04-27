"""
Views for the users app.
"""

from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse

from apps.hymns.models import HymnBook

from .forms import ProfileEditForm
from .models import User


def profile_view(request, username):
    """
    Display user public profile with their uploaded hymnbooks.
    """
    from apps.hymns.models import Favorite
    from apps.users.models import UserFollow

    profile_user = get_object_or_404(User, username=username)

    # Get hymnbooks owned by this user
    hymnbooks = HymnBook.objects.filter(owner_user=profile_user).order_by("-created_at")

    # Social counts
    followers_count = UserFollow.objects.filter(followed=profile_user).count()
    following_count = UserFollow.objects.filter(follower=profile_user).count()

    # Check if current user follows this profile
    is_following = False
    if request.user.is_authenticated and request.user != profile_user:
        is_following = UserFollow.objects.filter(follower=request.user, followed=profile_user).exists()

    # Get favorites if own profile
    favorites = []
    if request.user.is_authenticated and request.user == profile_user:
        favorites = (
            Favorite.objects.filter(user=profile_user)
            .select_related("hymn", "hymn__hymn_book")
            .order_by("-created_at")[:10]
        )

    context = {
        "profile_user": profile_user,
        "hymnbooks": hymnbooks,
        "is_own_profile": request.user.is_authenticated and request.user == profile_user,
        "followers_count": followers_count,
        "following_count": following_count,
        "is_following": is_following,
        "favorites": favorites,
    }

    return render(request, "users/profile.html", context)


@login_required
def profile_edit_view(request, username):
    """
    Edit user profile (bio, avatar).
    Only the profile owner can edit.
    """
    profile_user = get_object_or_404(User, username=username)

    # Only allow editing own profile
    if request.user != profile_user:
        return redirect("users:profile", username=username)

    if request.method == "POST":
        form = ProfileEditForm(request.POST, request.FILES, instance=profile_user)
        if form.is_valid():
            form.save()
            return redirect("users:profile", username=username)
    else:
        form = ProfileEditForm(instance=profile_user)

    context = {
        "form": form,
        "profile_user": profile_user,
    }

    return render(request, "users/profile_edit.html", context)


@login_required
def upload_view(request):
    """
    Upload hymnbook with YAML file.
    Step 1: Upload and detect duplicates.
    """
    import tempfile

    import yaml

    from apps.hymns.disambiguation import find_duplicates_with_content
    from apps.hymns.forms import HymnBookUploadForm

    if request.method == "POST":
        form = HymnBookUploadForm(request.POST, request.FILES)
        if form.is_valid():
            pdf_file = form.cleaned_data.get("pdf_file")
            yaml_file = form.cleaned_data.get("yaml_file")

            # PDF branch: kick off OCR task and redirect to processing page
            if pdf_file:
                return _start_pdf_ocr(request, form, pdf_file)

            # YAML branch (original): save tempfile, parse, detect duplicates
            with tempfile.NamedTemporaryFile(delete=False, suffix=".yaml") as tmp_file:
                for chunk in yaml_file.chunks():
                    tmp_file.write(chunk)
                tmp_path = tmp_file.name

            try:
                # Parse YAML para extrair dados
                with open(tmp_path, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f)

                # Aceita ambos formatos: com "hymn_book" como raiz ou campos diretos na raiz
                hymn_book_data = data.get("hymn_book") if "hymn_book" in data else data
                name = hymn_book_data.get("name") if hymn_book_data else None
                hymns_data = hymn_book_data.get("hymns", []) if hymn_book_data else []

                # Validação: nome é obrigatório
                if not name:
                    form.add_error("yaml_file", "O arquivo YAML deve conter o campo 'name' com o nome do hinário.")
                    return render(request, "users/upload.html", {"form": form})

                # Converte dados de hinos para formato esperado
                hymns_list = [
                    {
                        "number": h.get("number"),
                        "title": h.get("title", ""),
                        "text": h.get("text", ""),
                    }
                    for h in hymns_data
                ]

                # Detecta duplicatas
                duplicates = find_duplicates_with_content(
                    name=name,
                    hymns=hymns_list,
                    name_threshold=0.7,
                    content_threshold=0.8,
                )

                # Armazena dados na sessão para próxima etapa
                request.session["upload_data"] = {
                    "yaml_content": str(data),  # Serializa para JSON
                    "yaml_filename": yaml_file.name,
                    "name": name,
                    "hymns_count": len(hymns_data),
                }

                # Se encontrou match exato ou alta confiança, mostra página de desambiguação
                if duplicates["exact_match"] or duplicates["high_confidence"]:
                    request.session["duplicates"] = {
                        "exact_match": str(duplicates["exact_match"].id) if duplicates["exact_match"] else None,
                        "high_confidence": [
                            (str(hb.id), name_score, content_score)
                            for hb, name_score, content_score in duplicates["high_confidence"]
                        ],
                    }

                    return redirect("users:upload_disambiguate")

                # Se não há duplicatas, prossegue com preview
                return redirect("users:upload_preview")

            except Exception as e:
                form.add_error("yaml_file", f"Erro ao processar YAML: {str(e)}")
    else:
        form = HymnBookUploadForm()

    context = {
        "form": form,
        "title": "Contribuir com Hinário",
    }

    return render(request, "users/upload.html", context)


@login_required
def upload_disambiguate_view(request):
    """
    Step 2: Show similar hymnbooks and let user choose action.
    """
    from apps.hymns.forms import DisambiguationChoiceForm

    # Recupera dados da sessão
    upload_data = request.session.get("upload_data")
    duplicates_data = request.session.get("duplicates")

    if not upload_data or not duplicates_data:
        return redirect("users:upload")

    # Busca hinários similares no banco
    exact_match_id = duplicates_data.get("exact_match")
    high_confidence = duplicates_data.get("high_confidence", [])

    exact_match = None
    similar_hymnbooks = []

    if exact_match_id:
        exact_match = HymnBook.objects.get(id=exact_match_id)

    for hymnbook_id, name_score, content_score in high_confidence:
        hb = HymnBook.objects.get(id=hymnbook_id)
        similar_hymnbooks.append(
            {
                "hymnbook": hb,
                "name_score": int(name_score * 100),
                "content_score": int(content_score * 100),
            }
        )

    if request.method == "POST":
        form = DisambiguationChoiceForm(request.POST)
        if form.is_valid():
            choice = form.cleaned_data["choice"]

            if choice == DisambiguationChoiceForm.CHOICE_CANCEL:
                # Limpa sessão e volta
                request.session.pop("upload_data", None)
                request.session.pop("duplicates", None)
                return redirect("users:upload")

            elif choice == DisambiguationChoiceForm.CHOICE_CREATE_NEW:
                # Prossegue com criação de novo hinário
                return redirect("users:upload_preview")

            elif choice == DisambiguationChoiceForm.CHOICE_ADD_VERSION:
                # Adiciona como versão
                selected_id = form.cleaned_data["selected_hymnbook"]
                version_name = form.cleaned_data["version_name"]

                request.session["version_info"] = {
                    "hymnbook_id": str(selected_id),
                    "version_name": version_name,
                }

                return redirect("users:upload_confirm")
    else:
        form = DisambiguationChoiceForm()

    context = {
        "form": form,
        "exact_match": exact_match,
        "similar_hymnbooks": similar_hymnbooks,
        "upload_data": upload_data,
    }

    return render(request, "users/upload_disambiguate.html", context)


@login_required
def upload_preview_view(request):
    """
    Step 3: Preview hymnbook data before creating.
    """
    import ast

    from django.db import transaction

    from apps.hymns.models import Hymn, HymnBook

    upload_data = request.session.get("upload_data")

    if not upload_data:
        return redirect("users:upload")

    # Parse YAML content de volta
    yaml_content = ast.literal_eval(upload_data["yaml_content"])
    hymn_book_data = yaml_content.get("hymn_book", {})

    if request.method == "POST":
        # Usuário confirmou criação
        try:
            with transaction.atomic():
                # Cria hinário
                hymnbook = HymnBook.objects.create(
                    name=hymn_book_data.get("name"),
                    intro_name=hymn_book_data.get("intro_name", ""),
                    owner_name=hymn_book_data.get("owner", ""),
                    owner_user=request.user,
                    description=hymn_book_data.get("description", ""),
                )

                # Cria hinos (signals em apps.hymns.signals cuidam da indexação)
                hymns_data = hymn_book_data.get("hymns", [])
                for hymn_data in hymns_data:
                    Hymn.objects.create(
                        hymn_book=hymnbook,
                        number=hymn_data.get("number"),
                        title=hymn_data.get("title", ""),
                        text=hymn_data.get("text", ""),
                        received_at=hymn_data.get("received_at"),
                        offered_to=hymn_data.get("offered_to", ""),
                        style=hymn_data.get("style", ""),
                        extra_instructions=hymn_data.get("extra_instructions", ""),
                        repetitions=hymn_data.get("repetitions", ""),
                    )

            # Limpa sessão
            request.session.pop("upload_data", None)
            request.session.pop("duplicates", None)

            # Redireciona para hinário criado
            return redirect("hymns:hymnbook_detail", slug=hymnbook.slug)

        except Exception as e:
            context = {
                "upload_data": upload_data,
                "hymn_book_data": hymn_book_data,
                "error": f"Erro ao criar hinário: {str(e)}",
            }
            return render(request, "users/upload_preview.html", context)

    context = {
        "upload_data": upload_data,
        "hymn_book_data": hymn_book_data,
        "hymns_preview": hymn_book_data.get("hymns", [])[:5],  # Mostra primeiros 5
    }

    return render(request, "users/upload_preview.html", context)


@login_required
def upload_confirm_view(request):
    """
    Step 3b: Confirm adding as version.
    """
    import tempfile

    import yaml

    from apps.hymns.models import HymnBook, HymnBookVersion

    upload_data = request.session.get("upload_data")
    version_info = request.session.get("version_info")

    if not upload_data or not version_info:
        return redirect("users:upload")

    hymnbook = HymnBook.objects.get(id=version_info["hymnbook_id"])

    if request.method == "POST":
        # Usuário confirmou criação de versão
        try:
            # Salva YAML content em arquivo temporário
            yaml_content = upload_data["yaml_content"]

            with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".yaml", encoding="utf-8") as tmp_file:
                # Reconstrói YAML de string
                import ast

                data = ast.literal_eval(yaml_content)
                yaml.dump(data, tmp_file, allow_unicode=True)
                tmp_path = tmp_file.name

            # Cria versão
            from django.core.files import File

            with open(tmp_path, "rb") as f:
                version = HymnBookVersion.objects.create(
                    hymn_book=hymnbook,
                    version_name=version_info["version_name"],
                    description=f"Enviado por {request.user.get_full_name() or request.user.username}",
                    uploaded_by=request.user,
                    is_primary=False,  # Não marca como primária automaticamente
                )
                version.yaml_file.save(upload_data["yaml_filename"], File(f))

            # Limpa sessão
            request.session.pop("upload_data", None)
            request.session.pop("duplicates", None)
            request.session.pop("version_info", None)

            # Redireciona para hinário
            return redirect("hymns:hymnbook_detail", slug=hymnbook.slug)

        except Exception as e:
            context = {
                "upload_data": upload_data,
                "version_info": version_info,
                "hymnbook": hymnbook,
                "error": f"Erro ao criar versão: {str(e)}",
            }
            return render(request, "users/upload_confirm.html", context)

    context = {
        "upload_data": upload_data,
        "version_info": version_info,
        "hymnbook": hymnbook,
    }

    return render(request, "users/upload_confirm.html", context)


def _start_pdf_ocr(request, form, pdf_file):
    """
    PDF branch of upload: save PDF to a temp file, create OCRTask,
    spawn worker thread, redirect to processing page.
    """
    import tempfile

    from apps.hymns.models import OCRTask
    from apps.hymns.services.ocr import launch_ocr_task

    pdf_name = form.cleaned_data["pdf_name"]
    pdf_owner_name = form.cleaned_data["pdf_owner_name"]

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_pdf:
        for chunk in pdf_file.chunks():
            tmp_pdf.write(chunk)
        pdf_path = tmp_pdf.name

    task = OCRTask.objects.create(user=request.user, pdf_filename=pdf_file.name)
    launch_ocr_task(task.id, pdf_path, pdf_name, pdf_owner_name)
    return redirect(f"{reverse('users:upload_processing')}?task={task.id}")


def _ocr_task_for_user(request, task_id):
    """Look up OCRTask, returning 404/403 as appropriate."""
    from django.http import Http404, HttpResponseForbidden

    from apps.hymns.models import OCRTask

    try:
        task = OCRTask.objects.get(pk=task_id)
    except (OCRTask.DoesNotExist, ValueError) as e:
        raise Http404("Tarefa OCR não encontrada.") from e
    if task.user_id != request.user.id:
        return None, HttpResponseForbidden("Você não tem acesso a essa tarefa.")
    return task, None


@login_required
def upload_processing_view(request):
    """
    Page that polls OCR progress. When task is COMPLETED, populates session
    like the YAML flow and redirects to disambiguate or preview. When FAILED,
    renders the error.
    """
    from apps.hymns.disambiguation import find_duplicates_with_content

    task_id = request.GET.get("task")
    if not task_id:
        return redirect("users:upload")

    task, forbidden = _ocr_task_for_user(request, task_id)
    if forbidden:
        return forbidden

    if task.status == task.STATUS_COMPLETED and task.result_data:
        data = task.result_data
        hymn_book_data = data.get("hymn_book", {})
        name = hymn_book_data.get("name") or ""
        hymns_data = hymn_book_data.get("hymns", [])
        hymns_list = [
            {"number": h.get("number"), "title": h.get("title", ""), "text": h.get("text", "")} for h in hymns_data
        ]
        duplicates = find_duplicates_with_content(
            name=name, hymns=hymns_list, name_threshold=0.7, content_threshold=0.8
        )
        request.session["upload_data"] = {
            "yaml_content": str(data),
            "yaml_filename": task.pdf_filename or "uploaded.pdf",
            "name": name,
            "hymns_count": len(hymns_data),
            "source": "pdf",
        }
        if duplicates["exact_match"] or duplicates["high_confidence"]:
            request.session["duplicates"] = {
                "exact_match": str(duplicates["exact_match"].id) if duplicates["exact_match"] else None,
                "high_confidence": [
                    (str(hb.id), name_score, content_score)
                    for hb, name_score, content_score in duplicates["high_confidence"]
                ],
            }
            return redirect("users:upload_disambiguate")
        return redirect("users:upload_preview")

    context = {"task": task}
    return render(request, "users/upload_processing.html", context)


@login_required
def upload_ocr_status_view(request, task_id):
    """JSON endpoint polled by the processing page."""
    from django.http import JsonResponse

    task, forbidden = _ocr_task_for_user(request, task_id)
    if forbidden:
        return forbidden

    return JsonResponse(
        {
            "status": task.status,
            "current": task.current_page,
            "total": task.total_pages,
            "percent": task.progress_pct,
            "ready": task.is_done,
            "error": task.error_message if task.status == task.STATUS_FAILED else "",
        }
    )
