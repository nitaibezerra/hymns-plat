"""
Tipos GraphQL para o domínio hymns.

Marco 1: campos mínimos pra introspection passar.
Marco 4.A: estende `HymnBookType` com `stats` (paridade com `_annotate_card_counts`
em `apps/hymns/views.py`); adiciona campos relacionais a `HymnType`/`HymnAudioType`
e tipos de apoio (`UserProfileType`, `NotificationType`, `HeatmapBucketType`).
"""

from __future__ import annotations

import datetime
import enum

import strawberry
import strawberry_django
from django.db.models import Count, Q
from strawberry.types import Info

from apps.hymns import models as hymn_models
from apps.hymns.permissions import _is_editor_or_admin
from apps.users import models as user_models


def _user_from_info(info: Info):
    """Atalho pra extrair `request.user` do contexto Strawberry."""
    request = info.context["request"] if isinstance(info.context, dict) else info.context.request
    return request.user


@strawberry.input
class HymnBookInput:
    """Payload de criação/edição de HymnBook — espelha `HymnBookForm.Meta.fields`."""

    name: str
    owner_name: str
    intro_name: str | None = strawberry.UNSET
    description: str | None = strawberry.UNSET


@strawberry.input
class SortInput:
    """Par ordenado `(coluna, direção)` para ordenação multi-key.

    Colunas suportadas em queries editoriais: `review`, `comp` (style+reps),
    `audio` e `recent` — o MESMO vocabulário dos chips de sort da URL do
    workspace (`?sort=review:asc,audio:desc`). Direções: `"asc"` ou `"desc"`.
    A ordem da lista é a prioridade do ORDER BY (cliques mais antigos vencem).
    Colunas/direções inválidas são ignoradas pelo resolver (não erro —
    degradação silenciosa, igual à view)."""

    column: str
    direction: str


@strawberry.input
class AudioReviewInput:
    """Decisão de revisão de áudio (paridade com `editor_hymn_audio_review`).

    `isMatch` é obrigatório (True/False). Quando False, mismatchReason vira
    relevante. Quando True, qualityRating e qualityObservations podem
    enriquecer a nota."""

    is_match: bool
    quality_rating: int | None = strawberry.UNSET
    quality_observations: list[str] | None = strawberry.UNSET
    mismatch_reason: str | None = strawberry.UNSET


@strawberry.input
class HymnInput:
    """Payload de criação/edição de Hymn — espelha `HymnForm.Meta.fields` (subset
    obrigatório). `received_at` continua só via `updateHymn` do Marco 2."""

    number: int
    title: str
    text: str
    style: str | None = strawberry.UNSET
    repetitions: str | None = strawberry.UNSET
    extra_instructions: str | None = strawberry.UNSET
    offered_to: str | None = strawberry.UNSET
    section: str | None = strawberry.UNSET


@strawberry.type
class PublishReadinessCheckType:
    """Item da lista de pré-condições retornada por `publish_readiness`."""

    key: str
    label: str
    ok: bool


@strawberry.type
class PublishReadinessType:
    """Snapshot completo de `publish_readiness(hymnbook)`."""

    can_publish: bool
    checks: list[PublishReadinessCheckType]


@strawberry.type
class InlineDiffTokenType:
    """Token de uma linha do `_compute_inline_diff`. `kind` ∈
    {eq, sub, add, del}; `text`/`sub`/`add` preenchidos conforme o kind."""

    kind: str
    text: str | None = None
    sub: str | None = None
    add: str | None = None


@strawberry.type
class InlineDiffLineType:
    """Linha do diff: `kind` ∈ {eq, replace, add, del}; `tokens` é a
    decomposição por palavra (só preenchida em kind=replace)."""

    kind: str
    tokens: list[InlineDiffTokenType]


@strawberry.type
class InlineDiffType:
    """Diff completo entre `Hymn.ocr_text` e `Hymn.text`."""

    lines: list[InlineDiffLineType]
    changes: int
    adds: int
    dels: int


@strawberry_django.type(hymn_models.HymnRevision)
class HymnRevisionType:
    """Trilha de auditoria de revisões editoriais (paridade com `HymnRevision`)."""

    id: strawberry.auto
    previous_status: str
    new_status: str
    change_summary: str
    field_diff: strawberry.scalars.JSON

    @strawberry.field
    def revised_at(self) -> datetime.datetime:
        return self.revised_at

    @strawberry.field
    def revised_by(self) -> "UserType | None":
        return self.revised_by


@strawberry_django.type(hymn_models.OCRTask)
class OCRTaskType:
    """Snapshot de uma OCRTask (status + progresso + resultado)."""

    id: strawberry.auto
    status: str
    current_page: int
    total_pages: int
    error_message: str
    pdf_filename: str
    result_data: strawberry.scalars.JSON

    @strawberry.field
    def progress_pct(self) -> int:
        return self.progress_pct


@strawberry.type
class EditorDashboardStatsType:
    """Stats agregadas exibidas no dashboard do workspace (paridade com a
    seção 'Stats inline' de `editor_hymnbook_list`)."""

    total_hinarios: int
    pending_hymns: int
    recent_reviewed7d: int
    p1_count: int
    pending_audios_count: int
    resume_hymn: "HymnType | None"


@strawberry.type
class PublishResult:
    """Resultado de `publishHymnBook`. `ok=True` quando publicação foi
    bem-sucedida; `failedChecks` lista as labels dos checks que falharam
    (mesma string que `publish_readiness` retorna)."""

    ok: bool
    failed_checks: list[str]


@strawberry.type
class DeleteResult:
    """Resultado de mutations destrutivas. `deletedId` permite o cliente
    atualizar caches otimistas localmente."""

    ok: bool
    deleted_id: strawberry.ID | None = None


@strawberry.type
class HymnBookStatsType:
    """Contagens equivalentes às anotações dos cards (`_annotate_card_counts`)."""

    hymns_total: int
    hymns_reviewed: int
    audios_approved: int


@strawberry.type
class HymnBookReviewProgressType:
    """As 4 métricas de completude anotadas por `HymnBookQuerySet.with_review_progress()`.

    São exatamente as colunas que os chips de sort do dashboard usam
    (`review`, `comp` = style+reps, `audio`), então o cliente consegue mostrar
    o % que a ordenação usou."""

    review_pct: int
    style_pct: int
    reps_pct: int
    audio_pct: int


@strawberry_django.type(hymn_models.HymnBook)
class HymnBookType:
    id: strawberry.auto
    name: strawberry.auto
    slug: strawberry.auto
    intro_name: strawberry.auto
    owner_name: strawberry.auto
    description: strawberry.auto
    is_published: strawberry.auto
    published_at: strawberry.auto
    priority: strawberry.auto
    is_featured: strawberry.auto
    created_at: strawberry.auto

    @strawberry.field
    def cover_image(self) -> str | None:
        """URL da capa no storage ativo (`None` quando o hinário não tem capa).

        Devolve URL em vez do path porque em produção o storage é R2 e o
        cliente precisa do domínio de mídia."""
        return self.cover_image.url if self.cover_image else None

    @strawberry.field
    def published_by(self) -> "UserType | None":
        """Quem publicou (`None` em rascunho, ou se o usuário foi removido —
        a FK é SET_NULL)."""
        return self.published_by

    @strawberry.field
    def review_progress(self) -> HymnBookReviewProgressType:
        """Percentuais de completude do hinário.

        Quando a instância vem de um queryset já anotado (`editorHymnbooks`),
        lê as anotações — zero query extra. Fora dele (`Query.hymnbook`,
        `Query.search`) reanota a própria linha via `with_review_progress()`,
        reusando o manager em vez de recalcular a regra aqui.
        """
        row = self
        if not hasattr(row, "review_pct"):
            row = hymn_models.HymnBook.objects.filter(pk=self.pk).with_review_progress().first() or self
        return HymnBookReviewProgressType(
            review_pct=getattr(row, "review_pct", 0) or 0,
            style_pct=getattr(row, "style_pct", 0) or 0,
            reps_pct=getattr(row, "reps_pct", 0) or 0,
            audio_pct=getattr(row, "audio_pct", 0) or 0,
        )

    @strawberry.field
    def stats(self) -> HymnBookStatsType:
        """Total de hinos / hinos revisados / áudios aprovados deste hinário.

        Reusa o mesmo padrão de `_annotate_card_counts`: `Count` em hinos +
        contagem condicional de áudios aprovados em uma única agregação.
        """
        agg = hymn_models.Hymn.objects.filter(hymn_book=self).aggregate(
            total=Count("id", distinct=True),
            reviewed=Count(
                "id",
                filter=Q(review_status=hymn_models.Hymn.ReviewStatus.REVIEWED),
                distinct=True,
            ),
        )
        audios_approved = hymn_models.HymnAudio.objects.filter(hymn__hymn_book=self, is_approved=True).count()
        return HymnBookStatsType(
            hymns_total=agg["total"] or 0,
            hymns_reviewed=agg["reviewed"] or 0,
            audios_approved=audios_approved,
        )

    @strawberry.field
    def hymns(self) -> list["HymnType"]:
        """Coleção de hinos deste hinário ordenada por `number` (mesma ordem
        do sumário/corrido/carrossel no monolito)."""
        return list(hymn_models.Hymn.objects.filter(hymn_book=self).order_by("number"))

    @strawberry.field
    def next_pending_hymn(self, current_pk: strawberry.ID | None = None) -> "HymnType | None":
        """Próximo hino não-revisado (paridade com `_next_pending_hymn`).

        Quando `current_pk` é fornecido, prefere hinos com `number` maior
        (fluxo de fila linear). Sem `current_pk`, retorna o primeiro pendente.
        """
        qs = hymn_models.Hymn.objects.filter(hymn_book=self).exclude(
            review_status=hymn_models.Hymn.ReviewStatus.REVIEWED
        )
        if current_pk is not None:
            current = hymn_models.Hymn.objects.filter(pk=current_pk).first()
            if current is not None:
                qs = qs.exclude(pk=current.pk)
                higher = qs.filter(number__gt=current.number).order_by("number").first()
                if higher is not None:
                    return higher
        return qs.order_by("number").first()

    @strawberry.field
    def next_incomplete_hymn(self) -> "HymnType | None":
        """Próximo hino sem style OU sem repetitions (paridade com `editor_next_incomplete`)."""
        from django.db.models import Q

        return (
            hymn_models.Hymn.objects.filter(hymn_book=self)
            .filter(Q(style="") | Q(repetitions=""))
            .order_by("number")
            .first()
        )


ReviewStatus = strawberry.enum(hymn_models.Hymn.ReviewStatus, name="ReviewStatus")


@strawberry_django.type(hymn_models.Hymn)
class HymnType:
    id: strawberry.auto
    number: strawberry.auto
    title: strawberry.auto
    style: strawberry.auto
    repetitions: strawberry.auto
    extra_instructions: strawberry.auto
    offered_to: strawberry.auto
    section: strawberry.auto
    source: strawberry.auto
    ocr_text: strawberry.auto
    received_at: strawberry.auto
    last_reviewed_at: strawberry.auto
    review_status: ReviewStatus

    @strawberry.field
    def last_reviewed_by(self) -> "UserType | None":
        """Quem assinou a última revisão (`None` se nunca revisado ou se o
        usuário foi removido — a FK é SET_NULL)."""
        return self.last_reviewed_by

    @strawberry.field
    def hymn_book(self) -> "HymnBookType":
        """Hinário ao qual o hino pertence.

        Não-nulável: `Hymn.hymn_book` é FK obrigatória com CASCADE. É o campo
        que permite breadcrumb, desambiguação por número e resultados de busca
        dizerem de onde cada hino veio."""
        return self.hymn_book

    @strawberry.field
    def is_favorited(self, info: Info) -> bool:
        """True se o usuário da sessão favoritou este hino.

        Contraparte de leitura da mutation `toggleFavorite`. Anônimo recebe
        `False` — coração apagado é resposta natural, não erro."""
        user = _user_from_info(info)
        if not getattr(user, "is_authenticated", False):
            return False
        return hymn_models.Favorite.objects.filter(user=user, hymn=self).exists()

    @strawberry.field
    def inline_diff(self) -> InlineDiffType | None:
        """Diff visual OCR×revisão. Vazio quando não há `ocr_text`."""
        from apps.hymns.editor_views import _compute_inline_diff

        raw = _compute_inline_diff(self.ocr_text or "", self.text or "")
        if not raw.get("lines"):
            return None
        lines = []
        for line in raw["lines"]:
            tokens = [
                InlineDiffTokenType(
                    kind=tok["kind"],
                    text=tok.get("text"),
                    sub=tok.get("sub"),
                    add=tok.get("add"),
                )
                for tok in line["tokens"]
            ]
            lines.append(InlineDiffLineType(kind=line["kind"], tokens=tokens))
        return InlineDiffType(lines=lines, changes=raw["changes"], adds=raw["adds"], dels=raw["dels"])

    @strawberry.field
    def ocr_line_confidences(self) -> list[int]:
        """Confiança por linha do OCR — heurística baseada em similaridade."""
        from apps.hymns.editor_views import _compute_ocr_line_confidences

        return _compute_ocr_line_confidences(self.ocr_text or "", self.text or "")

    @strawberry.field
    def revisions(self) -> list["HymnRevisionType"]:
        """Histórico de revisões (mais recente primeiro)."""
        return list(self.revisions.select_related("revised_by").order_by("-revised_at"))

    @strawberry.field
    def common_styles(self, top: int = 5) -> list[str]:
        """Top-N estilos mais usados no hinário (sugestões para o editor)."""
        from apps.hymns.editor_views import _common_field_values

        return _common_field_values(self.hymn_book, "style", max(1, min(top, 50)))

    @strawberry.field
    def common_repetitions(self, top: int = 5) -> list[str]:
        """Top-N padrões de repetição mais usados no hinário."""
        from apps.hymns.editor_views import _common_field_values

        return _common_field_values(self.hymn_book, "repetitions", max(1, min(top, 50)))

    @strawberry.field
    def body(self) -> str:
        return self.text

    @strawberry.field
    def previous_in_book(self) -> "HymnType | None":
        """Hino imediatamente anterior (mesmo hinário) por `number`."""
        return (
            hymn_models.Hymn.objects.filter(hymn_book=self.hymn_book, number__lt=self.number)
            .order_by("-number")
            .first()
        )

    @strawberry.field
    def next_in_book(self) -> "HymnType | None":
        """Hino imediatamente posterior (mesmo hinário) por `number`."""
        return (
            hymn_models.Hymn.objects.filter(hymn_book=self.hymn_book, number__gt=self.number).order_by("number").first()
        )

    @strawberry.field
    def siblings_with_same_number(self, info: Info) -> list["HymnType"]:
        """Outros hinos com o mesmo `number` em hinários `visible_to(user)`.

        Espelha a disambiguação que o monolito faz no detalhe do hino (links
        "este número aparece também em…"). Exclui o próprio hino.
        """
        user = _user_from_info(info)
        visible_books = hymn_models.HymnBook.objects.visible_to(user)
        return list(
            hymn_models.Hymn.objects.filter(number=self.number, hymn_book__in=visible_books)
            .exclude(pk=self.pk)
            .select_related("hymn_book")
            .order_by("hymn_book__name")
        )

    @strawberry.field
    def audios(self, info: Info, approved_only: bool = True) -> list["HymnAudioType"]:
        """Áudios deste hino com gating de visibilidade.

        - `approved_only=True` (default) sempre limita a `is_approved=True`,
          mantendo o comportamento do player público.
        - `approved_only=False` libera pendentes para quem pode ver: editor/admin
          vê todos; uploader autenticado vê os próprios (+ aprovados de qualquer
          um); anônimo segue restrito a aprovados.
        """
        user = _user_from_info(info)
        base = hymn_models.HymnAudio.objects.filter(hymn=self)
        if approved_only or not getattr(user, "is_authenticated", False):
            return list(base.filter(is_approved=True).order_by("-created_at"))
        if _is_editor_or_admin(user):
            return list(base.order_by("-created_at"))
        return list(base.filter(Q(is_approved=True) | Q(uploaded_by=user)).order_by("-created_at"))


@strawberry_django.type(hymn_models.HymnAudio)
class HymnAudioType:
    id: strawberry.auto
    waveform_peaks: list[int]
    title: strawberry.auto
    is_approved: strawberry.auto
    is_match: strawberry.auto
    quality_rating: strawberry.auto
    quality_observations: list[str]
    mismatch_reason: strawberry.auto

    @strawberry.field
    def url(self) -> str:
        """URL pública do arquivo de áudio (FileField.url do backend ativo)."""
        return self.audio_file.url if self.audio_file else ""

    @strawberry.field
    def duration_seconds(self) -> float | None:
        """Duração em segundos (None se o backfill ainda não preencheu)."""
        return float(self.duration) if self.duration is not None else None

    @strawberry.field
    def uploaded_by(self) -> "UserType | None":
        return self.uploaded_by


@strawberry_django.type(user_models.User)
class UserType:
    id: strawberry.auto
    username: strawberry.auto
    email: strawberry.auto

    @strawberry.field
    def is_editor(self) -> bool:
        """True quando o usuário tem papel editorial (grupo `editor` ou superuser).

        Reusa `apps.hymns.permissions._is_editor_or_admin` — mesma regra que
        gateia as views do workspace. O guard de rota do SPA depende disso."""
        return _is_editor_or_admin(self)


@strawberry.enum
class SearchKind(enum.Enum):
    """Filtro de tipo para `Query.search`."""

    ALL = "all"
    HYMN = "hymn"
    HYMNBOOK = "hymnbook"


@strawberry.type
class SearchResultsType:
    """Resultados heterogêneos da busca (hinos e/ou hinários)."""

    hymns: list[HymnType]
    hymnbooks: list[HymnBookType]


@strawberry.type
class HeatmapBucketType:
    """Bucket diário do heatmap "Trabalho editorial · último ano".

    Mesma forma do JSON exposto por `apps/users/api_views.py::api_user_heatmap`."""

    date: datetime.date
    count: int


@strawberry_django.type(user_models.Notification)
class NotificationType:
    """Item da feed de notificações do usuário autenticado."""

    id: strawberry.auto
    notification_type: str
    title: str
    message: str
    link: str
    is_read: bool
    created_at: datetime.datetime


@strawberry.type
class UserProfileType:
    """Agregado de perfil público: usuário + contagens + paginações + heatmap.

    Usado pela tela `/u/[username]` do SPA, com paridade conceitual ao
    `user_detail.html` + `api_user_heatmap` do monolito.
    """

    user: UserType

    @strawberry.field
    def followers_count(self) -> int:
        return user_models.UserFollow.objects.filter(followed=self.user).count()

    @strawberry.field
    def following_count(self) -> int:
        return user_models.UserFollow.objects.filter(follower=self.user).count()

    @strawberry.field
    def uploaded_audios(self) -> list[HymnAudioType]:
        return list(hymn_models.HymnAudio.objects.filter(uploaded_by=self.user).order_by("-created_at"))

    @strawberry.field
    def followers(self, first: int = 20, offset: int = 0) -> list[UserType]:
        """Página de seguidores (mais recentes primeiro). `first` é capado em 100."""
        first = max(0, min(first, 100))
        offset = max(0, offset)
        rows = (
            user_models.UserFollow.objects.filter(followed=self.user)
            .select_related("follower")
            .order_by("-created_at")[offset : offset + first]
        )
        return [row.follower for row in rows]

    @strawberry.field
    def following(self, first: int = 20, offset: int = 0) -> list[UserType]:
        """Página de quem o usuário segue (mais recentes primeiro). `first` é capado em 100."""
        first = max(0, min(first, 100))
        offset = max(0, offset)
        rows = (
            user_models.UserFollow.objects.filter(follower=self.user)
            .select_related("followed")
            .order_by("-created_at")[offset : offset + first]
        )
        return [row.followed for row in rows]

    @strawberry.field
    def is_followed_by_current_user(self, info: Info) -> bool:
        """True se o `currentUser` segue esse perfil. Anônimo recebe False."""
        viewer = _user_from_info(info)
        if not getattr(viewer, "is_authenticated", False):
            return False
        if viewer == self.user:
            return False
        return user_models.UserFollow.objects.filter(follower=viewer, followed=self.user).exists()

    @strawberry.field
    def activity_heatmap(self, days: int = 365) -> list[HeatmapBucketType]:
        """Heatmap diário de revisões editoriais nos últimos `days` dias.

        Espelha `apps/users/api_views.py::api_user_heatmap`: agrega HymnRevision
        por `TruncDate(revised_at)` e preenche dias sem atividade com count=0.
        """
        from django.db.models import Count
        from django.db.models.functions import TruncDate

        days = max(0, min(days, 366 * 5))
        today = datetime.date.today()
        start = today - datetime.timedelta(days=days)
        rows = (
            hymn_models.HymnRevision.objects.filter(revised_by=self.user, revised_at__date__gte=start)
            .annotate(day=TruncDate("revised_at"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )
        by_day = {row["day"]: row["count"] for row in rows}
        return [
            HeatmapBucketType(
                date=start + datetime.timedelta(days=offset),
                count=by_day.get(start + datetime.timedelta(days=offset), 0),
            )
            for offset in range(days + 1)
        ]
