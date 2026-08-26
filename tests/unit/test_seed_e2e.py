"""
Testes do management command `seed_e2e` (Frente C — E2E do workspace editorial).

Duas tentativas anteriores de ligar um job de Playwright no CI foram recusadas
pela MESMA razão: sem fixture de seed determinística, o job é flaky, e job
flaky é pior que job ausente. Este arquivo é o contrato dessa fixture — as
specs de `web/tests/e2e/` assumem exatamente o que está travado aqui.

Três eixos:

1. **Gate de ambiente.** O comando cria usuários com senha conhecida; rodar
   isso em produção seria abrir a porta. O gate é testado nos dois sentidos.
2. **Idempotência.** CI roda `migrate && seed_e2e` a cada job, e um dev roda o
   script de subida quantas vezes quiser. Duas execuções seguidas não podem
   duplicar nada nem estourar.
3. **Contrato de dados.** Contagens e ordenações que as specs afirmam. Se uma
   spec começar a falhar, é aqui que se descobre se a fixture mudou ou se a UI
   regrediu.
"""

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

from apps.hymns.management.commands import seed_e2e as seed_module
from apps.hymns.models import Hymn, HymnAudio, HymnBook, HymnRevision
from apps.users.models import User

pytestmark = pytest.mark.django_db


def _seed(**kwargs):
    call_command("seed_e2e", verbosity=0, **kwargs)


def _seeded_books():
    return HymnBook.objects.filter(name__startswith=seed_module.SEED_PREFIX)


def _seeded_audios():
    return HymnAudio.objects.filter(title__startswith=seed_module.SEED_PREFIX)


# --------------------------------------------------------------------------- #
# Gate de ambiente
# --------------------------------------------------------------------------- #


def test_gate_libera_sob_settings_de_teste():
    """`config.settings.test` é ambiente de teste — o comando roda."""
    _seed()
    assert User.objects.filter(username=seed_module.editor_username()).exists()


@override_settings(DEBUG=True)
def test_gate_libera_com_debug_true(monkeypatch):
    """DEBUG=True libera mesmo com um settings module de nome desconhecido."""
    monkeypatch.setenv("DJANGO_SETTINGS_MODULE", "config.settings.qualquer_coisa")
    _seed()
    assert User.objects.filter(username=seed_module.editor_username()).exists()


@override_settings(DEBUG=False)
def test_gate_recusa_em_producao(monkeypatch):
    """Sem DEBUG e fora de test/local, o comando se recusa a rodar."""
    monkeypatch.setenv("DJANGO_SETTINGS_MODULE", "config.settings.production")
    with pytest.raises(CommandError) as exc:
        _seed()
    mensagem = str(exc.value).lower()
    assert "debug" in mensagem or "produção" in mensagem
    assert not User.objects.filter(username=seed_module.editor_username()).exists()


@override_settings(DEBUG=False)
def test_gate_recusa_nao_cria_nada(monkeypatch):
    """Recusa é total: nem hinário, nem hino, nem áudio."""
    monkeypatch.setenv("DJANGO_SETTINGS_MODULE", "config.settings.production")
    with pytest.raises(CommandError):
        _seed()
    assert not _seeded_books().exists()
    assert not Hymn.objects.filter(hymn_book__name__startswith=seed_module.SEED_PREFIX).exists()
    assert not _seeded_audios().exists()


# --------------------------------------------------------------------------- #
# Usuários
# --------------------------------------------------------------------------- #


def test_cria_editor_no_grupo_editor_com_senha_conhecida():
    _seed()
    editor = User.objects.get(username=seed_module.editor_username())
    assert editor.groups.filter(name="editor").exists()
    assert editor.has_perm("hymns.can_review_any_hymnbook")
    assert editor.check_password(seed_module.seed_password())


def test_cria_usuario_comum_sem_papel_editorial():
    """O guard de `/editor/` precisa de alguém pra negar."""
    _seed()
    viewer = User.objects.get(username=seed_module.viewer_username())
    assert not viewer.groups.filter(name="editor").exists()
    assert not viewer.has_perm("hymns.can_review_any_hymnbook")
    assert not viewer.is_superuser
    assert viewer.check_password(seed_module.seed_password())


def test_editor_nao_e_superuser():
    """O guard tem que ser exercitado pelo papel, não por superpoder."""
    _seed()
    assert not User.objects.get(username=seed_module.editor_username()).is_superuser


def test_senha_e_usuarios_vem_do_ambiente(monkeypatch):
    monkeypatch.setenv("HINARIA_E2E_PASSWORD", "senha-do-ambiente")
    monkeypatch.setenv("HINARIA_E2E_EDITOR_USERNAME", "editor-do-ambiente")
    monkeypatch.setenv("HINARIA_E2E_VIEWER_USERNAME", "viewer-do-ambiente")
    _seed()
    editor = User.objects.get(username="editor-do-ambiente")
    assert editor.check_password("senha-do-ambiente")
    assert User.objects.filter(username="viewer-do-ambiente").exists()


def test_senha_de_usuario_pre_existente_e_realinhada(monkeypatch):
    """
    Um banco de dev já pode ter o usuário com outra senha (ou de uma corrida
    anterior com env diferente). Sem realinhar, a fixture de login da suíte
    falharia sem explicar por quê.
    """
    _seed()
    monkeypatch.setenv("HINARIA_E2E_PASSWORD", "senha-nova")
    _seed()
    editor = User.objects.get(username=seed_module.editor_username())
    assert editor.check_password("senha-nova")


# --------------------------------------------------------------------------- #
# Idempotência
# --------------------------------------------------------------------------- #


def _contagens():
    return (
        User.objects.count(),
        HymnBook.objects.count(),
        Hymn.objects.count(),
        HymnAudio.objects.count(),
        HymnRevision.objects.count(),
    )


def test_rodar_duas_vezes_nao_duplica_nada():
    _seed()
    antes = _contagens()
    _seed()
    assert _contagens() == antes


def test_segunda_execucao_reverte_edicao_feita_pela_suite():
    """
    A suíte E2E edita o hino de revisão (autosave). Re-semear devolve o estado
    conhecido — senão a segunda corrida mede um banco diferente da primeira.
    """
    _seed()
    alvo = Hymn.objects.get(hymn_book__slug=seed_module.REVIEW_BOOK_SLUG, number=1)
    alvo.title = "Título que a suíte deixou"
    alvo.review_status = Hymn.ReviewStatus.REVIEWED
    alvo.save()

    _seed()
    alvo.refresh_from_db()
    assert alvo.title != "Título que a suíte deixou"
    assert alvo.review_status == Hymn.ReviewStatus.NOT_REVIEWED


def test_segunda_execucao_devolve_audio_aprovado_para_pendente():
    """A jornada de CRUD aprova o áudio pendente; re-semear desfaz."""
    _seed()
    pendente = _seeded_audios().filter(is_approved=False).first()
    pendente.is_approved = True
    pendente.save()

    _seed()
    pendente.refresh_from_db()
    assert pendente.is_approved is False


def test_reset_remove_hinarios_criados_pela_suite():
    """
    A jornada de CRUD cria hinários com o prefixo do seed; `--reset` limpa o
    acúmulo sem tocar no resto do banco.
    """
    _seed()
    HymnBook.objects.create(name=f"{seed_module.SEED_PREFIX}Criado Pela Suite", owner_name="Suíte")
    alheio = HymnBook.objects.create(name="Hinário de outra fonte", owner_name="Alguém")

    _seed(reset=True)

    assert not HymnBook.objects.filter(name=f"{seed_module.SEED_PREFIX}Criado Pela Suite").exists()
    assert HymnBook.objects.filter(pk=alheio.pk).exists()
    assert HymnBook.objects.filter(slug=seed_module.REVIEW_BOOK_SLUG).exists()


def test_reset_em_banco_vazio_nao_estoura():
    _seed(reset=True)
    assert _seeded_books().count() == len(seed_module.SEED_BOOKS)


# --------------------------------------------------------------------------- #
# Contrato de dados: hinários
# --------------------------------------------------------------------------- #


def test_produz_hinarios_nas_tres_prioridades_e_um_rascunho():
    _seed()
    seeded = _seeded_books()
    assert seeded.count() == len(seed_module.SEED_BOOKS)
    assert set(seeded.values_list("priority", flat=True)) == {"P1", "P2", "P3"}
    assert seeded.filter(is_published=True).count() >= 1
    assert seeded.filter(is_published=False).count() == 1


def test_slugs_sao_estaveis_e_conhecidos():
    """As specs endereçam os cards por `queue-card-<slug>`."""
    _seed()
    assert set(_seeded_books().values_list("slug", flat=True)) == {book.slug for book in seed_module.SEED_BOOKS}


def test_ordem_por_revisao_difere_da_ordem_default():
    """
    O chip "Revisão" só prova reordenação se existirem dois hinários de MESMA
    prioridade (a prioridade é sort primário quando `priority=all`) com
    percentuais de revisão que contrariam a ordem alfabética.
    """
    _seed()
    dupla = [b for b in seed_module.SEED_BOOKS if b.priority == "P2"]
    assert len(dupla) >= 2, "sem dois hinários P2 não há reordenação observável"

    qs = HymnBook.objects.filter(slug__in=[b.slug for b in dupla]).with_review_progress()
    por_nome = list(qs.order_by("name").values_list("slug", flat=True))
    por_revisao = list(qs.order_by("review_pct", "name").values_list("slug", flat=True))
    assert por_nome != por_revisao
    assert por_revisao == list(seed_module.P2_SLUGS_BY_REVIEW_ASC)


def test_um_hinario_fica_totalmente_revisado():
    """A tela de detalhe precisa de um caso com "Tudo revisado ✓"."""
    _seed()
    assert HymnBook.objects.get(slug=seed_module.FULLY_REVIEWED_BOOK_SLUG).is_fully_reviewed


# --------------------------------------------------------------------------- #
# Contrato de dados: hinos
# --------------------------------------------------------------------------- #


def test_produz_hinos_nos_tres_estados_de_revisao():
    _seed()
    estados = set(
        Hymn.objects.filter(hymn_book__name__startswith=seed_module.SEED_PREFIX).values_list("review_status", flat=True)
    )
    assert estados == {
        Hymn.ReviewStatus.NOT_REVIEWED,
        Hymn.ReviewStatus.IN_REVIEW,
        Hymn.ReviewStatus.REVIEWED,
    }


def test_hinario_de_revisao_tem_pendente_e_proximo_pendente():
    """A jornada de revisão termina em "avançar" — precisa de 2+ pendentes."""
    _seed()
    book = HymnBook.objects.get(slug=seed_module.REVIEW_BOOK_SLUG)
    assert book.hymns.exclude(review_status=Hymn.ReviewStatus.REVIEWED).count() >= 2


def test_hino_de_revisao_tem_ocr_para_diff_e_sparkline():
    _seed()
    alvo = Hymn.objects.get(hymn_book__slug=seed_module.REVIEW_BOOK_SLUG, number=1)
    assert alvo.review_status == Hymn.ReviewStatus.NOT_REVIEWED
    assert alvo.ocr_text
    assert alvo.ocr_text != alvo.text, "OCR igual ao texto não produz diff visível"

    from apps.hymns.editor_views import _compute_inline_diff, _compute_ocr_line_confidences

    diff = _compute_inline_diff(alvo.ocr_text, alvo.text)
    assert diff["lines"]
    assert diff["changes"] + diff["adds"] + diff["dels"] > 0
    assert _compute_ocr_line_confidences(alvo.ocr_text, alvo.text)


def test_hino_de_revisao_tem_historico_de_revisoes():
    """O drawer de histórico não pode abrir vazio na jornada."""
    _seed()
    alvo = Hymn.objects.get(hymn_book__slug=seed_module.REVIEW_BOOK_SLUG, number=1)
    assert alvo.revisions.count() >= 2


def test_hino_de_revisao_tem_gravacao_para_o_drawer_de_audio():
    """`open-audio-review` só existe quando o hino tem áudio."""
    _seed()
    alvo = Hymn.objects.get(hymn_book__slug=seed_module.REVIEW_BOOK_SLUG, number=1)
    assert alvo.audios.exists()


# --------------------------------------------------------------------------- #
# Contrato de dados: áudios
# --------------------------------------------------------------------------- #


def test_produz_audio_pendente_e_audio_aprovado():
    _seed()
    assert _seeded_audios().filter(is_approved=False).count() == seed_module.PENDING_AUDIOS_EXPECTED
    assert _seeded_audios().filter(is_approved=True).count() >= 1


def test_audio_pendente_e_visivel_na_fila_do_editor():
    """Mesma regra de escopo da tela `/editor/audios/pendentes/`."""
    _seed()
    from apps.hymns.editor_views import _pending_audios_for

    editor = User.objects.get(username=seed_module.editor_username())
    na_fila = set(_pending_audios_for(editor).values_list("title", flat=True))
    semeados = set(_seeded_audios().filter(is_approved=False).values_list("title", flat=True))
    assert semeados and semeados <= na_fila


def test_audios_ja_vem_com_waveform_para_nao_acordar_ffmpeg():
    """
    O signal de waveform dispara uma thread com ffmpeg quando `waveform_peaks`
    está vazio. Semear com peaks prontos mantém o seed rápido e offline.
    """
    _seed()
    for audio in _seeded_audios():
        assert audio.waveform_peaks, f"{audio.title} sem peaks acordaria o ffmpeg"


def test_audio_pendente_pertence_a_hinario_semeado():
    _seed()
    for audio in _seeded_audios():
        assert audio.hymn.hymn_book.name.startswith(seed_module.SEED_PREFIX)


# --------------------------------------------------------------------------- #
# Contrato de dados: visibilidade e stats
# --------------------------------------------------------------------------- #


def test_dashboard_do_editor_ve_os_hinarios_semeados():
    _seed()
    from apps.hymns.editor_views import _editor_visible_books

    editor = User.objects.get(username=seed_module.editor_username())
    slugs = set(_editor_visible_books(editor).values_list("slug", flat=True))
    assert {book.slug for book in seed_module.SEED_BOOKS} <= slugs


def test_usuario_comum_nao_ve_hinario_rascunho():
    _seed()
    viewer = User.objects.get(username=seed_module.viewer_username())
    visiveis = set(HymnBook.objects.visible_to(viewer).values_list("slug", flat=True))
    rascunhos = {book.slug for book in seed_module.SEED_BOOKS if not book.is_published}
    assert rascunhos and not (rascunhos & visiveis)


def test_stat_p1_conta_o_hinario_urgente():
    _seed()
    esperado = len([b for b in seed_module.SEED_BOOKS if b.priority == "P1"])
    assert _seeded_books().filter(priority="P1").count() == esperado


def test_resume_card_tem_hino_pendente_revisado_pelo_editor():
    """
    `editorDashboardStats.resumeHymn` vem da última `HymnRevision` do próprio
    editor sobre um hino ainda não revisado. Sem isso o card "Continuar
    revisão" nunca aparece e a spec não tem o que afirmar.
    """
    _seed()
    editor = User.objects.get(username=seed_module.editor_username())
    rev = (
        HymnRevision.objects.filter(revised_by=editor)
        .exclude(hymn__review_status=Hymn.ReviewStatus.REVIEWED)
        .order_by("-revised_at")
        .first()
    )
    assert rev is not None
    assert rev.hymn.hymn_book.name.startswith(seed_module.SEED_PREFIX)


def test_segunda_execucao_nao_escreve_no_banco():
    """
    Idempotência de verdade é "não escreveu", não só "não duplicou".

    Todo `Hymn.save()` incrementa `HymnBook.sync_version` (o contador que o
    cliente offline usa pra saber que o cache expirou) e mexe em `updated_at`.
    Um seed que re-salva tudo a cada corrida invalidaria o cache de todo mundo
    sem nada ter mudado.
    """
    _seed()
    book = HymnBook.objects.get(slug=seed_module.REVIEW_BOOK_SLUG)
    versao = book.sync_version
    carimbos = dict(Hymn.objects.filter(hymn_book=book).values_list("pk", "updated_at"))

    _seed()

    book.refresh_from_db()
    assert book.sync_version == versao
    assert dict(Hymn.objects.filter(hymn_book=book).values_list("pk", "updated_at")) == carimbos
