"""
Navegação editorial pós-design Fase 2:
- Linha-toda-clicável na fila (`/editor/hinarios/`).
- Botão "⚡ Revisão ágil" por linha na fila.
- Botão "⚡ Revisão ágil" no header da tela do hinário.
"""

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse


def _make_editor(user):
    user.groups.add(Group.objects.get(name="editor"))
    return user


@pytest.mark.django_db
class TestEditorHymnbookListNavigation:
    def test_row_is_clickable_link_to_detail(self, authenticated_client, hymn_book_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="O Justiceiro")
        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_list"))
        assert resp.status_code == 200
        body = resp.content.decode()
        detail_url = reverse("hymns:editor_hymnbook_detail", kwargs={"slug": hb.slug})
        # A linha do hinário precisa ter um link explícito para a tela de detail
        # editorial (não só um prefixo coincidente de outra URL).
        assert f'href="{detail_url}"' in body

    def test_quick_review_button_per_row(self, authenticated_client, hymn_book_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="O Justiceiro")
        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_list"))
        body = resp.content.decode()
        quick_url = reverse("hymns:editor_quick_review", kwargs={"slug": hb.slug})
        assert quick_url in body
        assert "Revisão ágil" in body


@pytest.mark.django_db
class TestEditorHymnbookDetailNavigation:
    def test_quick_review_button_in_header(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="O Justiceiro")
        hymn_factory(hymn_book=hb, number=1)
        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_detail", kwargs={"slug": hb.slug}))
        assert resp.status_code == 200
        body = resp.content.decode()
        quick_url = reverse("hymns:editor_quick_review", kwargs={"slug": hb.slug})
        assert quick_url in body
        assert "Revisão ágil" in body
