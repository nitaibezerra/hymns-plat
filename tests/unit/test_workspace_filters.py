"""Filtros multidimensionais no `editor_hymnbook_list` (handoff §1.2 / §1.4).

`?sort=` e `?priority=` são independentes e combináveis. Defaults: sort=
least_reviewed, priority=all.
"""

from __future__ import annotations

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse

from apps.hymns.models import HymnBook


def _make_editor(user):
    user.groups.add(Group.objects.get(name="editor"))
    return user


@pytest.mark.django_db
class TestSortLeastAudios:
    def test_least_audios_orders_by_audio_pct_asc(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        # 'rico' tem audio_pct alto (vamos simular via review_pct para teste
        # simplificado — o ordering compartilha forma).
        zero_audio = hymn_book_factory(name="Sem audio")
        hymn_factory(hymn_book=zero_audio, number=1)
        # Sem audio criado → audio_pct = 0

        # Cria um segundo hinário também com audio_pct = 0, mas com nome > pra
        # confirmar o tie-breaker `name`.
        zero_audio_b = hymn_book_factory(name="zzz outro")
        hymn_factory(hymn_book=zero_audio_b, number=1)

        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_list"), {"sort": "least_audios"})
        assert resp.status_code == 200
        slugs = [hb.slug for hb in resp.context["hymnbooks"]]
        # Ambos têm 0% → tie-breaker name ascending puxa zero_audio antes.
        assert slugs.index(zero_audio.slug) < slugs.index(zero_audio_b.slug)
        assert resp.context["sort"] == "least_audios"


@pytest.mark.django_db
class TestPriorityFilter:
    def test_priority_p1_keeps_only_p1(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        urgent = hymn_book_factory(name="Urgente", priority=HymnBook.Priority.P1)
        hymn_factory(hymn_book=urgent, number=1)
        chill = hymn_book_factory(name="Calmo", priority=HymnBook.Priority.P3)
        hymn_factory(hymn_book=chill, number=1)

        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_list"), {"priority": "P1"})
        slugs = {hb.slug for hb in resp.context["hymnbooks"]}
        assert urgent.slug in slugs
        assert chill.slug not in slugs
        assert resp.context["priority"] == "P1"

    def test_priority_all_is_default(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X", priority=HymnBook.Priority.P3)
        hymn_factory(hymn_book=hb, number=1)
        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_list"))
        assert resp.context["priority"] == "all"
        assert any(b.slug == hb.slug for b in resp.context["hymnbooks"])

    def test_invalid_priority_falls_back_to_all(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X", priority=HymnBook.Priority.P3)
        hymn_factory(hymn_book=hb, number=1)
        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_list"), {"priority": "XX"})
        # priority inválido → filtro não aplica → hb continua aparecendo.
        assert any(b.slug == hb.slug for b in resp.context["hymnbooks"])

    def test_combined_priority_and_sort(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        a = hymn_book_factory(name="A urgente", priority=HymnBook.Priority.P1)
        hymn_factory(hymn_book=a, number=1)
        b = hymn_book_factory(name="B urgente", priority=HymnBook.Priority.P1)
        hymn_factory(hymn_book=b, number=1)
        outsider = hymn_book_factory(name="Z calmo", priority=HymnBook.Priority.P3)
        hymn_factory(hymn_book=outsider, number=1)

        resp = authenticated_client.get(
            reverse("hymns:editor_hymnbook_list"),
            {"priority": "P1", "sort": "least_audios"},
        )
        slugs = [hb.slug for hb in resp.context["hymnbooks"]]
        assert outsider.slug not in slugs
        assert a.slug in slugs and b.slug in slugs


@pytest.mark.django_db
class TestP1UrgentKPI:
    def test_kpi_counts_only_p1_visible_books(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hymn_book_factory(name="A", priority=HymnBook.Priority.P1)
        hymn_book_factory(name="B", priority=HymnBook.Priority.P1)
        hymn_book_factory(name="C", priority=HymnBook.Priority.P2)
        hymn_book_factory(name="D", priority=HymnBook.Priority.P3)

        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_list"))
        assert resp.context["stats"]["p1_count"] == 2
