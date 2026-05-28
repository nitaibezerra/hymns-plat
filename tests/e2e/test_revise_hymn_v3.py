"""E2E para a tela 07 · Revisar Hino (Fase 2 v3 — layout invertido).

Pré-requisitos:
- `uv run python manage.py runserver 9000` rodando
- DB local com seed (User teste2e@example.com, HymnBook 'e2e-test-book' com 3 hinos)
  Ver `tests/e2e/test_revise_hymn_v3.py::_ensure_seed`.

Cobre: layout invertido · view toggle · atalhos pills · preset chips · barrinhas
de repetição · caret↔preview highlight · status segmentado · autosave debounce
· "Marcar revisado e avançar" (auto-set REVIEWED + redirect) · "Pular sem
salvar" · atalhos de teclado · audio review.
"""

import os
import subprocess
import time
from pathlib import Path

import pytest
from playwright.sync_api import expect

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SEED_BOOK = "e2e-test-book"


def _shell(code: str) -> str:
    """Executa código no Django shell do servidor live (DB local)."""
    result = subprocess.run(
        ["uv", "run", "python", "manage.py", "shell", "-c", code],
        env={**os.environ, "DJANGO_SETTINGS_MODULE": "config.settings.local"},
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    # Última linha não-vazia é o output do print() (Django shell pode emitir warnings antes).
    lines = [ln for ln in result.stdout.strip().splitlines() if ln.strip()]
    return lines[-1] if lines else ""


def _hymn_pk(number: int) -> str:
    return _shell(
        "from apps.hymns.models import Hymn;"
        f"print(Hymn.objects.get(hymn_book__slug={SEED_BOOK!r}, number={number}).pk)"
    )


SEED_TEXT = "Lua branca\\nClareando\\n\\nMeu coracao\\nEsta cantando"


def _ensure_seed():
    """Cria/restaura HymnBook + 3 hinos + grupo editor + user-in-group.

    Idempotente: pode ser chamado várias vezes sem efeitos colaterais. Não
    depende de seed pré-existente em CI/dev — o teste se auto-bootstrap.
    """
    code = (
        "from django.contrib.auth.models import Group;"
        "from apps.hymns.models import Hymn, HymnAudio, HymnBook;"
        "from apps.users.models import User;"
        f"hb, _ = HymnBook.objects.get_or_create(slug={SEED_BOOK!r}, defaults={{'name': 'E2E Test Book', 'owner_name': 'E2E', 'is_published': False}});"
        "Hymn.objects.update_or_create("
        "  hymn_book=hb, number=1,"
        f"  defaults={{'title': 'Lua Branca', 'text': '{SEED_TEXT}', 'repetitions': '1-2,3-4', 'ocr_text': 'Lua branca\\nClareiando', 'review_status': 'not_reviewed'}});"
        "Hymn.objects.update_or_create("
        "  hymn_book=hb, number=2,"
        "  defaults={'title': 'Sol da Manha', 'text': 'Sol da manha\\nQue ilumina', 'repetitions': '', 'review_status': 'not_reviewed'});"
        "Hymn.objects.update_or_create("
        "  hymn_book=hb, number=3,"
        "  defaults={'title': 'Estrela', 'text': 'Estrela brilhante\\nNo ceu', 'repetitions': '', 'review_status': 'not_reviewed'});"
        f"HymnAudio.objects.filter(hymn__hymn_book__slug={SEED_BOOK!r}).delete();"
        "ed, _ = Group.objects.get_or_create(name='editor');"
        "u, _ = User.objects.get_or_create(email='teste2e@example.com', defaults={'username': 'teste2e', 'is_active': True});"
        "u.groups.add(ed);"
        "print('seeded')"
    )
    _shell(code)


def _hymn_state(number: int) -> str:
    return _shell(
        "from apps.hymns.models import Hymn;"
        f"h = Hymn.objects.get(hymn_book__slug={SEED_BOOK!r}, number={number});"
        "print(h.review_status)"
    )


@pytest.fixture(autouse=True)
def reset_seed():
    _ensure_seed()
    yield
    _ensure_seed()


@pytest.fixture
def revise_url(base_url, authenticated_page):
    """URL de revisão do hino 1 do hinário seed."""
    pk = _hymn_pk(1)
    return f"{base_url}/editor/hinos/{pk}/revisar/"


class TestReviseScreenWorkflows:
    def test_layout_invertido_editor_left_preview_right(self, authenticated_page, revise_url):
        authenticated_page.goto(revise_url)
        # Após o handoff Fase 2.x §4 a coluna esquerda perdeu o sentinel
        # `data-editor-pane` (junto com o view-toggle OCR/Diff). Usa o
        # textarea do editor como ancora pra esquerda + `data-preview-root`
        # pra direita.
        editor = authenticated_page.locator("textarea[name='text']")
        preview = authenticated_page.locator("[data-preview-root]")
        expect(editor).to_be_visible()
        expect(preview).to_be_visible()
        editor_box = editor.bounding_box()
        preview_box = preview.bounding_box()
        assert editor_box["x"] < preview_box["x"], "editor deve estar à esquerda da prévia"

    def test_view_toggle_removed(self, authenticated_page, revise_url):
        """View toggle Escrever/OCR/Diff foi removido no handoff §4. Só sobra
        o pane de escrita (textarea direto, sem switcher)."""
        authenticated_page.goto(revise_url)
        expect(authenticated_page.locator("[data-view-toggle]")).to_have_count(0)
        expect(authenticated_page.locator('[data-view="ocr"]')).to_have_count(0)
        expect(authenticated_page.locator('[data-view="diff"]')).to_have_count(0)
        # O textarea continua sendo o canal único de edição.
        expect(authenticated_page.locator('textarea[name="text"]')).to_be_visible()

    def test_shortcut_strip_blanks_modifies_textarea(self, authenticated_page, revise_url):
        authenticated_page.goto(revise_url)
        ta = authenticated_page.locator('textarea[name="text"]')
        before = ta.input_value()
        assert "\n\n" in before  # tem blank line entre as estrofes
        authenticated_page.locator('[data-shortcut="strip-blanks"]').click()
        after = ta.input_value()
        assert "\n\n" not in after

    def test_chip_repetition_sets_input_and_renders_bars(self, authenticated_page, revise_url):
        authenticated_page.goto(revise_url)
        # Chip "1-2,3-4" preenche o input.
        authenticated_page.locator('[data-suggestion="1-2,3-4"][data-target="repetitions"]').click()
        reps = authenticated_page.locator('input[name="repetitions"]').input_value()
        assert reps == "1-2,3-4"
        # Prévia renderiza 2 barrinhas de repetição (texto seed tem 4 linhas em 2 estrofes
        # de 2 linhas; range "1-2" cabe na 1ª, range "3-4" cabe na 2ª).
        bars = authenticated_page.locator(".repetition-bar")
        expect(bars).to_have_count(2)

    def test_caret_line_highlights_preview(self, authenticated_page, revise_url):
        authenticated_page.goto(revise_url)
        # Posiciona o caret exatamente na linha 2 (índice 1 = "Clareando")
        # via JS — `ta.click()` cai no fim e Home/ArrowDown não navegam linhas
        # de forma confiável headless.
        authenticated_page.evaluate(
            """() => {
              const ta = document.querySelector('textarea[name="text"]');
              ta.focus();
              ta.setSelectionRange(11, 11);  // depois do '\\n' que termina 'Lua branca'
              ta.dispatchEvent(new Event('keyup', { bubbles: true }));
            }"""
        )
        # Markup compartilhado com carrossel/corrido: linhas são `.hymn-line`
        # com `data-line="N"`. Editor pinta `.is-active` na linha do caret.
        active = authenticated_page.locator(".preview-body .hymn-line.is-active")
        expect(active).to_have_count(1)
        expect(active).to_contain_text("Clareando")

    def test_status_segmentado_changes_visual_state(self, authenticated_page, revise_url):
        authenticated_page.goto(revise_url)
        # Click "Revisado" no segmented control.
        authenticated_page.locator('label.status-option[data-status="reviewed"]').click()
        radio = authenticated_page.locator('input[name="review_status"][value="reviewed"]')
        assert radio.is_checked()

    def test_marcar_revisado_e_avancar_redirects_and_marks_reviewed(self, authenticated_page, revise_url):
        """Bug fix crítico: clicar o botão DEVE marcar como REVIEWED mesmo
        se o radio ficou em 'in_review', e DEVE redirecionar para o próximo
        hino pendente."""
        authenticated_page.goto(revise_url)
        h2_pk = _hymn_pk(2)
        with authenticated_page.expect_navigation(timeout=8000):
            authenticated_page.locator('button[name="next_action"][value="next"]').click()
        assert h2_pk in authenticated_page.url, f"esperava {h2_pk} em {authenticated_page.url}"
        # Hymn 1 ficou marcado como reviewed.
        assert _hymn_state(1) == "reviewed"

    def test_pular_sem_salvar_advances_without_marking(self, authenticated_page, revise_url):
        authenticated_page.goto(revise_url)
        h2_pk = _hymn_pk(2)
        with authenticated_page.expect_navigation(timeout=8000):
            authenticated_page.locator('a:has-text("Pular sem salvar")').click()
        assert h2_pk in authenticated_page.url
        # Hymn 1 não foi alterado.
        assert _hymn_state(1) == "not_reviewed"

    def test_keyboard_shortcut_enter_submits_as_reviewed(self, authenticated_page, revise_url):
        authenticated_page.goto(revise_url)
        # Foca o body (fora de input/textarea) e pressiona Enter — handler global submete
        # como next_action=next.
        authenticated_page.evaluate("() => document.body.focus()")
        h2_pk = _hymn_pk(2)
        with authenticated_page.expect_navigation(timeout=8000):
            authenticated_page.keyboard.press("Enter")
        assert h2_pk in authenticated_page.url
        assert _hymn_state(1) == "reviewed"

    def test_keyboard_shortcut_cmds_saves_draft(self, authenticated_page, revise_url):
        authenticated_page.goto(revise_url)
        ta = authenticated_page.locator('textarea[name="text"]')
        ta.click()
        ta.fill("texto modificado via cmd+s")
        # Emit Cmd+S (Mac) ou Ctrl+S (Linux). Handler aceita ambos.
        modifier = "Meta" if os.uname().sysname == "Darwin" else "Control"
        with authenticated_page.expect_navigation(timeout=8000):
            authenticated_page.keyboard.press(f"{modifier}+s")
        assert f"/editor/hinarios/{SEED_BOOK}/" in authenticated_page.url
        # Texto foi salvo.
        saved = _shell(
            "from apps.hymns.models import Hymn;"
            f"print(Hymn.objects.get(hymn_book__slug={SEED_BOOK!r}, number=1).text)"
        )
        assert "modificado via cmd+s" in saved

    def test_audio_review_empty_state_shown(self, authenticated_page, revise_url):
        authenticated_page.goto(revise_url)
        # Hymn 1 não tem áudio → empty state.
        empty = authenticated_page.locator(".audio-empty")
        expect(empty).to_be_visible()
        expect(empty).to_contain_text("Sem gravação")
        # Não tem o bloco de revisão.
        expect(authenticated_page.locator("[data-audio-review-root]")).to_have_count(0)

    def test_autosave_status_updates_after_typing(self, authenticated_page, revise_url):
        authenticated_page.goto(revise_url)
        ta = authenticated_page.locator('textarea[name="text"]')
        ta.click()
        ta.type("X", delay=50)
        # Status mostra '…' imediatamente, depois 'Salvando…', depois 'Salvo automaticamente'.
        # Aguarda 'Salvo' (debounce de 1500ms + request).
        time.sleep(2.5)
        autosave = authenticated_page.locator("[data-autosave-status]")
        text = autosave.inner_text().lower()  # CSS pode aplicar uppercase visual
        assert "salvo" in text or "salvando" in text


class TestAudioReviewFlow:
    """Subset do fluxo de revisão de áudio. Cria audio inline via shell."""

    @pytest.fixture
    def hymn_with_audio_url(self, base_url, authenticated_page):
        # Cria audio para hymn 1.
        _shell(
            "from apps.hymns.models import Hymn, HymnAudio;"
            f"h = Hymn.objects.get(hymn_book__slug={SEED_BOOK!r}, number=1);"
            "HymnAudio.objects.filter(hymn=h).delete();"
            "HymnAudio.objects.create(hymn=h, audio_file='dummy.mp3', is_approved=True);"
            "print('ok')"
        )
        pk = _hymn_pk(1)
        return f"{base_url}/editor/hinos/{pk}/revisar/"

    def test_audio_review_root_present(self, authenticated_page, hymn_with_audio_url):
        authenticated_page.goto(hymn_with_audio_url)
        expect(authenticated_page.locator("[data-audio-review-root]")).to_be_visible()
        expect(authenticated_page.locator('[data-audio-match="true"]')).to_be_visible()

    def test_audio_match_yes_reveals_quality_block(self, authenticated_page, hymn_with_audio_url):
        authenticated_page.goto(hymn_with_audio_url)
        quality = authenticated_page.locator("[data-quality-block]")
        # Inicial: quality-block escondido (is_match é None).
        expect(quality).to_be_hidden()
        # Click ✓ Confere → POST + revela quality.
        authenticated_page.locator('[data-audio-match="true"]').click()
        # Aguarda fetch responder e UI atualizar.
        expect(quality).to_be_visible(timeout=3000)

    def test_audio_match_no_reveals_mismatch_block(self, authenticated_page, hymn_with_audio_url):
        authenticated_page.goto(hymn_with_audio_url)
        mismatch = authenticated_page.locator("[data-mismatch-block]")
        expect(mismatch).to_be_hidden()
        authenticated_page.locator('[data-audio-match="false"]').click()
        expect(mismatch).to_be_visible(timeout=3000)

    def test_quality_rating_persists_via_post(self, authenticated_page, hymn_with_audio_url):
        authenticated_page.goto(hymn_with_audio_url)
        authenticated_page.locator('[data-audio-match="true"]').click()
        # Aguarda quality-block visível.
        expect(authenticated_page.locator("[data-quality-block]")).to_be_visible(timeout=3000)
        authenticated_page.locator('[data-quality-rating="4"]').click()
        # Aguarda response.
        time.sleep(0.6)
        rating = _shell(
            "from apps.hymns.models import HymnAudio;"
            f"print(HymnAudio.objects.filter(hymn__hymn_book__slug={SEED_BOOK!r}, hymn__number=1).first().quality_rating)"
        )
        assert rating == "4"
