from django.contrib import admin

from .models import Favorite, Hymn, HymnAudio, HymnBook, HymnBookVersion


class HymnInline(admin.TabularInline):
    """Inline para exibir hinos dentro do hinário."""

    model = Hymn
    extra = 0
    fields = ["number", "title", "style", "received_at"]
    ordering = ["number"]


class HymnBookVersionInline(admin.TabularInline):
    """Inline para exibir versões dentro do hinário."""

    model = HymnBookVersion
    extra = 0
    fields = ["version_name", "is_primary", "uploaded_by", "pdf_file", "yaml_file", "created_at"]
    readonly_fields = ["created_at"]
    ordering = ["-is_primary", "-created_at"]


@admin.register(HymnBook)
class HymnBookAdmin(admin.ModelAdmin):
    """Admin para Hinários."""

    list_display = [
        "name",
        "intro_name",
        "owner_name",
        "owner_user",
        "priority",
        "is_featured",
        "hymn_count",
        "created_at",
    ]
    list_filter = ["priority", "is_featured", "is_published", "created_at", "owner_name"]
    list_editable = ["priority", "is_featured"]
    search_fields = ["name", "intro_name", "owner_name", "description"]
    prepopulated_fields = {"slug": ("name",)}
    readonly_fields = ["id", "created_at", "updated_at", "hymn_count"]
    inlines = [HymnBookVersionInline, HymnInline]

    fieldsets = [
        (
            "Informações Básicas",
            {
                "fields": ["name", "intro_name", "slug", "description", "cover_image"],
            },
        ),
        (
            "Proprietário",
            {
                "fields": ["owner_name", "owner_user"],
            },
        ),
        (
            "Curadoria editorial",
            {
                "fields": ["priority", "is_featured"],
                "description": "Prioridade da fila de revisão e destaque na home.",
            },
        ),
        (
            "Metadados",
            {
                "fields": ["id", "hymn_count", "created_at", "updated_at"],
                "classes": ["collapse"],
            },
        ),
    ]


@admin.register(Hymn)
class HymnAdmin(admin.ModelAdmin):
    """Admin para Hinos."""

    list_display = ["number", "title", "hymn_book", "style", "received_at", "created_at"]
    list_filter = ["hymn_book", "style", "received_at", "created_at"]
    search_fields = ["title", "text", "hymn_book__name"]
    readonly_fields = ["id", "created_at", "updated_at", "full_title"]
    list_select_related = ["hymn_book"]

    fieldsets = [
        (
            "Informações Básicas",
            {
                "fields": ["hymn_book", "number", "title", "text"],
            },
        ),
        (
            "Detalhes",
            {
                "fields": ["style", "received_at", "offered_to", "repetitions", "extra_instructions"],
            },
        ),
        (
            "Metadados",
            {
                "fields": ["id", "full_title", "created_at", "updated_at"],
                "classes": ["collapse"],
            },
        ),
    ]


@admin.register(HymnBookVersion)
class HymnBookVersionAdmin(admin.ModelAdmin):
    """Admin para Versões de Hinários."""

    list_display = ["hymn_book", "version_name", "is_primary", "uploaded_by", "created_at"]
    list_filter = ["is_primary", "created_at", "hymn_book"]
    search_fields = ["hymn_book__name", "version_name", "description"]
    readonly_fields = ["id", "created_at", "updated_at"]
    list_select_related = ["hymn_book", "uploaded_by"]

    fieldsets = [
        (
            "Informações Básicas",
            {
                "fields": ["hymn_book", "version_name", "description", "is_primary"],
            },
        ),
        (
            "Arquivos",
            {
                "fields": ["pdf_file", "yaml_file"],
            },
        ),
        (
            "Metadados",
            {
                "fields": ["id", "uploaded_by", "created_at", "updated_at"],
                "classes": ["collapse"],
            },
        ),
    ]


@admin.register(HymnAudio)
class HymnAudioAdmin(admin.ModelAdmin):
    """Admin para Áudios de Hinos."""

    list_display = ["hymn", "title", "format", "duration", "is_approved", "uploaded_by", "created_at"]
    list_filter = ["is_approved", "format", "allow_download", "created_at"]
    search_fields = ["hymn__title", "title", "source", "credits"]
    readonly_fields = ["id", "file_size", "created_at", "updated_at"]
    list_select_related = ["hymn", "hymn__hymn_book", "uploaded_by"]

    fieldsets = [
        (
            "Hino",
            {
                "fields": ["hymn"],
            },
        ),
        (
            "Arquivo",
            {
                "fields": ["audio_file", "format", "duration", "file_size"],
            },
        ),
        (
            "Metadados",
            {
                "fields": ["title", "source", "recorded_at", "credits"],
            },
        ),
        (
            "Controle",
            {
                "fields": ["is_approved", "allow_download", "uploaded_by"],
            },
        ),
        (
            "Timestamps",
            {
                "fields": ["id", "created_at", "updated_at"],
                "classes": ["collapse"],
            },
        ),
    ]


@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    """Admin para Favoritos."""

    list_display = ["user", "hymn", "created_at"]
    list_filter = ["created_at"]
    search_fields = ["user__username", "hymn__title", "hymn__hymn_book__name"]
    readonly_fields = ["id", "created_at"]
    list_select_related = ["user", "hymn", "hymn__hymn_book"]
