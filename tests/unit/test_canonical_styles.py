"""Estilos canônicos do Santo Daime — sempre 3 pílulas no editor.

Antes, `common_styles` no editor de revisão derivava dos estilos JÁ usados
no hinário (top-3 por contagem). Em hinários novos isso virava 1 ou 0
pílulas — o usuário tinha que digitar livre. Agora oferecemos sempre as
três opções canônicas (Marcha, Valsa, Mazurca) — o helper de top-N segue
existindo para `common_repetitions`, que é genuinamente por-hinário.
"""

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse


@pytest.fixture
def editor_group(db):
    group, _ = Group.objects.get_or_create(name="editor")
    return group


@pytest.mark.django_db
def test_hymn_exposes_canonical_styles_constant():
    from apps.hymns.models import Hymn

    assert list(Hymn.CANONICAL_STYLES) == ["Marcha", "Valsa", "Mazurca"]


@pytest.mark.django_db
def test_editor_revise_offers_three_canonical_styles(authenticated_client, hymn_book, hymn_factory, editor_group):
    authenticated_client.user.groups.add(editor_group)
    hymn = hymn_factory(hymn_book=hymn_book, number=1, style="")

    resp = authenticated_client.get(reverse("hymns:editor_revise_hymn", kwargs={"pk": hymn.pk}))

    assert resp.status_code == 200
    assert list(resp.context["common_styles"]) == ["Marcha", "Valsa", "Mazurca"]


@pytest.mark.django_db
def test_editor_revise_styles_independent_of_existing_book_data(
    authenticated_client, hymn_book, hymn_factory, editor_group
):
    """Mesmo se o hinário já tem só 1 estilo cadastrado, as 3 pílulas devem aparecer."""
    authenticated_client.user.groups.add(editor_group)
    hymn_factory(hymn_book=hymn_book, number=1, style="Marcha")
    hymn = hymn_factory(hymn_book=hymn_book, number=2, style="Marcha")

    resp = authenticated_client.get(reverse("hymns:editor_revise_hymn", kwargs={"pk": hymn.pk}))

    assert list(resp.context["common_styles"]) == ["Marcha", "Valsa", "Mazurca"]


# ---------------------------------------------------------------------------
# Repetições canônicas — 5 padrões fixos, idem aos estilos
# ---------------------------------------------------------------------------


CANONICAL_REPETITIONS = ["1-2,3-4", "1-2,3-4,1-4", "1-4", "3-4,1-4", "1-2,1-4"]


@pytest.mark.django_db
def test_hymn_exposes_canonical_repetitions_constant():
    from apps.hymns.models import Hymn

    assert list(Hymn.CANONICAL_REPETITIONS) == CANONICAL_REPETITIONS


@pytest.mark.django_db
def test_editor_revise_offers_canonical_repetitions(authenticated_client, hymn_book, hymn_factory, editor_group):
    authenticated_client.user.groups.add(editor_group)
    hymn = hymn_factory(hymn_book=hymn_book, number=1, repetitions="")

    resp = authenticated_client.get(reverse("hymns:editor_revise_hymn", kwargs={"pk": hymn.pk}))

    assert resp.status_code == 200
    assert list(resp.context["common_repetitions"]) == CANONICAL_REPETITIONS


@pytest.mark.django_db
def test_canonical_repetitions_independent_of_book_data(authenticated_client, hymn_book, hymn_factory, editor_group):
    """Mesmo se o hinário tem padrões exóticos cadastrados, as 5 pílulas fixas aparecem."""
    authenticated_client.user.groups.add(editor_group)
    hymn_factory(hymn_book=hymn_book, number=1, repetitions="custom-pattern-1")
    hymn = hymn_factory(hymn_book=hymn_book, number=2, repetitions="custom-pattern-2")

    resp = authenticated_client.get(reverse("hymns:editor_revise_hymn", kwargs={"pk": hymn.pk}))

    assert list(resp.context["common_repetitions"]) == CANONICAL_REPETITIONS
