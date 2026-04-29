import hashlib
import uuid

from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.search import SearchVectorField
from django.db import models
from django.utils.text import slugify

from .managers import HymnBookManager

# Marco 2.0.6 — paleta para cards de hinários quando o dono não escolhe cor.
# Hex codes inspirados nos cards do design (verde-musgo, vermelho-tijolo, navy,
# oliva, mostarda, púrpura, ciano, marrom).
HYMNBOOK_ACCENT_PALETTE = [
    "#1F5C4D",  # verde musgo
    "#8C3A2E",  # vermelho tijolo
    "#1A2A4A",  # navy
    "#5B6E2A",  # oliva
    "#B58D3E",  # mostarda
    "#5E3A6B",  # púrpura
    "#2E6E76",  # ciano profundo
    "#6B4A2A",  # marrom
]


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
    accent_color = models.CharField(
        "Cor de destaque",
        max_length=7,
        blank=True,
        help_text="Hex (ex.: #8C3A2E). Vazio: cor escolhida deterministicamente pela paleta.",
    )

    is_published = models.BooleanField(
        "Publicado",
        default=False,
        help_text="Hinário visível em listas/busca para o público",
    )
    published_at = models.DateTimeField("Publicado em", null=True, blank=True)
    published_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="published_hymnbooks",
        verbose_name="Publicado por",
    )

    created_at = models.DateTimeField("Criado em", auto_now_add=True)
    updated_at = models.DateTimeField("Atualizado em", auto_now=True)

    objects = HymnBookManager()

    class Meta:
        verbose_name = "Hinário"
        verbose_name_plural = "Hinários"
        ordering = ["name"]
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["owner_name"]),
            models.Index(fields=["created_at"]),
        ]
        permissions = [
            ("can_review_any_hymnbook", "Pode revisar/editar qualquer hinário"),
            ("can_publish_hymnbook", "Pode publicar/despublicar hinários"),
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

    @property
    def display_accent(self) -> str:
        """Cor de destaque para cards. Usa accent_color se setado, senão escolhe
        deterministicamente da paleta pelo hash do slug."""
        if self.accent_color:
            return self.accent_color
        seed = self.slug or self.name or ""
        idx = int(hashlib.md5(seed.encode()).hexdigest(), 16) % len(HYMNBOOK_ACCENT_PALETTE)
        return HYMNBOOK_ACCENT_PALETTE[idx]

    @property
    def review_progress(self) -> dict:
        """
        Conta hinos por estado de revisão em uma única query agregada.
        Retorna {total, reviewed, in_review, pct}.
        """
        from django.db.models import Count, Q

        agg = self.hymns.aggregate(
            total=Count("id"),
            reviewed=Count("id", filter=Q(review_status=Hymn.ReviewStatus.REVIEWED)),
            in_review=Count("id", filter=Q(review_status=Hymn.ReviewStatus.IN_REVIEW)),
        )
        total = agg["total"] or 0
        reviewed = agg["reviewed"] or 0
        in_review = agg["in_review"] or 0
        pct = int(reviewed * 100 / total) if total else 0
        return {"total": total, "reviewed": reviewed, "in_review": in_review, "pct": pct}

    @property
    def is_fully_reviewed(self) -> bool:
        """True se há ao menos um hino e todos estão REVIEWED."""
        progress = self.review_progress
        return progress["total"] > 0 and progress["reviewed"] == progress["total"]


class Hymn(models.Model):
    """
    Hino - canto individual dentro de um hinário.
    """

    class ReviewStatus(models.TextChoices):
        NOT_REVIEWED = "not_reviewed", "Não revisado"
        IN_REVIEW = "in_review", "Em revisão"
        REVIEWED = "reviewed", "Revisado"

    class Source(models.TextChoices):
        MANUAL = "manual", "Manual"
        OCR = "ocr", "OCR"
        YAML = "yaml", "YAML"

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

    # Estado de revisão (Marco 1.3)
    review_status = models.CharField(
        "Status de revisão",
        max_length=20,
        choices=ReviewStatus.choices,
        default=ReviewStatus.NOT_REVIEWED,
        db_index=True,
    )
    last_reviewed_at = models.DateTimeField("Última revisão em", null=True, blank=True)
    last_reviewed_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_hymns",
        verbose_name="Última revisão por",
    )
    source = models.CharField(
        "Origem",
        max_length=10,
        choices=Source.choices,
        default=Source.MANUAL,
        help_text="Como o hino foi cadastrado (manual, OCR, YAML)",
    )

    # Marco 2.0.1 — preserva o texto cru do OCR para o diff visual na revisão.
    ocr_text = models.TextField(
        "Texto OCR original",
        blank=True,
        help_text="Texto cru extraído pelo OCR antes de revisão editorial",
    )
    ocr_avg_confidence = models.FloatField(
        "Confiança média do OCR (0-100)", null=True, blank=True
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

    # Waveform pré-computada (~120 floats 0..1) — usada pelo player custom.
    # Vazio enquanto a thread daemon não terminou o backfill.
    waveform_peaks = models.JSONField("Picos da waveform", default=list, blank=True)

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


class HymnRevision(models.Model):
    """
    Trilha de auditoria de revisões editoriais de um Hymn.

    Cada save de Hymn que altera campos editoriais (texto, título, status de
    revisão, etc.) gera uma HymnRevision via signal `post_save`. A diff dos
    campos é capturada em `field_diff` (JSON: {field: {old, new}}).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hymn = models.ForeignKey(Hymn, on_delete=models.CASCADE, related_name="revisions", verbose_name="Hino")
    revised_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="hymn_revisions",
        verbose_name="Revisado por",
    )
    revised_at = models.DateTimeField("Revisado em", auto_now_add=True)
    previous_status = models.CharField("Status anterior", max_length=20, blank=True)
    new_status = models.CharField("Novo status", max_length=20, blank=True)
    change_summary = models.TextField(
        "Resumo da mudança", blank=True, help_text="Descrição opcional das mudanças feitas pelo revisor"
    )
    field_diff = models.JSONField(
        "Diff de campos", default=dict, help_text="Snapshot dos campos alterados: {field: {old, new}}"
    )

    class Meta:
        verbose_name = "Revisão de hino"
        verbose_name_plural = "Revisões de hinos"
        ordering = ["-revised_at"]
        indexes = [
            models.Index(fields=["hymn", "-revised_at"]),
        ]

    def __str__(self):
        return f"Revisão {self.revised_at:%Y-%m-%d %H:%M} de {self.hymn}"
