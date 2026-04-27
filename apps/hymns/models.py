import uuid

from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.search import SearchVectorField
from django.db import models
from django.utils.text import slugify


class HymnBook(models.Model):
    """
    Hinário - coleção de hinos.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField("Nome", max_length=255, unique=True, db_index=True, help_text="Nome do hinário")
    intro_name = models.CharField("Nome curto", max_length=100, blank=True, help_text="Nome de exibição curto")
    slug = models.SlugField("Slug", unique=True, max_length=255)
    owner_name = models.CharField(
        "Nome do dono", max_length=255, help_text="Pessoa que recebeu o hinário (texto livre)"
    )
    owner_user = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="owned_hymnbooks",
        verbose_name="Usuário dono",
        help_text="Usuário cadastrado como dono deste hinário",
    )
    cover_image = models.ImageField("Imagem de capa", upload_to="hymn_covers/", blank=True, null=True)
    description = models.TextField("Descrição", blank=True)

    created_at = models.DateTimeField("Criado em", auto_now_add=True)
    updated_at = models.DateTimeField("Atualizado em", auto_now=True)

    class Meta:
        verbose_name = "Hinário"
        verbose_name_plural = "Hinários"
        ordering = ["name"]
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["owner_name"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    @property
    def hymn_count(self):
        """Retorna o número de hinos neste hinário."""
        return self.hymns.count()


class Hymn(models.Model):
    """
    Hino - canto individual dentro de um hinário.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hymn_book = models.ForeignKey(HymnBook, on_delete=models.CASCADE, related_name="hymns", verbose_name="Hinário")
    number = models.PositiveIntegerField("Número", help_text="Número sequencial do hino no hinário")
    title = models.CharField("Título", max_length=255, db_index=True)
    text = models.TextField("Letra", help_text="Letra completa do hino")

    # Campos opcionais
    received_at = models.DateField("Recebido em", null=True, blank=True, help_text="Data em que o hino foi recebido")
    offered_to = models.CharField("Oferecido para", max_length=255, blank=True, help_text="Pessoa dedicatária")
    style = models.CharField("Estilo musical", max_length=50, blank=True, help_text="Ex: Valsa, Marcha, Mazurca")
    extra_instructions = models.TextField("Instruções extras", blank=True, help_text="Instruções especiais de canto")
    repetitions = models.CharField(
        "Repetições", max_length=100, blank=True, help_text="Ex: 1-4, 5-8 (indicação de estrofes a repetir)"
    )

    # Full-text search vector (maintained by signal in apps.hymns.signals)
    search_vector = SearchVectorField(null=True, blank=True)

    created_at = models.DateTimeField("Criado em", auto_now_add=True)
    updated_at = models.DateTimeField("Atualizado em", auto_now=True)

    class Meta:
        verbose_name = "Hino"
        verbose_name_plural = "Hinos"
        ordering = ["hymn_book", "number"]
        unique_together = [["hymn_book", "number"]]
        indexes = [
            models.Index(fields=["hymn_book", "number"]),
            models.Index(fields=["title"]),
            models.Index(fields=["received_at"]),
            GinIndex(fields=["search_vector"], name="hymn_search_vector_gin"),
        ]

    def __str__(self):
        return f"{self.hymn_book.name} - {self.number}. {self.title}"

    @property
    def full_title(self):
        """Retorna título completo: Hinário - Nº. Título"""
        return str(self)


class HymnBookVersion(models.Model):
    """
    Versão de um hinário - permite múltiplas versões do mesmo hinário.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hymn_book = models.ForeignKey(HymnBook, on_delete=models.CASCADE, related_name="versions", verbose_name="Hinário")
    version_name = models.CharField("Nome da versão", max_length=100, help_text="Ex: Edição 2010, Versão revisada")
    description = models.TextField("Descrição", blank=True, help_text="Diferenças desta versão")

    # Arquivos
    pdf_file = models.FileField("Arquivo PDF", upload_to="hymnbooks/pdfs/", blank=True, null=True)
    yaml_file = models.FileField("Arquivo YAML", upload_to="hymnbooks/yaml/", blank=True, null=True)

    # Metadados
    uploaded_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_versions",
        verbose_name="Enviado por",
    )
    is_primary = models.BooleanField("Versão primária", default=False, help_text="Versão principal exibida")

    created_at = models.DateTimeField("Criado em", auto_now_add=True)
    updated_at = models.DateTimeField("Atualizado em", auto_now=True)

    class Meta:
        verbose_name = "Versão de Hinário"
        verbose_name_plural = "Versões de Hinários"
        ordering = ["-is_primary", "-created_at"]
        indexes = [
            models.Index(fields=["hymn_book", "is_primary"]),
            models.Index(fields=["uploaded_by"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"{self.hymn_book.name} - {self.version_name}"

    def save(self, *args, **kwargs):
        """
        Se is_primary=True, remove o flag de todas as outras versões deste hinário.
        """
        if self.is_primary:
            # Remove is_primary de outras versões
            HymnBookVersion.objects.filter(hymn_book=self.hymn_book, is_primary=True).exclude(pk=self.pk).update(
                is_primary=False
            )
        super().save(*args, **kwargs)


class HymnAudio(models.Model):
    """Áudio de um hino."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Relacionamento
    hymn = models.ForeignKey(Hymn, on_delete=models.CASCADE, related_name="audios", verbose_name="Hino")

    # Arquivo de áudio
    audio_file = models.FileField(
        "Arquivo de áudio",
        upload_to="hymns/audio/%Y/%m/",
        help_text="MP3, OGG ou FLAC. Máximo 25MB.",
    )

    # Metadados
    title = models.CharField("Título da gravação", max_length=200, blank=True, help_text="Ex: Gravação Studio 2023")
    source = models.CharField("Fonte", max_length=255, blank=True, help_text="Onde foi gravado")
    recorded_at = models.DateField("Data de gravação", null=True, blank=True, help_text="Quando foi gravado")
    credits = models.TextField("Créditos", blank=True, help_text="Quem cantou, gravou, produziu, etc.")

    # Informações técnicas
    duration = models.PositiveIntegerField("Duração (segundos)", null=True, blank=True, help_text="Duração em segundos")
    file_size = models.PositiveIntegerField(
        "Tamanho (bytes)", null=True, blank=True, help_text="Tamanho do arquivo em bytes"
    )
    format = models.CharField("Formato", max_length=10, blank=True, help_text="MP3, OGG, FLAC, etc.")

    # Controle
    uploaded_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_audios",
        verbose_name="Enviado por",
    )
    is_approved = models.BooleanField("Aprovado", default=False, help_text="Moderação")
    allow_download = models.BooleanField("Permitir download", default=True, help_text="Usuários podem baixar o arquivo")

    # Timestamps
    created_at = models.DateTimeField("Criado em", auto_now_add=True)
    updated_at = models.DateTimeField("Atualizado em", auto_now=True)

    class Meta:
        verbose_name = "Áudio de Hino"
        verbose_name_plural = "Áudios de Hinos"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["hymn", "-created_at"]),
            models.Index(fields=["is_approved"]),
            models.Index(fields=["uploaded_by"]),
        ]

    def __str__(self):
        return f"Áudio: {self.hymn.title} ({self.title or 'Sem título'})"


class Favorite(models.Model):
    """Hino favoritado por usuário."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    user = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name="favorites", verbose_name="Usuário")
    hymn = models.ForeignKey(Hymn, on_delete=models.CASCADE, related_name="favorited_by", verbose_name="Hino")

    created_at = models.DateTimeField("Criado em", auto_now_add=True)

    class Meta:
        verbose_name = "Favorito"
        verbose_name_plural = "Favoritos"
        ordering = ["-created_at"]
        unique_together = [["user", "hymn"]]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["hymn"]),
        ]

    def __str__(self):
        return f"{self.user.username} → {self.hymn.title}"


class Comment(models.Model):
    """Comentário em um hino."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    hymn = models.ForeignKey(Hymn, on_delete=models.CASCADE, related_name="comments", verbose_name="Hino")
    user = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name="comments", verbose_name="Usuário")

    text = models.TextField("Comentário", max_length=1000)

    # Moderação
    is_approved = models.BooleanField("Aprovado", default=True, help_text="Pode ser moderado")
    is_flagged = models.BooleanField("Reportado", default=False, help_text="Reportado por abuso")

    # Timestamps
    created_at = models.DateTimeField("Criado em", auto_now_add=True)
    updated_at = models.DateTimeField("Atualizado em", auto_now=True)

    class Meta:
        verbose_name = "Comentário"
        verbose_name_plural = "Comentários"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["hymn", "-created_at"]),
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["is_approved"]),
        ]

    def __str__(self):
        return f"{self.user.username} em {self.hymn.title}: {self.text[:50]}..."


class OCRTask(models.Model):
    """
    Tracks OCR processing for a PDF upload. Worker thread updates progress
    fields; the wizard polls a status endpoint to render the progress bar.
    """

    STATUS_PENDING = "pending"
    STATUS_PROCESSING = "processing"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pendente"),
        (STATUS_PROCESSING, "Processando"),
        (STATUS_COMPLETED, "Concluído"),
        (STATUS_FAILED, "Falhou"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name="ocr_tasks", verbose_name="Usuário")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    current_page = models.PositiveIntegerField("Página atual", default=0)
    total_pages = models.PositiveIntegerField("Total de páginas", default=0)
    result_data = models.JSONField("Dados do resultado", null=True, blank=True)
    error_message = models.TextField("Erro", blank=True)
    pdf_filename = models.CharField("Nome do PDF", max_length=255, blank=True)

    created_at = models.DateTimeField("Criado em", auto_now_add=True)
    started_at = models.DateTimeField("Iniciado em", null=True, blank=True)
    finished_at = models.DateTimeField("Finalizado em", null=True, blank=True)

    class Meta:
        verbose_name = "Tarefa OCR"
        verbose_name_plural = "Tarefas OCR"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"OCRTask {self.id} ({self.status})"

    @property
    def progress_pct(self) -> int:
        if self.total_pages <= 0:
            return 0
        return min(100, int(self.current_page * 100 / self.total_pages))

    @property
    def is_done(self) -> bool:
        return self.status in (self.STATUS_COMPLETED, self.STATUS_FAILED)
