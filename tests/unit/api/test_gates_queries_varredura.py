"""
Frente B · varredura dos gates de query — a auditoria virada em teste.

Contexto: três vazamentos de LEITURA apareceram no mesmo dia, todos pela mesma
causa. O Marco 5 cobriu permissão nas MUTATIONS (todas testadas) e o lado de
leitura ficou sem essa disciplina — `strawberry.auto` e resolver sem gate
expõem POR OMISSÃO. Uma varredura manual conserta o que existe hoje; não
impede a próxima query de nascer aberta.

Este arquivo é a varredura executável. `VARREDURA` é o inventário: cada campo
de `Query` com o regime que ele deve aplicar ao anônimo e a régua Django que
justifica esse regime — porque a régua é sempre o Django, fonte de verdade de
produto até o Marco 7.

Dois tipos de teste, e o primeiro é o que muda o jogo:

1. `test_inventario_cobre_toda_a_query` compara o inventário com o schema VIVO.
   Adicionar um campo a `Query` sem classificar o gate deixa a suíte vermelha —
   a decisão passa a ser obrigatória e explícita, em vez de omissão silenciosa.
2. os testes de regime provam o comportamento do anônimo em cada campo.

Regimes, e por que três e não dois:

- `publico`: o anônimo NÃO recebe erro. A visibilidade mora dentro do resolver
  (`HymnBook.objects.visible_to(user)`), e cada caso tem teste próprio
  (`test_query_hymnbooks.py`, `test_query_hymn.py`, `test_query_search.py`,
  `test_hourly_featured.py`) — a régua é a view pública equivalente.
- `nulo-para-anonimo`: o campo é nullable e o gate devolve `null`. É o regime
  certo quando responder com erro de permissão VAZARIA a existência do recurso
  (uma OCRTask alheia, um hinário que o visitante não pode publicar).
- `erro-para-anonimo`: o retorno é lista/objeto não-nulável, não há posição no
  schema pra um union de erro, então o gate levanta `GraphQLError` com uma das
  duas mensagens PT-BR canônicas — as que o shell classifica pra redirecionar
  pro login.
"""

from __future__ import annotations

import re
import uuid

import pytest

from apps.api.errors import AUTHENTICATION_REQUIRED_PREFIX, PERMISSION_DENIED_MESSAGE
from apps.api.schema import schema

from ._helpers import gql

PUBLICO = "publico"
NULO = "nulo-para-anonimo"
ERRO = "erro-para-anonimo"

# campo -> (regime, query mínima, régua Django que justifica o regime)
VARREDURA: dict[str, tuple[str, str, str]] = {
    "hymnbooks": (
        PUBLICO,
        "{ hymnbooks { slug isPublished } }",
        "HymnBookListView é pública e filtra por visible_to — mesma regra aqui.",
    ),
    "hymnbook": (
        PUBLICO,
        '{ hymnbook(slug: "rascunho") { slug } }',
        "HymnBookReadView usa visible_to. HymnBookDetailView NÃO filtra (Django "
        "mais permissivo: serve rascunho a anônimo) — anotado, não seguido.",
    ),
    "hymn": (
        PUBLICO,
        '{ hymn(pk: "{hymn_rascunho}") { title } }',
        "HymnDetailView NÃO filtra por visibilidade (Django mais permissivo). A "
        "API é mais restrita de propósito: hino de rascunho não vem pelo pk.",
    ),
    "currentUser": (
        NULO,
        "{ currentUser { id username } }",
        "Self-read: sem sessão não há usuário corrente. `null`, não erro.",
    ),
    "userProfile": (
        PUBLICO,
        '{ userProfile(username: "dono") { followersCount followingCount } }',
        "users/views.py::profile_view é pública (sem @login_required).",
    ),
    "notifications": (
        ERRO,
        "{ notifications { id } }",
        "views_social.py::notifications_list é @login_required.",
    ),
    "hourlyFeatured": (
        PUBLICO,
        "{ hourlyFeatured { slug isPublished } }",
        "home_view é pública e passa visible_to pro mesmo featured.hourly_featured.",
    ),
    "search": (
        PUBLICO,
        '{ search(q: "rascunho") { hymns { title } hymnbooks { slug } } }',
        "search_view é pública e gateia por visible_to — mesmo build_*_search_qs.",
    ),
    "editorHymnbooks": (
        ERRO,
        "{ editorHymnbooks { slug } }",
        "editor_hymnbook_list é @login_required + _has_editor_access.",
    ),
    "editorPendingBookCount": (
        PUBLICO,
        "{ editorPendingBookCount }",
        "context_processors.editor_workspace roda em TODA request, inclusive "
        "anônima, e devolve dict vazio pra quem não é editor — o template então "
        "não renderiza a CTA. Aqui o equivalente é 0, não erro: quem consome é "
        "o layout global do shell e um `errors` derrubaria o header de toda "
        "página anônima. 0 não vaza nada — é o mesmo 'nada' do template.",
    ),
    "editorDashboardStats": (
        ERRO,
        "{ editorDashboardStats { totalHinarios } }",
        "Stats inline do editor_hymnbook_list — mesmo gate da tela.",
    ),
    "pendingAudios": (
        ERRO,
        "{ pendingAudios { id } }",
        "editor_pending_audios é @login_required + _has_editor_access.",
    ),
    "publishReadiness": (
        NULO,
        '{ publishReadiness(slug: "publicado") { canPublish } }',
        "hymnbook_publish_check_view é @login_required + can_publish_hymnbook (403).",
    ),
    "ocrTask": (
        NULO,
        '{ ocrTask(id: "{task_id}") { pdfFilename resultData } }',
        "users/views.py::_ocr_task_for_user exige @login_required e task.user == request.user.",
    ),
    "globalStats": (
        PUBLICO,
        "{ globalStats { hymnbooks hymns audios activeReviewers } }",
        "api_views.py::api_global_stats é público e conta o mesmo.",
    ),
}


def _campos_da_query_viva() -> list[str]:
    """Nomes dos campos de `type Query` lidos do SDL do schema em memória.

    Do schema vivo, não do `schema.graphql` versionado: um SDL desatualizado
    não pode esconder um campo novo desta varredura.
    """
    bloco = re.search(r"type Query \{(.*?)\n\}", schema.as_str(), re.S)
    assert bloco is not None, "SDL sem `type Query` — o schema mudou de forma?"
    return re.findall(r"^\s{2}(\w+)", bloco.group(1), re.M)


@pytest.fixture
def mundo(hymn_book_factory, hymn_factory, user_factory):
    """Um hinário publicado, um em rascunho, e uma OCRTask de terceiro.

    O rascunho é o que dá sentido ao regime `publico`: os campos abertos ao
    anônimo respondem, mas nunca com o conteúdo do rascunho.
    """
    from apps.hymns.models import OCRTask

    dono = user_factory(email="dono@example.com")
    publicado = hymn_book_factory(name="Publicado", slug="publicado", is_published=True, owner_user=dono)
    rascunho = hymn_book_factory(name="Rascunho", slug="rascunho", is_published=False, owner_user=dono)
    hymn_factory(hymn_book=publicado, number=1, title="Lua Branca", text="lua branca")
    hino_rascunho = hymn_factory(
        hymn_book=rascunho,
        number=1,
        title="Segredo do Rascunho",
        text="texto que ninguem deveria ler",
    )
    task = OCRTask.objects.create(user=dono, pdf_filename="segredo.pdf", result_data={"hymns": []})
    return {
        "dono": dono,
        "publicado": publicado,
        "rascunho": rascunho,
        "hino_rascunho": hino_rascunho,
        "task": task,
    }


def _query_de(campo: str, mundo: dict) -> str:
    _, template, _ = VARREDURA[campo]
    return template.replace("{hymn_rascunho}", str(mundo["hino_rascunho"].pk)).replace(
        "{task_id}", str(mundo["task"].pk)
    )


def test_inventario_cobre_toda_a_query():
    """Todo campo de `Query` tem regime declarado — e vice-versa.

    Este é o teste que impede a REPETIÇÃO do padrão, não só a correção dele:
    uma query nova sem entrada em `VARREDURA` deixa a suíte vermelha, e quem a
    escreveu precisa dizer o que o anônimo recebe e qual view Django é a régua.
    """
    vivos = set(_campos_da_query_viva())
    declarados = set(VARREDURA)
    novos = sorted(vivos - declarados)
    sumidos = sorted(declarados - vivos)
    assert not novos, (
        f"Query(s) sem gate declarado: {novos}. Adicione a `VARREDURA` com o regime "
        f"(publico / nulo-para-anonimo / erro-para-anonimo) e a view Django que é a régua."
    )
    assert not sumidos, f"`VARREDURA` declara campo(s) que não existem mais em Query: {sumidos}."


@pytest.mark.django_db
@pytest.mark.parametrize("campo", sorted(c for c, (r, _, _) in VARREDURA.items() if r == PUBLICO))
def test_anonimo_e_atendido_sem_erro_nos_campos_publicos(client, mundo, campo):
    """Campo público responde ao anônimo. A visibilidade é filtrada por dentro."""
    data = gql(client, _query_de(campo, mundo))
    assert "errors" not in data, (campo, data)


@pytest.mark.django_db
@pytest.mark.parametrize("campo", sorted(c for c, (r, _, _) in VARREDURA.items() if r == NULO))
def test_anonimo_recebe_nulo_sem_vazar_existencia(client, mundo, campo):
    """Gate nullable: o anônimo recebe `null`, e não um erro que confirmaria
    que o recurso existe."""
    data = gql(client, _query_de(campo, mundo))
    assert "errors" not in data, (campo, data)
    assert data["data"][campo] is None, (campo, data)


@pytest.mark.django_db
@pytest.mark.parametrize("campo", sorted(c for c, (r, _, _) in VARREDURA.items() if r == ERRO))
def test_anonimo_e_recusado_com_mensagem_ptbr_classificavel(client, mundo, campo):
    """Gate que levanta erro: mensagem PT-BR canônica e `data` sem payload.

    As duas mensagens aceitas são as que `_isEditorAccessError` (shell)
    reconhece pra redirecionar pro login. Uma mensagem fora delas passaria o
    gate no backend e quebraria o redirect no front — foi o bug de
    `/notificacoes`.
    """
    data = gql(client, _query_de(campo, mundo))
    assert "errors" in data, (campo, data)
    mensagem = data["errors"][0]["message"]
    assert mensagem == PERMISSION_DENIED_MESSAGE or mensagem.startswith(AUTHENTICATION_REQUIRED_PREFIX), (
        campo,
        mensagem,
    )
    assert data.get("data") in (None, {}) or data["data"].get(campo) is None, (campo, data)


@pytest.mark.django_db
def test_nenhum_campo_publico_vaza_o_rascunho_para_anonimo(client, mundo):
    """A contraprova do regime `publico`: responder não é o mesmo que abrir.

    Um só teste que varre os campos abertos e procura o nome do hinário em
    rascunho e o título do hino que mora nele. Cobre de uma vez os caminhos que
    hoje têm teste separado e qualquer campo público que venha a ser adicionado
    ao inventário depois.
    """
    import json

    for campo, (regime, _, _) in VARREDURA.items():
        if regime != PUBLICO:
            continue
        # A resposta do endpoint não ecoa a query, então achar "rascunho" aqui
        # significa que o dado do hinário não-publicado saiu de verdade.
        bruto = json.dumps(gql(client, _query_de(campo, mundo)), ensure_ascii=False).lower()
        assert "rascunho" not in bruto, (campo, bruto)
        assert "ninguem deveria ler" not in bruto, (campo, bruto)


PUBLISH_READINESS = """
query($slug: String!) {
  publishReadiness(slug: $slug) { canPublish checks { key ok } }
}
"""


@pytest.mark.django_db
def test_publish_readiness_nulo_para_anonimo(client, mundo):
    """Estado editorial de um hinário não é público.

    Régua: `hymnbook_publish_check_view` é `@login_required` e responde 403 sem
    `can_publish_hymnbook`. A query não tinha NENHUM teste de gate — só o
    happy-path do editor.
    """
    data = gql(client, PUBLISH_READINESS, variables={"slug": "publicado"})
    assert "errors" not in data, data
    assert data["data"]["publishReadiness"] is None


@pytest.mark.django_db
def test_publish_readiness_nulo_para_usuario_comum(authenticated_client, mundo):
    """Estar logado não basta: o gate é a permissão `can_publish_hymnbook`."""
    data = gql(authenticated_client, PUBLISH_READINESS, variables={"slug": "publicado"})
    assert "errors" not in data, data
    assert data["data"]["publishReadiness"] is None


@pytest.mark.django_db
def test_publish_readiness_nulo_para_dono_sem_papel_editorial(client, mundo):
    """Nem o dono do hinário — `can_publish_hymnbook` é papel formal, e
    `apps/hymns/permissions.py` diz em docstring que dono comum ficou restrito
    a consulta."""
    client.force_login(mundo["dono"])
    data = gql(client, PUBLISH_READINESS, variables={"slug": "publicado"})
    assert "errors" not in data, data
    assert data["data"]["publishReadiness"] is None


@pytest.mark.django_db
def test_publish_readiness_atende_editor(editor_client, mundo):
    """Contraprova: com o papel, o gate abre — o teste acima não passa por
    engano (slug errado, hinário ausente)."""
    data = gql(editor_client, PUBLISH_READINESS, variables={"slug": "publicado"})
    assert "errors" not in data, data
    assert data["data"]["publishReadiness"] is not None


@pytest.mark.django_db
def test_publish_readiness_nulo_para_slug_inexistente(editor_client):
    """Slug inexistente e slug sem permissão respondem igual: `null`."""
    data = gql(editor_client, PUBLISH_READINESS, variables={"slug": "nao-existe"})
    assert "errors" not in data, data
    assert data["data"]["publishReadiness"] is None


@pytest.mark.django_db
def test_current_user_nulo_para_anonimo(client):
    data = gql(client, "{ currentUser { id username } }")
    assert "errors" not in data, data
    assert data["data"]["currentUser"] is None


@pytest.mark.django_db
def test_current_user_devolve_o_proprio_usuario(authenticated_client):
    """Contraprova do `null` acima."""
    data = gql(authenticated_client, "{ currentUser { id username } }")
    assert "errors" not in data, data
    assert data["data"]["currentUser"]["username"] == authenticated_client.user.username


@pytest.mark.django_db
def test_ocr_task_nulo_para_terceiro_sem_papel_editorial(authenticated_client, mundo):
    """A OCRTask carrega o conteúdo OCR do PDF de quem a criou.

    Terceiro logado sem papel editorial recebe `null` — igual ao 403 de
    `_ocr_task_for_user`. O gate atual é MAIS LARGO que a régua Django (deixa
    editor/admin ver task de terceiro, o Django não deixa); a divergência está
    reportada em `_plan/marco4-diff-notes.md` e travada em
    `test_query_ocr_task.py::test_ocr_task_visible_to_editor`, que é decisão
    deliberada do 5.A½ e não foi mexida aqui.
    """
    data = gql(
        authenticated_client,
        "query($id: ID!) { ocrTask(id: $id) { pdfFilename resultData } }",
        variables={"id": str(mundo["task"].pk)},
    )
    assert "errors" not in data, data
    assert data["data"]["ocrTask"] is None


@pytest.mark.django_db
def test_ocr_task_id_malformado_nao_estoura(client):
    """`get_or_none` absorve id fora do formato UUID — id inválido e id
    inexistente são a mesma resposta pro cliente."""
    data = gql(client, 'query { ocrTask(id: "nao-e-uuid") { status } }')
    assert "errors" not in data, data
    assert data["data"]["ocrTask"] is None


@pytest.mark.django_db
def test_hymn_de_rascunho_nao_e_alcancavel_pelo_pk_por_usuario_comum(authenticated_client, mundo):
    """O furo clássico: chegar no hino sem passar pelo hinário.

    `test_query_hymn.py` já cobre o anônimo; aqui o usuário LOGADO sem papel
    editorial, que é o caso em que `visible_to` troca de ramo
    (`is_published=True OR owner_user=user`).
    """
    data = gql(
        authenticated_client,
        "query($pk: ID!) { hymn(pk: $pk) { title } }",
        variables={"pk": str(mundo["hino_rascunho"].pk)},
    )
    assert "errors" not in data, data
    assert data["data"]["hymn"] is None


@pytest.mark.django_db
def test_hymn_de_rascunho_e_alcancavel_pelo_proprio_dono(client, mundo):
    """Contraprova: `visible_to` inclui os rascunhos do próprio dono, como na
    listagem pública do monolito."""
    client.force_login(mundo["dono"])
    data = gql(
        client,
        "query($pk: ID!) { hymn(pk: $pk) { title } }",
        variables={"pk": str(mundo["hino_rascunho"].pk)},
    )
    assert "errors" not in data, data
    assert data["data"]["hymn"]["title"] == "Segredo do Rascunho"


@pytest.mark.django_db
def test_hymn_pk_inexistente_devolve_nulo(client):
    data = gql(
        client,
        "query($pk: ID!) { hymn(pk: $pk) { title } }",
        variables={"pk": str(uuid.uuid4())},
    )
    assert "errors" not in data, data
    assert data["data"]["hymn"] is None
