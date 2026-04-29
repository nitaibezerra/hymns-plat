"""
Marco 1.5 — backend da fila do editor.

Endpoints sob `/editor/` que listam hinários por progresso de revisão,
hinos pendentes dentro do hinário, e expõem um formulário rápido de revisão
hino-a-hino com navegação "próximo não-revisado". Os templates aqui são
mínimos/provisórios — a Fase 2 (UI) os substitui.
"""

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse

from apps.hymns.models import Hymn


def _make_editor(user):
    user.groups.add(Group.objects.get(name="editor"))
    return user


def _set_status(hymn, status):
    Hymn.objects.filter(pk=hymn.pk).update(review_status=status)


@pytest.mark.django_db
class TestEditorHymnbookListView:
    def test_requires_login(self, client):
        resp = client.get(reverse("hymns:editor_hymnbook_list"))
        assert resp.status_code == 302
        assert "/accounts/login" in resp.url

    def test_random_user_forbidden(self, authenticated_client):
        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_list"))
        # Sem permissão de editor: redireciona para home, não vê fila.
        assert resp.status_code == 302

    def test_editor_sees_all_hymnbooks(self, authenticated_client, hymn_book_factory):
        _make_editor(authenticated_client.user)
        a = hymn_book_factory(name="A", is_published=False)
        b = hymn_book_factory(name="B", is_published=True)
        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_list"))
        assert resp.status_code == 200
        slugs = {hb.slug for hb in resp.context["hymnbooks"]}
        assert a.slug in slugs
        assert b.slug in slugs

    def test_owner_sees_own_hymnbooks(self, authenticated_client, hymn_book_factory):
        own = hymn_book_factory(name="Meu", owner_user=authenticated_client.user)
        hymn_book_factory(name="Alheio")
        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_list"))
        # Sem grupo editor mas dono de pelo menos um hinário → tem acesso.
        assert resp.status_code == 200
        slugs = {hb.slug for hb in resp.context["hymnbooks"]}
        assert own.slug in slugs

    def test_default_sort_least_reviewed_first(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        full = hymn_book_factory(name="Full")
        h = hymn_factory(hymn_book=full, number=1)
        _set_status(h, Hymn.ReviewStatus.REVIEWED)

        empty_progress = hymn_book_factory(name="Empty progress")
        hymn_factory(hymn_book=empty_progress, number=1)

        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_list"))
        slugs = [hb.slug for hb in resp.context["hymnbooks"]]
        assert slugs.index(empty_progress.slug) < slugs.index(full.slug)

    def test_supports_most_reviewed_sort(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        full = hymn_book_factory(name="Full")
        h = hymn_factory(hymn_book=full, number=1)
        _set_status(h, Hymn.ReviewStatus.REVIEWED)
        empty_progress = hymn_book_factory(name="Empty progress")
        hymn_factory(hymn_book=empty_progress, number=1)

        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_list"), {"sort": "most_reviewed"})
        slugs = [hb.slug for hb in resp.context["hymnbooks"]]
        assert slugs.index(full.slug) < slugs.index(empty_progress.slug)


@pytest.mark.django_db
class TestEditorHymnbookDetailView:
    def test_lists_hymns_in_order(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X")
        h2 = hymn_factory(hymn_book=hb, number=2, title="t2")
        h1 = hymn_factory(hymn_book=hb, number=1, title="t1")
        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_detail", kwargs={"slug": hb.slug}))
        assert resp.status_code == 200
        ordered = list(resp.context["hymns"])
        assert ordered == [h1, h2]


@pytest.mark.django_db
class TestEditorNextHymnView:
    def test_redirects_to_lowest_numbered_unreviewed(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X")
        h1 = hymn_factory(hymn_book=hb, number=1, title="t1")
        h2 = hymn_factory(hymn_book=hb, number=2, title="t2")
        h3 = hymn_factory(hymn_book=hb, number=3, title="t3")
        _set_status(h1, Hymn.ReviewStatus.REVIEWED)
        _set_status(h3, Hymn.ReviewStatus.REVIEWED)

        resp = authenticated_client.get(reverse("hymns:editor_next_hymn", kwargs={"slug": hb.slug}))
        assert resp.status_code == 302
        assert resp.url == reverse("hymns:editor_revise_hymn", kwargs={"pk": h2.pk})

    def test_redirects_to_detail_when_done(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X")
        h = hymn_factory(hymn_book=hb, number=1)
        _set_status(h, Hymn.ReviewStatus.REVIEWED)

        resp = authenticated_client.get(reverse("hymns:editor_next_hymn", kwargs={"slug": hb.slug}))
        assert resp.status_code == 302
        assert reverse("hymns:editor_hymnbook_detail", kwargs={"slug": hb.slug}) in resp.url


@pytest.mark.django_db
class TestEditorReviseHymnView:
    def test_get_renders_form_for_editor(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X")
        h = hymn_factory(hymn_book=hb, number=1, title="T", text="L")
        resp = authenticated_client.get(reverse("hymns:editor_revise_hymn", kwargs={"pk": h.pk}))
        assert resp.status_code == 200
        assert resp.context["hymn"] == h

    def test_post_save_and_next_redirects_to_next_hymn(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X")
        h1 = hymn_factory(hymn_book=hb, number=1, title="t1", text="x1")
        h2 = hymn_factory(hymn_book=hb, number=2, title="t2", text="x2")

        resp = authenticated_client.post(
            reverse("hymns:editor_revise_hymn", kwargs={"pk": h1.pk}),
            {
                "number": 1,
                "title": "t1-rev",
                "text": "x1-rev",
                "review_status": Hymn.ReviewStatus.REVIEWED,
                "next_action": "next",
            },
        )
        assert resp.status_code == 302
        assert resp.url == reverse("hymns:editor_revise_hymn", kwargs={"pk": h2.pk})
        h1.refresh_from_db()
        assert h1.review_status == Hymn.ReviewStatus.REVIEWED

    def test_post_save_no_next_redirects_to_book_detail(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X")
        h = hymn_factory(hymn_book=hb, number=1)
        resp = authenticated_client.post(
            reverse("hymns:editor_revise_hymn", kwargs={"pk": h.pk}),
            {
                "number": 1,
                "title": "n",
                "text": "n",
                "review_status": Hymn.ReviewStatus.REVIEWED,
                "next_action": "back",
            },
        )
        assert resp.status_code == 302
        assert resp.url == reverse("hymns:editor_hymnbook_detail", kwargs={"slug": hb.slug})

    def test_random_user_forbidden(self, authenticated_client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="X")
        h = hymn_factory(hymn_book=hb, number=1)
        resp = authenticated_client.get(reverse("hymns:editor_revise_hymn", kwargs={"pk": h.pk}))
        assert resp.status_code == 302

    def test_autosave_returns_json(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X")
        h = hymn_factory(hymn_book=hb, number=1, title="orig", text="orig")
        resp = authenticated_client.post(
            reverse("hymns:editor_revise_hymn", kwargs={"pk": h.pk}),
            {
                "number": 1,
                "title": "novo title",
                "text": "novo texto",
                "review_status": Hymn.ReviewStatus.IN_REVIEW,
                "autosave": "1",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert "saved_at" in data
        h.refresh_from_db()
        assert h.title == "novo title"

    def test_revise_page_renders_diff_when_ocr_text_present(
        self, authenticated_client, hymn_book_factory, hymn_factory
    ):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X")
        h = hymn_factory(hymn_book=hb, number=1, title="t", text="atual", ocr_text="OCR cru")
        resp = authenticated_client.get(reverse("hymns:editor_revise_hymn", kwargs={"pk": h.pk}))
        # diff_lines deve ter pelo menos 1 entrada (linhas diferentes)
        assert resp.context["diff_lines"]
