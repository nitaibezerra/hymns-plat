"""View `editor_next_incomplete` — porta de entrada da "Revisão básica".

Redireciona para o `editor_quick_review` apontado no primeiro hino com
`style=""` OU `repetitions=""`. Se todos têm os dois campos preenchidos,
volta para o detail editorial com mensagem flash.
"""

from __future__ import annotations

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse


def _make_editor(user):
    user.groups.add(Group.objects.get(name="editor"))
    return user


@pytest.mark.django_db
class TestEditorNextIncomplete:
    def test_requires_login(self, client, hymn_book_factory):
        hb = hymn_book_factory()
        url = reverse("hymns:editor_next_incomplete", kwargs={"slug": hb.slug})
        resp = client.get(url)
        assert resp.status_code == 302
        assert "/accounts/login" in resp.url

    def test_non_editor_redirected_to_home(self, authenticated_client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory()
        hymn_factory(hymn_book=hb, number=1, style="", repetitions="")
        url = reverse("hymns:editor_next_incomplete", kwargs={"slug": hb.slug})
        resp = authenticated_client.get(url)
        # Sem perm de editor → padrão das demais editor views
        assert resp.status_code == 302
        # Não cai no quick_review
        assert "agil" not in resp.url

    def test_redirects_to_first_incomplete_by_number(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory()
        # h1 completo, h2 sem style, h3 sem repetitions, h4 completo, h5 totalmente vazio
        hymn_factory(hymn_book=hb, number=1, style="Marcha", repetitions="1-2,3-4")
        hymn_factory(hymn_book=hb, number=2, style="", repetitions="1-4")
        hymn_factory(hymn_book=hb, number=3, style="Valsa", repetitions="")
        hymn_factory(hymn_book=hb, number=4, style="Mazurca", repetitions="1-4")
        hymn_factory(hymn_book=hb, number=5, style="", repetitions="")

        url = reverse("hymns:editor_next_incomplete", kwargs={"slug": hb.slug})
        resp = authenticated_client.get(url)
        assert resp.status_code == 302
        # Pula para h2 — primeiro com style="" OU repetitions=""
        quick_url = reverse("hymns:editor_quick_review", kwargs={"slug": hb.slug})
        assert resp.url == f"{quick_url}?h=2"

    def test_redirects_to_detail_when_all_complete(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory()
        for n in (1, 2, 3):
            hymn_factory(hymn_book=hb, number=n, style="Marcha", repetitions="1-4")

        url = reverse("hymns:editor_next_incomplete", kwargs={"slug": hb.slug})
        resp = authenticated_client.get(url)
        assert resp.status_code == 302
        # Sem incompletos → volta pro detail
        assert resp.url == reverse("hymns:editor_hymnbook_detail", kwargs={"slug": hb.slug})

    def test_redirects_to_detail_for_empty_hymnbook(self, authenticated_client, hymn_book_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="Vazio")
        url = reverse("hymns:editor_next_incomplete", kwargs={"slug": hb.slug})
        resp = authenticated_client.get(url)
        # Hinário sem hinos: incomplete=None → volta pro detail
        assert resp.status_code == 302
        assert resp.url == reverse("hymns:editor_hymnbook_detail", kwargs={"slug": hb.slug})

    def test_unknown_slug_returns_404(self, authenticated_client):
        _make_editor(authenticated_client.user)
        url = reverse("hymns:editor_next_incomplete", kwargs={"slug": "inexistente"})
        resp = authenticated_client.get(url)
        assert resp.status_code == 404
