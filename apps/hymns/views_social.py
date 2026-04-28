"""
Views para features sociais (favoritos, comentários, áudio).
"""

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from apps.users.models import Notification

from .forms import HymnAudioUploadForm
from .models import Favorite, Hymn, HymnAudio


@login_required
@require_POST
def toggle_favorite(request, hymn_id):
    """Toggle favorito em um hino (AJAX)."""
    hymn = get_object_or_404(Hymn, id=hymn_id)

    favorite, created = Favorite.objects.get_or_create(user=request.user, hymn=hymn)

    if not created:
        # Já existia, então remove
        favorite.delete()
        is_favorited = False
        message = "Removido dos favoritos"
    else:
        # Criou novo favorito
        is_favorited = True
        message = "Adicionado aos favoritos"

        # Criar notificação para o uploader do hinário (se não for o próprio usuário)
        if hymn.hymn_book.owner_user and hymn.hymn_book.owner_user != request.user:
            Notification.objects.create(
                recipient=hymn.hymn_book.owner_user,
                sender=request.user,
                notification_type=Notification.TYPE_FAVORITE,
                title="Novo favorito",
                message=f"{request.user.username} favoritou o hino {hymn.title}",
                link=f"/hinos/{hymn.id}/",
            )

    if request.headers.get("X-Requested-With") == "XMLHttpRequest":
        return JsonResponse({"is_favorited": is_favorited, "message": message})

    messages.success(request, message)
    return redirect("hymns:hymn_detail", pk=hymn.id)


@login_required
def upload_audio(request, hymn_id):
    """Upload de áudio para um hino."""
    hymn = get_object_or_404(Hymn, id=hymn_id)

    if request.method == "POST":
        form = HymnAudioUploadForm(request.POST, request.FILES)
        if form.is_valid():
            audio = form.save(commit=False)
            audio.hymn = hymn
            audio.uploaded_by = request.user

            # Detectar formato do arquivo
            if audio.audio_file.name.lower().endswith(".mp3"):
                audio.format = "MP3"
            elif audio.audio_file.name.lower().endswith(".ogg"):
                audio.format = "OGG"
            elif audio.audio_file.name.lower().endswith(".flac"):
                audio.format = "FLAC"

            # Armazenar tamanho do arquivo
            audio.file_size = audio.audio_file.size

            audio.save()

            messages.success(request, "Áudio enviado com sucesso! Aguarde aprovação.")

            return redirect("hymns:hymn_detail", pk=hymn.id)
    else:
        form = HymnAudioUploadForm()

    return render(request, "hymns/upload_audio.html", {"form": form, "hymn": hymn})


@login_required
def download_audio(request, audio_id):
    """Download de áudio (se permitido)."""
    from django.http import FileResponse

    audio = get_object_or_404(HymnAudio, id=audio_id, is_approved=True)

    if not audio.allow_download:
        messages.error(request, "Download não permitido para este áudio.")
        return redirect("hymns:hymn_detail", pk=audio.hymn.id)

    response = FileResponse(audio.audio_file.open("rb"), as_attachment=True)
    return response
