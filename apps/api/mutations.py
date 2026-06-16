"""
Mutations GraphQL — Marco 2.

Decisões de design:
- `login` retorna union (`LoginSuccess` | `LoginError`) em vez de levantar erro,
  porque "credenciais inválidas" é resultado normal de tentativa, não exceção.
  Exceções do GraphQL ficam reservadas para erros de programa (gateway down,
  permissão negada, etc.).
- Mutations que mexem em hinos/hinários gateiam por
  `apps.hymns.permissions` (mesma regra usada pelas views) — sem duplicação.
"""

from __future__ import annotations

from typing import Annotated, Union

import strawberry
from django.contrib.auth import authenticate
from django.contrib.auth import login as django_login
from django.contrib.auth import logout as django_logout
from django.utils import timezone
from strawberry.file_uploads import Upload
from strawberry.types import Info

from apps.hymns import models as hymn_models
from apps.hymns.forms import HymnAudioUploadForm, HymnBookForm, HymnForm, QuickReviewForm
from apps.hymns.permissions import _is_editor_or_admin, can_create_hymnbook, can_edit_hymnbook, can_publish_hymnbook
from apps.hymns.services.review import publish_readiness
from apps.users import models as user_models

from .errors import NotFoundError, PermissionDeniedError, ValidationError
from .types import (
    AudioReviewInput,
    DeleteResult,
    HymnAudioType,
    HymnBookInput,
    HymnBookType,
    HymnInput,
    HymnType,
    NotificationType,
    PublishResult,
    ReviewStatus,
    UserProfileType,
    UserType,
)


@strawberry.input
class HymnUpdateInput:
    title: str | None = strawberry.UNSET
    text: str | None = strawberry.UNSET
    number: int | None = strawberry.UNSET
    section: str | None = strawberry.UNSET
    style: str | None = strawberry.UNSET
    repetitions: str | None = strawberry.UNSET
    extra_instructions: str | None = strawberry.UNSET
    offered_to: str | None = strawberry.UNSET


def _request(info: Info):
    """Obtém o `HttpRequest` do contexto Strawberry."""
    return info.context["request"] if isinstance(info.context, dict) else info.context.request


def _hymn_form_data(input: HymnInput, instance=None) -> dict:
    """Mapeia `HymnInput` → dict que `HymnForm` aceita.

    Replica a regra de UNSET do `_hymnbook_form_data`: campos não enviados caem
    para o valor da instance (update) ou string/None vazio (create).
    """

    def _val(field: str, raw):
        if raw is strawberry.UNSET:
            if instance is not None:
                return getattr(instance, field, "")
            return ""
        return raw

    return {
        "number": input.number,
        "title": input.title,
        "text": input.text,
        "received_at": None if instance is None else instance.received_at,
        "style": _val("style", input.style),
        "repetitions": _val("repetitions", input.repetitions),
        "extra_instructions": _val("extra_instructions", input.extra_instructions),
        "offered_to": _val("offered_to", input.offered_to),
        "section": _val("section", input.section),
    }


def _hymnbook_form_data(input: HymnBookInput, instance=None) -> dict:
    """Mapeia `HymnBookInput` → dict que `HymnBookForm` aceita.

    Campos não enviados (`strawberry.UNSET`) caem para o valor atual da instance
    (em update) ou para string vazia (em create), evitando que o form valide
    contra UNSET. Campos opcionais (`intro_name`, `description`) seguem essa
    regra; `name` e `owner_name` são obrigatórios pelo schema.
    """

    def _val(field: str, raw):
        if raw is strawberry.UNSET:
            if instance is not None:
                return getattr(instance, field, "")
            return ""
        return raw

    return {
        "name": _val("name", input.name),
        "owner_name": _val("owner_name", input.owner_name),
        "intro_name": _val("intro_name", input.intro_name),
        "description": _val("description", input.description),
    }


@strawberry.type
class LoginSuccess:
    user: UserType


@strawberry.type
class LoginError:
    message: str


@strawberry.type
class ToggleFavoriteSuccess:
    favorited: bool


LoginResult = Annotated[Union[LoginSuccess, LoginError], strawberry.union("LoginResult")]


@strawberry.type
class Mutation:
    @strawberry.mutation
    def login(self, info: Info, username: str, password: str) -> LoginResult:
        request = _request(info)
        user = authenticate(request, username=username, password=password)
        if user is None:
            return LoginError(message="Credenciais inválidas.")
        django_login(request, user)
        return LoginSuccess(user=user)

    @strawberry.mutation
    def logout(self, info: Info) -> bool:
        django_logout(_request(info))
        return True

    @strawberry.mutation
    def set_review_status(self, info: Info, pk: strawberry.ID, status: ReviewStatus) -> Annotated[
        Union[HymnType, PermissionDeniedError, NotFoundError],
        strawberry.union("SetReviewStatusResult"),
    ]:
        user = _request(info).user
        if not _is_editor_or_admin(user):
            return PermissionDeniedError()

        hymn = hymn_models.Hymn.objects.filter(pk=pk).first()
        if hymn is None:
            return NotFoundError()

        hymn.review_status = status.value if hasattr(status, "value") else status
        hymn.last_reviewed_by = user
        hymn.save()
        return hymn

    @strawberry.mutation
    def update_hymn(self, info: Info, pk: strawberry.ID, input: HymnUpdateInput) -> Annotated[
        Union[HymnType, PermissionDeniedError, NotFoundError, ValidationError],
        strawberry.union("UpdateHymnResult"),
    ]:
        user = _request(info).user
        if not _is_editor_or_admin(user):
            return PermissionDeniedError()

        hymn = hymn_models.Hymn.objects.filter(pk=pk).first()
        if hymn is None:
            return NotFoundError()

        # Coleta só os campos que vieram (UNSET = não tocar)
        data = {}
        for fname in HymnForm.Meta.fields:
            value = getattr(input, fname, strawberry.UNSET)
            if value is strawberry.UNSET:
                data[fname] = getattr(hymn, fname)
            else:
                data[fname] = value

        form = HymnForm(data=data, instance=hymn, hymn_book=hymn.hymn_book)
        if not form.is_valid():
            # Reporta o primeiro erro (cliente pode pedir mais via outra mutation)
            field, errors = next(iter(form.errors.items()))
            return ValidationError(message=errors[0], field=field)

        form.save()
        return hymn

    @strawberry.mutation(name="createHymnBook")
    def create_hymnbook(self, info: Info, input: HymnBookInput) -> Annotated[
        Union[HymnBookType, PermissionDeniedError, ValidationError],
        strawberry.union("CreateHymnBookResult"),
    ]:
        """Cria um HymnBook reusando `HymnBookForm` (paridade com `hymnbook_create_view`)."""
        user = _request(info).user
        if not can_create_hymnbook(user):
            return PermissionDeniedError()

        data = _hymnbook_form_data(input)
        form = HymnBookForm(data=data)
        if not form.is_valid():
            field, errors = next(iter(form.errors.items()))
            return ValidationError(message=errors[0], field=field)

        hymnbook = form.save(commit=False)
        hymnbook.owner_user = user
        hymnbook.save()
        return hymnbook

    @strawberry.mutation(name="updateHymnBook")
    def update_hymnbook(self, info: Info, slug: str, input: HymnBookInput) -> Annotated[
        Union[HymnBookType, PermissionDeniedError, NotFoundError, ValidationError],
        strawberry.union("UpdateHymnBookResult"),
    ]:
        """Atualiza um HymnBook reusando `HymnBookForm` (paridade com `hymnbook_edit_view`)."""
        user = _request(info).user
        hymnbook = hymn_models.HymnBook.objects.filter(slug=slug).first()
        if hymnbook is None:
            return NotFoundError()
        if not can_edit_hymnbook(user, hymnbook):
            return PermissionDeniedError()

        data = _hymnbook_form_data(input, instance=hymnbook)
        form = HymnBookForm(data=data, instance=hymnbook)
        if not form.is_valid():
            field, errors = next(iter(form.errors.items()))
            return ValidationError(message=errors[0], field=field)
        form.save()
        return hymnbook

    @strawberry.mutation(name="publishHymnBook")
    def publish_hymnbook(self, info: Info, slug: str) -> Annotated[
        Union[PublishResult, PermissionDeniedError, NotFoundError],
        strawberry.union("PublishHymnBookResult"),
    ]:
        """Publica um HymnBook após validar `publish_readiness`. Retorna
        `PublishResult` com `failedChecks` quando algum critério falha."""
        user = _request(info).user
        hymnbook = hymn_models.HymnBook.objects.filter(slug=slug).first()
        if hymnbook is None:
            return NotFoundError()
        if not can_publish_hymnbook(user, hymnbook):
            return PermissionDeniedError()

        report = publish_readiness(hymnbook)
        if not report["can_publish"]:
            failed = [c["label"] for c in report["checks"] if not c["ok"]]
            return PublishResult(ok=False, failed_checks=failed)

        hymnbook.is_published = True
        hymnbook.published_at = timezone.now()
        hymnbook.published_by = user
        hymnbook.save(update_fields=["is_published", "published_at", "published_by", "updated_at"])
        return PublishResult(ok=True, failed_checks=[])

    @strawberry.mutation(name="unpublishHymnBook")
    def unpublish_hymnbook(self, info: Info, slug: str) -> Annotated[
        Union[HymnBookType, PermissionDeniedError, NotFoundError],
        strawberry.union("UnpublishHymnBookResult"),
    ]:
        """Despublica um HymnBook (paridade com `hymnbook_unpublish_view`)."""
        user = _request(info).user
        hymnbook = hymn_models.HymnBook.objects.filter(slug=slug).first()
        if hymnbook is None:
            return NotFoundError()
        if not can_publish_hymnbook(user, hymnbook):
            return PermissionDeniedError()

        hymnbook.is_published = False
        hymnbook.save(update_fields=["is_published", "updated_at"])
        return hymnbook

    @strawberry.mutation(name="deleteHymnBook")
    def delete_hymnbook(self, info: Info, slug: str) -> Annotated[
        Union[DeleteResult, PermissionDeniedError, NotFoundError],
        strawberry.union("DeleteHymnBookResult"),
    ]:
        """Deleta um HymnBook em cascata (paridade com `hymnbook_delete_view`)."""
        user = _request(info).user
        hymnbook = hymn_models.HymnBook.objects.filter(slug=slug).first()
        if hymnbook is None:
            return NotFoundError()
        if not can_edit_hymnbook(user, hymnbook):
            return PermissionDeniedError()

        pk = str(hymnbook.pk)
        hymnbook.delete()
        return DeleteResult(ok=True, deleted_id=pk)

    @strawberry.mutation(name="updateHymnBookEditorial")
    def update_hymnbook_editorial(
        self,
        info: Info,
        slug: str,
        priority: str | None = strawberry.UNSET,
        is_featured: bool | None = strawberry.UNSET,
    ) -> Annotated[
        Union[HymnBookType, PermissionDeniedError, NotFoundError],
        strawberry.union("UpdateHymnBookEditorialResult"),
    ]:
        """Curadoria editorial (prioridade da fila + flag "em destaque"). Restrito
        a `is_staff` — editor comum pode editar conteúdo do hinário, mas
        curadoria global é decisão da equipe editorial."""
        user = _request(info).user
        if not getattr(user, "is_authenticated", False) or not user.is_staff:
            return PermissionDeniedError()

        hymnbook = hymn_models.HymnBook.objects.filter(slug=slug).first()
        if hymnbook is None:
            return NotFoundError()

        update_fields: list[str] = []
        if priority is not strawberry.UNSET and priority is not None:
            if priority in hymn_models.HymnBook.Priority.values:
                hymnbook.priority = priority
                update_fields.append("priority")
        if is_featured is not strawberry.UNSET and is_featured is not None:
            hymnbook.is_featured = bool(is_featured)
            update_fields.append("is_featured")
        if update_fields:
            update_fields.append("updated_at")
            hymnbook.save(update_fields=update_fields)
        return hymnbook

    @strawberry.mutation(name="createHymn")
    def create_hymn(self, info: Info, hymnbook_slug: str, input: HymnInput) -> Annotated[
        Union[HymnType, PermissionDeniedError, NotFoundError, ValidationError],
        strawberry.union("CreateHymnResult"),
    ]:
        """Cria um Hymn dentro de um HymnBook (paridade com `hymn_create_view`)."""
        user = _request(info).user
        hymnbook = hymn_models.HymnBook.objects.filter(slug=hymnbook_slug).first()
        if hymnbook is None:
            return NotFoundError()
        if not can_edit_hymnbook(user, hymnbook):
            return PermissionDeniedError()

        data = _hymn_form_data(input)
        form = HymnForm(data=data, hymn_book=hymnbook)
        if not form.is_valid():
            field, errors = next(iter(form.errors.items()))
            return ValidationError(message=errors[0], field=field)
        hymn = form.save(commit=False)
        hymn.hymn_book = hymnbook
        hymn.save()
        return hymn

    @strawberry.mutation(name="deleteHymn")
    def delete_hymn(self, info: Info, pk: strawberry.ID) -> Annotated[
        Union[DeleteResult, PermissionDeniedError, NotFoundError],
        strawberry.union("DeleteHymnResult"),
    ]:
        """Deleta um Hymn (paridade com `hymn_delete_view`)."""
        user = _request(info).user
        hymn = hymn_models.Hymn.objects.filter(pk=pk).first()
        if hymn is None:
            return NotFoundError()
        if not can_edit_hymnbook(user, hymn.hymn_book):
            return PermissionDeniedError()

        pk_str = str(hymn.pk)
        hymn.delete()
        return DeleteResult(ok=True, deleted_id=pk_str)

    @strawberry.mutation(name="quickReviewHymn")
    def quick_review_hymn(self, info: Info, pk: strawberry.ID, style: str, repetitions: str) -> Annotated[
        Union[HymnType, PermissionDeniedError, NotFoundError, ValidationError],
        strawberry.union("QuickReviewHymnResult"),
    ]:
        """Revisão ágil (paridade com `editor_quick_review`): só `style` e
        `repetitions`. NUNCA toca `review_status` — manter REVIEWED exige a
        mutation completa. Signal `_create_hymn_revision_on_edit` grava a
        HymnRevision automaticamente."""
        user = _request(info).user
        hymn = hymn_models.Hymn.objects.filter(pk=pk).first()
        if hymn is None:
            return NotFoundError()
        if not can_edit_hymnbook(user, hymn.hymn_book):
            return PermissionDeniedError()

        form = QuickReviewForm(data={"style": style, "repetitions": repetitions}, instance=hymn)
        if not form.is_valid():
            field, errors = next(iter(form.errors.items()))
            return ValidationError(message=errors[0], field=field)
        form.save()
        return hymn

    @strawberry.mutation(name="uploadAudio")
    def upload_audio(
        self,
        info: Info,
        hymn_pk: strawberry.ID,
        file: Upload,
        title: str | None = strawberry.UNSET,
        source: str | None = strawberry.UNSET,
        credits: str | None = strawberry.UNSET,
        allow_download: bool | None = strawberry.UNSET,
    ) -> Annotated[
        Union[HymnAudioType, PermissionDeniedError, NotFoundError, ValidationError],
        strawberry.union("UploadAudioResult"),
    ]:
        """Upload de áudio (paridade com `upload_audio` view). Multipart via
        `strawberry.file_uploads.Upload`. Signal `_generate_waveform_for_audio`
        dispara automaticamente após o save."""
        user = _request(info).user
        if not getattr(user, "is_authenticated", False):
            return PermissionDeniedError(message="É preciso estar autenticado para enviar áudios.")

        hymn = hymn_models.Hymn.objects.filter(pk=hymn_pk).first()
        if hymn is None:
            return NotFoundError()

        form_data = {
            "title": "" if title is strawberry.UNSET or title is None else title,
            "source": "" if source is strawberry.UNSET or source is None else source,
            "credits": "" if credits is strawberry.UNSET or credits is None else credits,
            "allow_download": True if allow_download is strawberry.UNSET or allow_download is None else allow_download,
        }
        form = HymnAudioUploadForm(data=form_data, files={"audio_file": file})
        if not form.is_valid():
            field, errors = next(iter(form.errors.items()))
            return ValidationError(message=errors[0], field=field)

        audio = form.save(commit=False)
        audio.hymn = hymn
        audio.uploaded_by = user
        name_lower = audio.audio_file.name.lower()
        if name_lower.endswith(".mp3"):
            audio.format = "MP3"
        elif name_lower.endswith(".ogg"):
            audio.format = "OGG"
        elif name_lower.endswith(".flac"):
            audio.format = "FLAC"
        audio.file_size = audio.audio_file.size
        audio.save()
        return audio

    @strawberry.mutation(name="approveAudio")
    def approve_audio(self, info: Info, pk: strawberry.ID) -> Annotated[
        Union[HymnAudioType, PermissionDeniedError, NotFoundError],
        strawberry.union("ApproveAudioResult"),
    ]:
        """Aprova um HymnAudio (paridade com `editor_approve_audio`)."""
        user = _request(info).user
        audio = hymn_models.HymnAudio.objects.filter(pk=pk).select_related("hymn__hymn_book").first()
        if audio is None:
            return NotFoundError()
        if not can_edit_hymnbook(user, audio.hymn.hymn_book):
            return PermissionDeniedError()
        audio.is_approved = True
        audio.save(update_fields=["is_approved", "updated_at"])
        return audio

    @strawberry.mutation(name="rejectAudio")
    def reject_audio(self, info: Info, pk: strawberry.ID) -> Annotated[
        Union[DeleteResult, PermissionDeniedError, NotFoundError],
        strawberry.union("RejectAudioResult"),
    ]:
        """Rejeita = deleta o áudio (paridade com `editor_reject_audio`)."""
        user = _request(info).user
        audio = hymn_models.HymnAudio.objects.filter(pk=pk).select_related("hymn__hymn_book").first()
        if audio is None:
            return NotFoundError()
        if not can_edit_hymnbook(user, audio.hymn.hymn_book):
            return PermissionDeniedError()
        pk_str = str(audio.pk)
        audio.delete()
        return DeleteResult(ok=True, deleted_id=pk_str)

    @strawberry.mutation(name="reviewAudio")
    def review_audio(self, info: Info, pk: strawberry.ID, input: AudioReviewInput) -> Annotated[
        Union[HymnAudioType, PermissionDeniedError, NotFoundError],
        strawberry.union("ReviewAudioResult"),
    ]:
        """Revisão de áudio (paridade com `editor_hymn_audio_review`).

        O `save()` do `HymnAudio` força `is_approved=False` quando `is_match=False`
        e zera `quality_*` — replicamos a regra delegando ao model.
        """
        user = _request(info).user
        audio = hymn_models.HymnAudio.objects.filter(pk=pk).select_related("hymn__hymn_book").first()
        if audio is None:
            return NotFoundError()
        if not can_edit_hymnbook(user, audio.hymn.hymn_book):
            return PermissionDeniedError()

        audio.is_match = bool(input.is_match)

        if input.quality_rating is not strawberry.UNSET:
            v = input.quality_rating
            audio.quality_rating = v if v in {1, 2, 3, 4, 5} else None

        if input.quality_observations is not strawberry.UNSET and input.quality_observations is not None:
            valid = set(hymn_models.HymnAudio.QUALITY_OBSERVATIONS)
            audio.quality_observations = [o for o in input.quality_observations if o in valid]

        if input.mismatch_reason is not strawberry.UNSET:
            v = input.mismatch_reason
            valid_reasons = {c[0] for c in hymn_models.HymnAudio.MismatchReason.choices}
            audio.mismatch_reason = v if v in valid_reasons else ""

        audio.reviewed_by = user
        audio.reviewed_at = timezone.now()
        # Match=True com qualityRating preenchido habilita aprovação. NÃO setamos
        # is_approved=True automaticamente quando match=True sem rating (paridade
        # com a view: a aprovação efetiva continua sendo a mutation approveAudio).
        audio.save()
        return audio

    @strawberry.mutation(name="deleteAudio")
    def delete_audio(self, info: Info, pk: strawberry.ID) -> Annotated[
        Union[DeleteResult, PermissionDeniedError, NotFoundError],
        strawberry.union("DeleteAudioResult"),
    ]:
        """Deleta áudio. Permissão: uploader (autor) OU editor/admin do hinário.

        Esse caminho mais permissivo (uploader pode deletar o próprio upload
        mesmo sem ser editor) reflete a UX: o usuário comum precisa poder se
        retratar do envio enquanto está pendente.
        """
        user = _request(info).user
        audio = hymn_models.HymnAudio.objects.filter(pk=pk).select_related("hymn__hymn_book").first()
        if audio is None:
            return NotFoundError()
        if not getattr(user, "is_authenticated", False):
            return PermissionDeniedError()
        is_owner = audio.uploaded_by_id == user.pk
        if not (is_owner or can_edit_hymnbook(user, audio.hymn.hymn_book)):
            return PermissionDeniedError()
        pk_str = str(audio.pk)
        audio.delete()
        return DeleteResult(ok=True, deleted_id=pk_str)

    @strawberry.mutation(name="followUser")
    def follow_user(self, info: Info, username: str) -> Annotated[
        Union[UserProfileType, PermissionDeniedError, NotFoundError],
        strawberry.union("FollowUserResult"),
    ]:
        """Segue um usuário (paridade com `toggle_follow` direção "follow")."""
        user = _request(info).user
        if not getattr(user, "is_authenticated", False):
            return PermissionDeniedError(message="É preciso estar autenticado para seguir usuários.")
        target = user_models.User.objects.filter(username=username).first()
        if target is None:
            return NotFoundError()
        if target == user:
            return PermissionDeniedError(message="Você não pode seguir a si mesmo.")

        _, created = user_models.UserFollow.objects.get_or_create(follower=user, followed=target)
        if created:
            user_models.Notification.objects.create(
                recipient=target,
                sender=user,
                notification_type=user_models.Notification.TYPE_FOLLOW,
                title="Novo seguidor",
                message=f"{user.username} começou a seguir você",
                link=f"/perfil/{user.username}/",
            )
        return UserProfileType(user=target)

    @strawberry.mutation(name="unfollowUser")
    def unfollow_user(self, info: Info, username: str) -> Annotated[
        Union[UserProfileType, PermissionDeniedError, NotFoundError],
        strawberry.union("UnfollowUserResult"),
    ]:
        """Deixa de seguir um usuário. No-op idempotente quando já não segue."""
        user = _request(info).user
        if not getattr(user, "is_authenticated", False):
            return PermissionDeniedError(message="É preciso estar autenticado.")
        target = user_models.User.objects.filter(username=username).first()
        if target is None:
            return NotFoundError()
        user_models.UserFollow.objects.filter(follower=user, followed=target).delete()
        return UserProfileType(user=target)

    @strawberry.mutation(name="markNotificationRead")
    def mark_notification_read(self, info: Info, pk: strawberry.ID) -> Annotated[
        Union[NotificationType, PermissionDeniedError, NotFoundError],
        strawberry.union("MarkNotificationReadResult"),
    ]:
        """Marca uma notificação como lida (paridade com `mark_notification_read`).

        Notificações alheias retornam `NotFoundError` ao invés de
        `PermissionDeniedError` — não vaza existência de notificação que o
        usuário não deveria ver.
        """
        user = _request(info).user
        if not getattr(user, "is_authenticated", False):
            return PermissionDeniedError()
        notif = user_models.Notification.objects.filter(pk=pk, recipient=user).first()
        if notif is None:
            return NotFoundError()
        if not notif.is_read:
            notif.is_read = True
            notif.save(update_fields=["is_read"])
        return notif

    @strawberry.mutation(name="markAllNotificationsRead")
    def mark_all_notifications_read(self, info: Info) -> int:
        """Marca todas as notificações não-lidas do usuário como lidas.

        Anônimo recebe 0 (sem erro — feed vazio é resposta natural).
        Retorna o número de notificações afetadas.
        """
        user = _request(info).user
        if not getattr(user, "is_authenticated", False):
            return 0
        return user_models.Notification.objects.filter(recipient=user, is_read=False).update(is_read=True)

    @strawberry.mutation
    def toggle_favorite(self, info: Info, hymn_pk: strawberry.ID) -> Annotated[
        Union[ToggleFavoriteSuccess, PermissionDeniedError, NotFoundError],
        strawberry.union("ToggleFavoriteResult"),
    ]:
        user = _request(info).user
        if not getattr(user, "is_authenticated", False):
            return PermissionDeniedError(message="É preciso estar autenticado para favoritar hinos.")

        hymn = hymn_models.Hymn.objects.filter(pk=hymn_pk).first()
        if hymn is None:
            return NotFoundError()

        existing = hymn_models.Favorite.objects.filter(user=user, hymn=hymn).first()
        if existing:
            existing.delete()
            return ToggleFavoriteSuccess(favorited=False)
        hymn_models.Favorite.objects.create(user=user, hymn=hymn)
        return ToggleFavoriteSuccess(favorited=True)
