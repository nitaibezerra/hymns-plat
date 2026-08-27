"""
`HymnType.revisions` é trilha de auditoria editorial — exige papel de editor.

A régua é o Django, fonte de verdade de produto até o Marco 7. O histórico de
revisões de um hino tem UMA porta lá: `hymns:hymn_history` →
`apps/hymns/views.py::hymn_history_view`, que é `@login_required` **e** redireciona
quem não passa em `can_edit_hymnbook` (== `_is_editor_or_admin`). O drawer que
ela renderiza (`templates/hymns/_partials/_history_drawer.html`) é o único lugar
do monolito que mostra `field_diff`, `previous_status` e `new_status`; o botão
"Histórico de revisões" no detalhe do hino só aparece sob `{% if can_edit %}`.

A API entregava a trilha inteira pra anônimo: `revisions` não tinha gate nenhum,
e `HymnRevisionType.fieldDiff` é o snapshot `{campo: {old, new}}` de cada edição —
o texto anterior de cada hino, quem editou, e a transição de status. Terceiro
vazamento do mesmo padrão do Marco 5: cobertura de permissão nas mutations,
lado de leitura sem a mesma disciplina.

O que NÃO fecha aqui, de propósito: `/perfil/<u>/` é público e mostra
`recent_revisions` com `change_summary` + `revised_at` + hino/hinário
(`apps/users/views.py::profile_view`). É uma agregação POR USUÁRIO, não o
histórico por hino, e `UserProfileType` não tem campo equivalente na API — nada
a apertar, e nada a abrir.
"""

from __future__ import annotations

import pytest
from django.contrib.auth.models import Group

from apps.api.errors import AUTHENTICATION_REQUIRED_PREFIX, PERMISSION_DENIED_MESSAGE
from apps.hymns.models import Hymn, HymnRevision

from ._helpers import gql

pytestmark = pytest.mark.django_db

REVISIONS_QUERY = """
query($pk: ID!) {
  hymn(pk: $pk) {
    revisions {
      previousStatus
      newStatus
      changeSummary
      fieldDiff
      revisedBy { username }
    }
  }
}
"""

PUBLIC_QUERY = """
query($pk: ID!) {
  hymn(pk: $pk) {
    number
    title
    body
    receivedAt
    lastReviewedAt
    lastReviewedBy { username }
  }
}
"""


@pytest.fixture
def hymn_with_revision(user_factory, hymn_book_factory, hymn_factory):
    """Hino publicado com UMA revisão que carrega diff de texto."""
    reviser = user_factory(email="reviser@example.com")
    book = hymn_book_factory(name="O Cruzeiro", slug="cruzeiro", is_published=True)
    hymn = hymn_factory(hymn_book=book, number=1, title="Lua Branca", text="Lua branca revisada")
    HymnRevision.objects.filter(hymn=hymn).delete()
    HymnRevision.objects.create(
        hymn=hymn,
        revised_by=reviser,
        previous_status=Hymn.ReviewStatus.NOT_REVIEWED,
        new_status=Hymn.ReviewStatus.REVIEWED,
        change_summary="Corrigi a segunda estrofe",
        field_diff={"text": {"old": "Lua branka", "new": "Lua branca revisada"}},
    )
    return hymn


def _revisions(client, hymn):
    return gql(client, REVISIONS_QUERY, variables={"pk": str(hymn.pk)})


def test_anon_gets_authentication_error_not_the_audit_trail(client, hymn_with_revision):
    """Anônimo bate no `@login_required` do Django — erro, não lista."""
    data = _revisions(client, hymn_with_revision)
    assert "errors" in data, data
    assert AUTHENTICATION_REQUIRED_PREFIX.lower() in data["errors"][0]["message"].lower(), data["errors"]
    assert "Lua branka" not in str(data), "fieldDiff vazou o texto anterior"


def test_authenticated_non_editor_gets_permission_denied(client, hymn_with_revision, user_factory):
    """Estar logado não basta: a view do Django exige `can_edit_hymnbook`."""
    comum = user_factory(email="comum@example.com")
    data = gql(client, REVISIONS_QUERY, variables={"pk": str(hymn_with_revision.pk)}, user=comum)
    assert "errors" in data, data
    assert data["errors"][0]["message"] == PERMISSION_DENIED_MESSAGE, data["errors"]
    assert "Lua branka" not in str(data), "fieldDiff vazou o texto anterior"


def test_editor_reads_the_full_trail(editor_client, hymn_with_revision):
    """Quem abre o drawer no Django lê tudo aqui também — diff incluído."""
    data = _revisions(editor_client, hymn_with_revision)
    assert "errors" not in data, data
    rows = data["data"]["hymn"]["revisions"]
    assert len(rows) == 1, rows
    assert rows[0] == {
        "previousStatus": Hymn.ReviewStatus.NOT_REVIEWED,
        "newStatus": Hymn.ReviewStatus.REVIEWED,
        "changeSummary": "Corrigi a segunda estrofe",
        "fieldDiff": {"text": {"old": "Lua branka", "new": "Lua branca revisada"}},
        "revisedBy": {"username": "reviser"},
    }


def test_superuser_reads_the_full_trail(client, hymn_with_revision, user_factory):
    """Superuser passa em `_is_editor_or_admin` sem precisar do grupo."""
    admin = user_factory(email="root@example.com")
    admin.is_superuser = True
    admin.save()
    data = gql(client, REVISIONS_QUERY, variables={"pk": str(hymn_with_revision.pk)}, user=admin)
    assert "errors" not in data, data
    assert len(data["data"]["hymn"]["revisions"]) == 1, data


def test_group_editor_reads_the_trail(client, hymn_with_revision, user_factory):
    """A régua é `can_review_any_hymnbook`, que o grupo `editor` carrega."""
    user = user_factory(email="perm@example.com")
    user.groups.add(Group.objects.get(name="editor"))
    data = gql(client, REVISIONS_QUERY, variables={"pk": str(hymn_with_revision.pk)}, user=user)
    assert "errors" not in data, data
    assert len(data["data"]["hymn"]["revisions"]) == 1, data


def test_public_hymn_fields_did_not_regress(client, hymn_with_revision):
    """O caminho público do hino segue intacto pra anônimo — o gate é do campo.

    `lastReviewedBy`/`lastReviewedAt` continuam públicos: o
    `templates/hymns/hymn_detail.html` mostra os dois a qualquer visitante
    ("Última revisão · <username> · <data>"), sem `{% if can_edit %}`.
    """
    data = gql(client, PUBLIC_QUERY, variables={"pk": str(hymn_with_revision.pk)})
    assert "errors" not in data, data
    row = data["data"]["hymn"]
    assert row["number"] == 1
    assert row["title"] == "Lua Branca"
    assert row["body"] == "Lua branca revisada"
