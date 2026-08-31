"""
Fase 3 da paridade visual — `_plan/plano-paridade-visual-spa.md`.

`Query.editorPendingBookCount` é o número do badge da CTA "Fila de revisão" no
header. O monolito o pega do context processor
`apps.hymns.context_processors.editor_workspace`; o shell SvelteKit não tinha
de onde pegar, então o badge não existia — e ele aparece nas três rotas que a
suíte de paridade captura com sessão de editor.

O ponto mais importante aqui é o que o resolver NÃO faz: não levanta para
anônimo. Quem o consome é o layout global do shell, em toda página. Um
`errors` no GraphQL derrubaria o header inteiro para visitante anônimo — o caso
mais comum do site.
"""

from __future__ import annotations

import pytest

from apps.hymns.context_processors import editor_workspace

from ._helpers import gql

pytestmark = pytest.mark.django_db

QUERY = "{ editorPendingBookCount }"


def _count(client) -> int:
    data = gql(client, QUERY)
    assert "errors" not in data, data
    return data["data"]["editorPendingBookCount"]


def test_anonimo_recebe_zero_e_nao_erro(client):
    data = gql(client, QUERY)
    assert "errors" not in data, data
    assert data["data"]["editorPendingBookCount"] == 0


def test_usuario_comum_recebe_zero_e_nao_erro(authenticated_client):
    assert _count(authenticated_client) == 0


def test_conta_hinarios_com_hino_pendente(editor_client, hymn_book_factory, hymn_factory):
    com_pendente = hymn_book_factory(name="Com Pendente", slug="com-pendente", is_published=True)
    hymn_factory(hymn_book=com_pendente, number=1, title="Pendente", review_status="not_reviewed")

    todo_revisado = hymn_book_factory(name="Revisado", slug="revisado", is_published=True)
    hymn_factory(hymn_book=todo_revisado, number=1, title="Ok", review_status="reviewed")

    # Conta HINÁRIOS, não hinos: 1, não 2.
    assert _count(editor_client) == 1


def test_hinario_com_varios_pendentes_conta_uma_vez(editor_client, hymn_book_factory, hymn_factory):
    hb = hymn_book_factory(name="Vários", slug="varios", is_published=True)
    for numero in (1, 2, 3):
        hymn_factory(hymn_book=hb, number=numero, title=f"Hino {numero}", review_status="not_reviewed")

    assert _count(editor_client) == 1


def test_hinario_vazio_nao_conta(editor_client, hymn_book_factory):
    hymn_book_factory(name="Vazio", slug="vazio", is_published=True)
    assert _count(editor_client) == 0


def test_bate_com_o_numero_do_context_processor(rf, editor_client, hymn_book_factory, hymn_factory):
    """Uma fonte de verdade: o badge do monolito e o da SPA são o mesmo número.

    Se estes dois divergirem, o usuário vê contagens diferentes em
    `hinaria.com.br` e em `beta.hinaria.com.br` — que é exatamente o tipo de
    divergência que a paridade visual existe pra impedir.
    """
    hb = hymn_book_factory(name="Com Pendente", slug="com-pendente", is_published=True)
    hymn_factory(hymn_book=hb, number=1, title="Pendente", review_status="not_reviewed")

    request = rf.get("/")
    request.user = editor_client.user
    do_monolito = editor_workspace(request)["editor_pending_count"]

    assert _count(editor_client) == do_monolito
