"""Métricas granulares por hinário no Workspace Editorial (handoff §1.3).

Anota `style_pct`, `reps_pct`, `audio_pct` ao lado do `review_pct` existente, em
1 query, sem cross-product entre JOINs (usa `Subquery`).
"""

from __future__ import annotations

import pytest
from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.hymns.models import Hymn, HymnAudio, HymnBook


def _make_editor(user):
    user.groups.add(Group.objects.get(name="editor"))
    return user


def _make_audio_file():
    # Header MP3 mínimo + payload de bytes nulos — passa nos validators leves
    # de magic-bytes sem precisar gerar áudio real.
    return SimpleUploadedFile("t.mp3", b"\xff\xfb\x90\x00" + b"\x00" * 64, content_type="audio/mpeg")


def _add_audio(hymn, *, is_approved: bool):
    return HymnAudio.objects.create(hymn=hymn, audio_file=_make_audio_file(), is_approved=is_approved, duration=60)


@pytest.mark.django_db
class TestGranularMetricsAnnotations:
    def test_style_pct_counts_only_non_empty_style(self, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Stylish")
        # 5 hinos, 3 com style preenchido → 60%
        for i in range(3):
            hymn_factory(hymn_book=hb, number=i + 1, style="Marcha")
        hymn_factory(hymn_book=hb, number=4, style="")
        hymn_factory(hymn_book=hb, number=5, style="")

        annotated = HymnBook.objects.with_review_progress().get(pk=hb.pk)
        assert annotated.style_hymns == 3
        assert annotated.style_pct == 60

    def test_reps_pct_counts_only_non_empty_repetitions(self, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Reps")
        # 4 hinos, 1 com repetitions preenchido → 25%
        hymn_factory(hymn_book=hb, number=1, repetitions="1-2,3-4")
        for n in (2, 3, 4):
            hymn_factory(hymn_book=hb, number=n, repetitions="")

        annotated = HymnBook.objects.with_review_progress().get(pk=hb.pk)
        assert annotated.reps_hymns == 1
        assert annotated.reps_pct == 25

    def test_audio_pct_counts_hymns_with_approved_audio(self, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Audios")
        # 5 hinos; 2 com ≥1 áudio aprovado → 40%
        h1 = hymn_factory(hymn_book=hb, number=1)
        _add_audio(h1, is_approved=True)
        # h1 com 2 áudios aprovados — NÃO duplica
        _add_audio(h1, is_approved=True)
        h2 = hymn_factory(hymn_book=hb, number=2)
        _add_audio(h2, is_approved=True)
        h3 = hymn_factory(hymn_book=hb, number=3)
        _add_audio(h3, is_approved=False)  # não aprovado → não conta
        hymn_factory(hymn_book=hb, number=4)
        hymn_factory(hymn_book=hb, number=5)

        annotated = HymnBook.objects.with_review_progress().get(pk=hb.pk)
        assert annotated.audio_hymns == 2, "audios duplicados não devem multiplicar"
        assert annotated.audio_pct == 40

    def test_zero_hymns_yields_zero_percent_everywhere(self, hymn_book_factory):
        hb = hymn_book_factory(name="Vazio")
        annotated = HymnBook.objects.with_review_progress().get(pk=hb.pk)
        assert annotated.total_hymns == 0
        assert annotated.review_pct == 0
        assert annotated.style_pct == 0
        assert annotated.reps_pct == 0
        assert annotated.audio_pct == 0

    def test_metrics_independence_no_cross_product(self, hymn_book_factory, hymn_factory):
        """Empilhar 4 anotações com JOIN em audios poderia multiplicar valores
        (cross-product). O Subquery do `with_review_progress` previne isso."""
        hb = hymn_book_factory(name="X")
        # 2 hinos; 1 com 3 áudios aprovados, 1 com style preenchido
        h1 = hymn_factory(hymn_book=hb, number=1, style="Marcha", repetitions="1-2,3-4")
        for _ in range(3):
            _add_audio(h1, is_approved=True)
        hymn_factory(hymn_book=hb, number=2, style="")

        annotated = HymnBook.objects.with_review_progress().get(pk=hb.pk)
        # total_hymns = 2 (não 6 = 2 × 3 áudios)
        assert annotated.total_hymns == 2
        assert annotated.style_hymns == 1
        assert annotated.reps_hymns == 1
        assert annotated.audio_hymns == 1
        # Sanidade: percentuais batem.
        assert annotated.style_pct == 50
        assert annotated.reps_pct == 50
        assert annotated.audio_pct == 50


@pytest.mark.django_db
class TestContextExposesGranularMetrics:
    """View `editor_hymnbook_list` precisa entregar os pcts no contexto pra
    o template renderizar as 4 barras."""

    def test_view_passes_annotated_books_with_pcts(self, authenticated_client, hymn_book_factory, hymn_factory):
        from django.urls import reverse

        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="Visivel")
        h = hymn_factory(hymn_book=hb, number=1, style="Marcha")
        h.review_status = Hymn.ReviewStatus.REVIEWED
        h.save()

        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_list"))
        books = list(resp.context["hymnbooks"])
        assert books, "fila deve listar o hinário criado"
        first = books[0]
        # Atributos anotados pelo manager
        for attr in ("review_pct", "style_pct", "reps_pct", "audio_pct"):
            assert hasattr(first, attr), f"falta anotação {attr}"
        assert first.style_pct == 100
        assert first.review_pct == 100
