"""
Tela 07c · Revisão ágil · Estilo & Repetições.

Cobre o backend da tela `editor_quick_review`: GET monta navegação
(prev/current/next, position/total) e POST atualiza apenas `style` e
`repetitions` sem tocar em `review_status`/`last_reviewed_*`.
"""

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse

from apps.hymns.models import Hymn, HymnRevision


def _make_editor(user):
    user.groups.add(Group.objects.get(name="editor"))
    return user


@pytest.mark.django_db
class TestEditorQuickReviewGET:
    def test_requires_login(self, client, hymn_book_factory):
        hb = hymn_book_factory()
        url = reverse("hymns:editor_quick_review", kwargs={"slug": hb.slug})
        resp = client.get(url)
        assert resp.status_code == 302
        assert "/accounts/login" in resp.url

    def test_random_user_forbidden(self, authenticated_client, hymn_book_factory):
        hb = hymn_book_factory()
        url = reverse("hymns:editor_quick_review", kwargs={"slug": hb.slug})
        resp = authenticated_client.get(url)
        # Sem permissão de editor → redireciona pra home (mesmo padrão das demais editor views).
        assert resp.status_code == 302

    def test_editor_gets_200_with_first_hymn_default(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="O Cruzeiro")
        h1 = hymn_factory(hymn_book=hb, number=1, title="Lua Branca")
        h2 = hymn_factory(hymn_book=hb, number=2, title="Vou Cantar")
        url = reverse("hymns:editor_quick_review", kwargs={"slug": hb.slug})
        resp = authenticated_client.get(url)
        assert resp.status_code == 200
        ctx = resp.context
        assert ctx["current_hymn"].pk == h1.pk
        assert ctx["next_hymn"].pk == h2.pk
        assert ctx["prev_hymn"] is None
        assert ctx["position"] == 1
        assert ctx["total"] == 2

    def test_h_query_param_selects_specific_hymn(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory()
        hymn_factory(hymn_book=hb, number=1, title="A")
        h2 = hymn_factory(hymn_book=hb, number=2, title="B")
        h3 = hymn_factory(hymn_book=hb, number=3, title="C")
        url = reverse("hymns:editor_quick_review", kwargs={"slug": hb.slug})
        resp = authenticated_client.get(url, {"h": 2})
        assert resp.status_code == 200
        assert resp.context["current_hymn"].pk == h2.pk
        assert resp.context["next_hymn"].pk == h3.pk
        assert resp.context["prev_hymn"].number == 1
        assert resp.context["position"] == 2

    def test_invalid_h_falls_back_to_first(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory()
        h1 = hymn_factory(hymn_book=hb, number=1)
        url = reverse("hymns:editor_quick_review", kwargs={"slug": hb.slug})
        resp = authenticated_client.get(url, {"h": 999})
        assert resp.status_code == 200
        assert resp.context["current_hymn"].pk == h1.pk

    def test_unknown_slug_404(self, authenticated_client):
        _make_editor(authenticated_client.user)
        # slug='whatever' não existe → 404
        from django.urls import NoReverseMatch

        try:
            url = reverse("hymns:editor_quick_review", kwargs={"slug": "whatever"})
        except NoReverseMatch:
            pytest.skip("URL pattern not yet wired")
        resp = authenticated_client.get(url)
        assert resp.status_code == 404

    def test_empty_hymnbook_redirects(self, authenticated_client, hymn_book_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="Empty")
        url = reverse("hymns:editor_quick_review", kwargs={"slug": hb.slug})
        resp = authenticated_client.get(url)
        # Sem hinos: volta pra detail (lá tem o estado vazio decente).
        assert resp.status_code == 302


@pytest.mark.django_db
class TestEditorQuickReviewPOST:
    def _setup(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="O Cruzeiro")
        h1 = hymn_factory(hymn_book=hb, number=1, title="Lua Branca", style="", repetitions="")
        h2 = hymn_factory(hymn_book=hb, number=2, title="Vou Cantar")
        return hb, h1, h2

    def test_post_updates_style_and_repetitions(self, authenticated_client, hymn_book_factory, hymn_factory):
        hb, h1, h2 = self._setup(authenticated_client, hymn_book_factory, hymn_factory)
        url = reverse("hymns:editor_quick_review", kwargs={"slug": hb.slug})
        resp = authenticated_client.post(url + "?h=1", {"style": "Valsa", "repetitions": "1-4"})
        h1.refresh_from_db()
        assert h1.style == "Valsa"
        assert h1.repetitions == "1-4"
        # Redireciona pro próximo
        assert resp.status_code == 302
        assert "h=2" in resp.url

    def test_post_does_not_change_review_status(self, authenticated_client, hymn_book_factory, hymn_factory):
        hb, h1, _ = self._setup(authenticated_client, hymn_book_factory, hymn_factory)
        Hymn.objects.filter(pk=h1.pk).update(
            review_status=Hymn.ReviewStatus.IN_REVIEW, last_reviewed_by=None, last_reviewed_at=None
        )
        h1.refresh_from_db()
        url = reverse("hymns:editor_quick_review", kwargs={"slug": hb.slug})
        authenticated_client.post(url + "?h=1", {"style": "Marcha", "repetitions": "1-2,3-4"})
        h1.refresh_from_db()
        assert h1.review_status == Hymn.ReviewStatus.IN_REVIEW
        assert h1.last_reviewed_at is None
        assert h1.last_reviewed_by is None

    def test_post_creates_hymn_revision(self, authenticated_client, hymn_book_factory, hymn_factory):
        hb, h1, _ = self._setup(authenticated_client, hymn_book_factory, hymn_factory)
        before = HymnRevision.objects.filter(hymn=h1).count()
        url = reverse("hymns:editor_quick_review", kwargs={"slug": hb.slug})
        authenticated_client.post(url + "?h=1", {"style": "Mazurca", "repetitions": "3-4,1-4"})
        after_qs = HymnRevision.objects.filter(hymn=h1).order_by("-revised_at")
        assert after_qs.count() > before
        # `field_diff` capturou só os 2 campos (signal já filtra).
        latest = after_qs.first()
        diff_keys = set(latest.field_diff.keys()) if latest.field_diff else set()
        assert "style" in diff_keys
        assert "repetitions" in diff_keys

    def test_post_at_last_hymn_wraps_to_earlier_incomplete(self, authenticated_client, hymn_book_factory, hymn_factory):
        """Fase 2.x: o save+next agora pula pro próximo *incompleto* com
        wrap-around — quando o último hino é salvo mas algum anterior ainda
        está incompleto, redireciona para ele (não para o detail)."""
        hb, h1, h2 = self._setup(authenticated_client, hymn_book_factory, hymn_factory)
        # h1 nasce vazio (style="" e repetitions="") no _setup.
        url = reverse("hymns:editor_quick_review", kwargs={"slug": hb.slug})
        # POST no último hino (h2), deixando reps="" → h2 segue incompleto também,
        # mas como excluímos pk atual, o único restante é h1.
        resp = authenticated_client.post(url + "?h=2", {"style": "Valsa", "repetitions": ""})
        assert resp.status_code == 302
        # Wrap-around → h1 (primeiro incompleto restante).
        assert "h=1" in resp.url

    def test_post_at_last_hymn_redirects_to_detail_when_no_other_incomplete(
        self, authenticated_client, hymn_book_factory, hymn_factory
    ):
        """Quando o save resolve o último incompleto (todos completos),
        redireciona para o detail editorial com mensagem."""
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="Quase pronto")
        hymn_factory(hymn_book=hb, number=1, style="Marcha", repetitions="1-4")
        h2 = hymn_factory(hymn_book=hb, number=2, style="", repetitions="1-4")
        url = reverse("hymns:editor_quick_review", kwargs={"slug": hb.slug})
        resp = authenticated_client.post(url + "?h=2", {"style": "Valsa", "repetitions": "1-4"})
        h2.refresh_from_db()
        assert h2.style == "Valsa"
        assert resp.status_code == 302
        assert resp.url == reverse("hymns:editor_hymnbook_detail", kwargs={"slug": hb.slug})

    def test_post_ignores_extraneous_fields(self, authenticated_client, hymn_book_factory, hymn_factory):
        """POST tentando alterar `text` ou `review_status` é ignorado — defesa via Form.fields."""
        hb, h1, _ = self._setup(authenticated_client, hymn_book_factory, hymn_factory)
        original_text = h1.text
        url = reverse("hymns:editor_quick_review", kwargs={"slug": hb.slug})
        authenticated_client.post(
            url + "?h=1",
            {
                "style": "Valsa",
                "repetitions": "1-4",
                "text": "Texto adulterado",
                "review_status": Hymn.ReviewStatus.REVIEWED,
                "title": "Adulterado",
            },
        )
        h1.refresh_from_db()
        assert h1.style == "Valsa"
        assert h1.text == original_text
        assert h1.title == "Lua Branca"
        assert h1.review_status != Hymn.ReviewStatus.REVIEWED

    def test_non_editor_post_forbidden(self, authenticated_client, hymn_book_factory, hymn_factory):
        # Sem _make_editor — usuário comum
        hb = hymn_book_factory()
        h1 = hymn_factory(hymn_book=hb, number=1, style="")
        url = reverse("hymns:editor_quick_review", kwargs={"slug": hb.slug})
        resp = authenticated_client.post(url + "?h=1", {"style": "Valsa", "repetitions": ""})
        h1.refresh_from_db()
        assert h1.style == ""  # nada gravado
        assert resp.status_code == 302  # redirect para home
