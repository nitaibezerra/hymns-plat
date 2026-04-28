import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Custom user model.
    """

    # Add custom fields here in the future
    bio = models.TextField(blank=True, help_text="Biografia do usuário")
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)

    class Meta:
        verbose_name = "Usuário"
        verbose_name_plural = "Usuários"

    def __str__(self):
        return self.get_full_name() or self.email or self.username


class UserFollow(models.Model):
    """Relacionamento de seguir entre usuários."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    follower = models.ForeignKey(User, on_delete=models.CASCADE, related_name="following", verbose_name="Seguidor")
    followed = models.ForeignKey(User, on_delete=models.CASCADE, related_name="followers", verbose_name="Seguido")

    created_at = models.DateTimeField("Criado em", auto_now_add=True)

    class Meta:
        verbose_name = "Seguir Usuário"
        verbose_name_plural = "Seguir Usuários"
        ordering = ["-created_at"]
        unique_together = [["follower", "followed"]]
        indexes = [
            models.Index(fields=["follower", "-created_at"]),
            models.Index(fields=["followed", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.follower.username} segue {self.followed.username}"


class Notification(models.Model):
    """Notificação para usuário."""

    # Tipos de notificação
    TYPE_FOLLOW = "follow"
    TYPE_FAVORITE = "favorite"
    TYPE_UPLOAD_APPROVED = "upload_approved"
    TYPE_AUDIO_APPROVED = "audio_approved"

    NOTIFICATION_TYPES = [
        (TYPE_FOLLOW, "Novo seguidor"),
        (TYPE_FAVORITE, "Favorito"),
        (TYPE_UPLOAD_APPROVED, "Upload aprovado"),
        (TYPE_AUDIO_APPROVED, "Áudio aprovado"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    recipient = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="notifications", verbose_name="Destinatário"
    )
    sender = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="sent_notifications",
        verbose_name="Remetente",
    )

    notification_type = models.CharField("Tipo", max_length=20, choices=NOTIFICATION_TYPES, default=TYPE_FAVORITE)

    # Conteúdo
    title = models.CharField("Título", max_length=255)
    message = models.TextField("Mensagem", max_length=500)
    link = models.CharField("Link", max_length=500, blank=True, help_text="URL para onde a notificação leva")

    # Estado
    is_read = models.BooleanField("Lida", default=False)

    # Timestamps
    created_at = models.DateTimeField("Criado em", auto_now_add=True)

    class Meta:
        verbose_name = "Notificação"
        verbose_name_plural = "Notificações"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "-created_at"]),
            models.Index(fields=["is_read"]),
        ]

    def __str__(self):
        return f"Notificação para {self.recipient.username}: {self.title}"
