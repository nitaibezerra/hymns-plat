"""Filtros multidimensionais no `editor_hymnbook_list`.

Modelo Fase 2.x-bis:
- `?sort=` é tri-state múltiplo: tuplas `metric:dir` separadas por vírgula,
  ordem de aparição = prioridade no ORDER BY (clique mais antigo vence).
- `?priority=` é mutuamente-exclusivo (filter). Quando `all`, prioridade do
  hinário vira sort PRIMÁRIO (P1 → P2 → P3) sobre os sorts do usuário.
- Métricas válidas de sort: review / comp (style+reps) / audio / recent.
"""

from __future__ import annotations

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse

from apps.hymns.editor_views import _encode_sort, _parse_sort, _toggle_sort
from apps.hymns.models import HymnBook


def _make_editor(user):
    user.groups.add(Group.objects.get(name="editor"))
    return user


class TestSortParseHelpers:
    """Parsing puro — sem DB."""

    def test_empty_string_yields_empty(self):
        assert _parse_sort("") == []
        assert _parse_sort(None) == []  # type: ignore[arg-type]

    def test_valid_single_pair(self):
        assert _parse_sort("review:asc") == [("review", "asc")]

    def test_multi_pairs_preserve_order(self):
        assert _parse_sort("audio:desc,review:asc,comp:desc") == [
            ("audio", "desc"),
            ("review", "asc"),
            ("comp", "desc"),
        ]

    def test_unknown_metric_skipped(self):
        assert _parse_sort("bogus:asc,review:desc") == [("review", "desc")]

    def test_invalid_direction_skipped(self):
        assert _parse_sort("review:up,audio:desc") == [("audio", "desc")]

    def test_dedupes_first_wins(self):
        assert _parse_sort("review:asc,review:desc") == [("review", "asc")]

    def test_missing_colon_skipped(self):
        assert _parse_sort("review,audio:asc") == [("audio", "asc")]


class TestSortToggle:
    def test_off_to_asc(self):
        assert _toggle_sort([], "review") == [("review", "asc")]

    def test_asc_to_desc(self):
        assert _toggle_sort([("review", "asc")], "review") == [("review", "desc")]

    def test_desc_to_off(self):
        assert _toggle_sort([("review", "desc")], "review") == []

    def test_append_new_metric_at_end(self):
        result = _toggle_sort([("review", "asc")], "audio")
        assert result == [("review", "asc"), ("audio", "asc")]

    def test_toggle_middle_metric_preserves_others_order(self):
        before = [("audio", "desc"), ("review", "asc"), ("comp", "desc")]
        after = _toggle_sort(before, "review")
        assert after == [("audio", "desc"), ("review", "desc"), ("comp", "desc")]

    def test_remove_middle_preserves_others_order(self):
        before = [("audio", "desc"), ("review", "desc"), ("comp", "asc")]
        after = _toggle_sort(before, "review")
        assert after == [("audio", "desc"), ("comp", "asc")]

    def test_encode_roundtrip(self):
        pairs = [("audio", "desc"), ("review", "asc")]
        assert _parse_sort(_encode_sort(pairs)) == pairs


@pytest.mark.django_db
class TestPriorityAsPrimarySortWhenAll:
    """Quando `priority=all` (default), prioridade do hinário (P1→P2→P3)
    vira o sort PRIMÁRIO sobre quaisquer sorts do usuário."""

    def test_no_explicit_sort_orders_by_priority_then_name(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        b_p2 = hymn_book_factory(name="B P2", priority=HymnBook.Priority.P2)
        hymn_factory(hymn_book=b_p2, number=1)
        a_p3 = hymn_book_factory(name="A P3", priority=HymnBook.Priority.P3)
        hymn_factory(hymn_book=a_p3, number=1)
        c_p1 = hymn_book_factory(name="C P1", priority=HymnBook.Priority.P1)
        hymn_factory(hymn_book=c_p1, number=1)

        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_list"))
        slugs = [hb.slug for hb in resp.context["hymnbooks"]]
        # P1 primeiro → P2 → P3, em ordem alfabética de name dentro de cada.
        assert slugs.index(c_p1.slug) < slugs.index(b_p2.slug) < slugs.index(a_p3.slug)

    def test_explicit_sort_falls_back_to_priority_primary(self, authenticated_client, hymn_book_factory, hymn_factory):
        """User sort vira tie-breaker DENTRO de cada grupo de prioridade."""
        _make_editor(authenticated_client.user)
        # Mesma prioridade P1, audio_pcts diferentes → o sort deve resolver.
        p1_a = hymn_book_factory(name="P1 A", priority=HymnBook.Priority.P1)
        hymn_factory(hymn_book=p1_a, number=1)
        p1_b = hymn_book_factory(name="P1 B", priority=HymnBook.Priority.P1)
        hymn_factory(hymn_book=p1_b, number=1)
        # P3 com `name` cedinho mas prioridade baixa: NÃO deve vir antes dos P1.
        p3 = hymn_book_factory(name="A P3", priority=HymnBook.Priority.P3)
        hymn_factory(hymn_book=p3, number=1)

        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_list"), {"sort": "audio:asc"})
        slugs = [hb.slug for hb in resp.context["hymnbooks"]]
        # P1s sempre antes do P3, mesmo com `A P3` ganhando no name asc.
        idx_p3 = slugs.index(p3.slug)
        assert all(slugs.index(s) < idx_p3 for s in (p1_a.slug, p1_b.slug))


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

    def test_invalid_priority_falls_back_to_all(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X", priority=HymnBook.Priority.P3)
        hymn_factory(hymn_book=hb, number=1)
        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_list"), {"priority": "XX"})
        assert any(b.slug == hb.slug for b in resp.context["hymnbooks"])


@pytest.mark.django_db
class TestMultiCriteriaSort:
    """Múltiplos sorts compõem em ordem de aparição na query string. Para
    isolar de `priority`, todos os testes filtram para um único grupo."""

    def test_single_audio_asc_orders_by_audio_pct(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        a = hymn_book_factory(name="A", priority=HymnBook.Priority.P1)
        hymn_factory(hymn_book=a, number=1)
        b = hymn_book_factory(name="B", priority=HymnBook.Priority.P1)
        hymn_factory(hymn_book=b, number=1)

        # Ambos com audio_pct=0 → name asc tie-break → A antes de B.
        resp = authenticated_client.get(
            reverse("hymns:editor_hymnbook_list"),
            {"priority": "P1", "sort": "audio:asc"},
        )
        slugs = [hb.slug for hb in resp.context["hymnbooks"]]
        assert slugs.index(a.slug) < slugs.index(b.slug)

    def test_review_asc_then_audio_asc_uses_first_as_primary(
        self, authenticated_client, hymn_book_factory, hymn_factory
    ):
        """Cliques mais antigos = sort primário. Empate em review_pct cai no audio_pct."""
        from apps.hymns.models import Hymn

        _make_editor(authenticated_client.user)
        # Dois P1 com review_pct distintos → primary sort decide.
        a = hymn_book_factory(name="A", priority=HymnBook.Priority.P1)
        h = hymn_factory(hymn_book=a, number=1)
        h.review_status = Hymn.ReviewStatus.REVIEWED
        h.save()
        b = hymn_book_factory(name="B", priority=HymnBook.Priority.P1)
        hymn_factory(hymn_book=b, number=1)  # review_pct=0

        resp = authenticated_client.get(
            reverse("hymns:editor_hymnbook_list"),
            {"priority": "P1", "sort": "review:asc,audio:asc"},
        )
        slugs = [hb.slug for hb in resp.context["hymnbooks"]]
        # review:asc → b (0%) vem antes de a (100%).
        assert slugs.index(b.slug) < slugs.index(a.slug)

    def test_comp_metric_sums_style_and_reps_pct(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        # `low_comp`: 1 hino, ambos vazios → comp_pct = 0
        low_comp = hymn_book_factory(name="Low", priority=HymnBook.Priority.P1)
        hymn_factory(hymn_book=low_comp, number=1)
        # `high_comp`: 1 hino, ambos preenchidos → style_pct=100, reps_pct=100 → soma 200
        high_comp = hymn_book_factory(name="High", priority=HymnBook.Priority.P1)
        hymn_factory(hymn_book=high_comp, number=1, style="Marcha", repetitions="1-4")

        resp = authenticated_client.get(
            reverse("hymns:editor_hymnbook_list"),
            {"priority": "P1", "sort": "comp:asc"},
        )
        slugs = [hb.slug for hb in resp.context["hymnbooks"]]
        assert slugs.index(low_comp.slug) < slugs.index(high_comp.slug)

    def test_invalid_sort_token_ignored_silently(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X", priority=HymnBook.Priority.P1)
        hymn_factory(hymn_book=hb, number=1)
        # `bogus:asc` é ignorado → cai no comportamento default.
        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_list"), {"sort": "bogus:asc"})
        assert resp.status_code == 200


@pytest.mark.django_db
class TestSortChipsContext:
    """Context expõe `sort_chips` prebuild com state + href de toggle."""

    def test_all_four_metrics_present(self, authenticated_client, hymn_book_factory):
        _make_editor(authenticated_client.user)
        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_list"))
        chips = resp.context["sort_chips"]
        keys = [c["key"] for c in chips]
        assert keys == ["review", "comp", "audio", "recent"]
        # Sem sort no querystring → todos off, sem position.
        for c in chips:
            assert c["state"] == "off"
            assert c["position"] is None

    def test_active_chip_has_position_only_when_multi(self, authenticated_client, hymn_book_factory):
        _make_editor(authenticated_client.user)
        # 1 ativo → position None (sem badge)
        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_list"), {"sort": "review:asc"})
        chips_by_key = {c["key"]: c for c in resp.context["sort_chips"]}
        assert chips_by_key["review"]["state"] == "asc"
        assert chips_by_key["review"]["position"] is None
        # 2+ ativos → position aparece
        resp = authenticated_client.get(
            reverse("hymns:editor_hymnbook_list"),
            {"sort": "review:asc,audio:desc"},
        )
        chips_by_key = {c["key"]: c for c in resp.context["sort_chips"]}
        assert chips_by_key["review"]["position"] == 1
        assert chips_by_key["audio"]["position"] == 2
        assert chips_by_key["comp"]["position"] is None

    def test_href_toggles_correctly(self, authenticated_client, hymn_book_factory):
        _make_editor(authenticated_client.user)
        # Estado: review:asc. Clicar em "review" → flip pra desc.
        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_list"), {"sort": "review:asc"})
        chips_by_key = {c["key"]: c for c in resp.context["sort_chips"]}
        assert (
            "sort=review%3Adesc" in chips_by_key["review"]["href"]
            or "sort=review:desc" in chips_by_key["review"]["href"]
        )
        # Clicar em "audio" (não ativo) → append como asc.
        assert "audio%3Aasc" in chips_by_key["audio"]["href"] or "audio:asc" in chips_by_key["audio"]["href"]

    def test_priority_chips_preserve_sort_in_href(self, authenticated_client, hymn_book_factory):
        _make_editor(authenticated_client.user)
        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_list"), {"sort": "review:asc"})
        priority_chips = resp.context["priority_chips"]
        p1_chip = next(c for c in priority_chips if c["value"] == "P1")
        assert "priority=P1" in p1_chip["href"]
        assert "review:asc" in p1_chip["href"] or "review%3Aasc" in p1_chip["href"]


@pytest.mark.django_db
class TestP1UrgentKPI:
    def test_kpi_counts_only_p1_visible_books(self, authenticated_client, hymn_book_factory):
        _make_editor(authenticated_client.user)
        hymn_book_factory(name="A", priority=HymnBook.Priority.P1)
        hymn_book_factory(name="B", priority=HymnBook.Priority.P1)
        hymn_book_factory(name="C", priority=HymnBook.Priority.P2)
        hymn_book_factory(name="D", priority=HymnBook.Priority.P3)

        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_list"))
        assert resp.context["stats"]["p1_count"] == 2
