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
        # inline_diff (gap 2 — substitui diff_lines) precisa ter linhas marcadas
        # e contadores quando há diferença.
        diff = resp.context["inline_diff"]
        assert diff["lines"]
        assert diff["changes"] + diff["adds"] + diff["dels"] >= 1


@pytest.mark.django_db
class TestRevisePerLineConfidenceSparkline:
    """Gap 3 — design `_design/.../revise-hymn.jsx` 82-97 mostra um sparkline com
    uma barra por linha do OCR. Como não armazenamos confiança por linha do
    Tesseract, derivamos um sinal posterior: similaridade entre cada linha do
    OCR e a linha mais próxima do texto revisado (`SequenceMatcher.ratio()`).
    Isso destaca exatamente as linhas que o editor reescreveu — sinal útil."""

    def test_context_exposes_ocr_line_confidences_when_ocr_present(
        self, authenticated_client, hymn_book_factory, hymn_factory
    ):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X")
        h = hymn_factory(
            hymn_book=hb,
            number=1,
            text="Sol da manhã\nQue ilumina\nO meu coração",
            ocr_text="Sol da manhã\nQue iluminna\nO meu coraçao",
        )
        resp = authenticated_client.get(reverse("hymns:editor_revise_hymn", kwargs={"pk": h.pk}))
        confidences = resp.context["ocr_line_confidences"]
        assert isinstance(confidences, list)
        assert len(confidences) == 3
        # Linha 1 idêntica → 100; linhas 2 e 3 com typos → < 100
        assert confidences[0] == 100
        assert confidences[1] < 100
        assert confidences[2] < 100
        # Cada valor entre 0 e 100
        for c in confidences:
            assert 0 <= c <= 100

    def test_context_empty_when_no_ocr_text(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X")
        h = hymn_factory(hymn_book=hb, number=1, text="texto", ocr_text="")
        resp = authenticated_client.get(reverse("hymns:editor_revise_hymn", kwargs={"pk": h.pk}))
        assert resp.context["ocr_line_confidences"] == []

    def test_template_renders_sparkline_bar_per_line(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X")
        h = hymn_factory(
            hymn_book=hb,
            number=1,
            text="a\nb\nc\nd",
            ocr_text="a\nb\nc\nd",
            ocr_avg_confidence=87,
        )
        body = authenticated_client.get(reverse("hymns:editor_revise_hymn", kwargs={"pk": h.pk})).content.decode()
        assert "ocr-confidence-sparkline" in body
        # Uma barra por linha do OCR (4)
        assert body.count("data-confidence=") == 4

    def test_template_skips_sparkline_section_when_no_ocr(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X")
        h = hymn_factory(hymn_book=hb, number=1, ocr_text="", ocr_avg_confidence=None)
        body = authenticated_client.get(reverse("hymns:editor_revise_hymn", kwargs={"pk": h.pk})).content.decode()
        assert "ocr-confidence-sparkline" not in body


class TestReviseKeyboardShortcuts:
    """Gap 4 — `⌘S` (Salvar rascunho) e `⏎` (Marcar revisado e avançar) já
    aparecem nos labels dos botões; aqui pinamos os handlers globais no JS
    inline do template para que o contrato dos labels seja respeitado.

    `Enter` é interceptado apenas fora de `textarea`/`input` (e via `⌘+Enter`
    de qualquer lugar) para não atrapalhar a edição multi-linha do corpo.
    """

    def _template(self) -> str:
        from pathlib import Path

        return (Path(__file__).resolve().parents[2] / "templates/hymns/editor/revise_hymn.html").read_text(
            encoding="utf-8"
        )

    def test_template_handles_meta_or_ctrl_s(self):
        tpl = self._template()
        # Detecção de ⌘S / Ctrl+S no listener.
        assert "metaKey" in tpl and "ctrlKey" in tpl
        assert "'s'" in tpl or '"s"' in tpl

    def test_template_handles_enter_to_mark_reviewed(self):
        tpl = self._template()
        # Enter precisa virar submit com next_action=next.
        assert "Enter" in tpl
        assert "next_action" in tpl
        assert "'next'" in tpl or '"next"' in tpl

    def test_template_avoids_hijacking_enter_in_textarea(self):
        tpl = self._template()
        # O handler precisa ignorar Enter quando o foco está em TEXTAREA.
        assert "TEXTAREA" in tpl

    def test_template_meta_s_submits_with_back(self):
        tpl = self._template()
        # ⌘S deve submeter com next_action=back (rascunho).
        assert "'back'" in tpl or '"back"' in tpl


def _template_text() -> str:
    from pathlib import Path

    return (Path(__file__).resolve().parents[2] / "templates/hymns/editor/revise_hymn.html").read_text(encoding="utf-8")


def _components_css() -> str:
    from pathlib import Path

    return (Path(__file__).resolve().parents[2] / "static/css/components.css").read_text(encoding="utf-8")


@pytest.mark.django_db
class TestReviseShortcutPills:
    """Pills sobre o textarea aplicam transformações no texto:
    - Sem linhas em branco
    - ¶ a cada 4 linhas
    - ¶ a cada 3 linhas
    São puramente client-side (vanilla JS) — backend não muda.
    """

    def test_template_has_three_shortcut_pills(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X")
        h = hymn_factory(hymn_book=hb, number=1)
        body = authenticated_client.get(reverse("hymns:editor_revise_hymn", kwargs={"pk": h.pk})).content.decode()
        assert body.count('data-shortcut="') == 3
        assert "Sem linhas em branco" in body
        assert "a cada 4 linhas" in body
        assert "a cada 3 linhas" in body

    def test_paragraph_pills_carry_data_n(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X")
        h = hymn_factory(hymn_book=hb, number=1)
        body = authenticated_client.get(reverse("hymns:editor_revise_hymn", kwargs={"pk": h.pk})).content.decode()
        assert 'data-n="3"' in body
        assert 'data-n="4"' in body

    def test_template_wires_shortcut_handler(self):
        tpl = _template_text()
        # JS handler precisa existir.
        assert "data-shortcut" in tpl
        assert "strip-blanks" in tpl
        assert "paragraph" in tpl

    def test_post_ignores_shortcut_attrs(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X")
        h = hymn_factory(hymn_book=hb, number=1, title="t", text="x")
        # POST sem nenhum campo data-shortcut deve continuar salvando normalmente.
        resp = authenticated_client.post(
            reverse("hymns:editor_revise_hymn", kwargs={"pk": h.pk}),
            {
                "number": 1,
                "title": "novo",
                "text": "novo",
                "review_status": Hymn.ReviewStatus.IN_REVIEW,
                "next_action": "back",
            },
        )
        assert resp.status_code == 302
        h.refresh_from_db()
        assert h.title == "novo"


@pytest.mark.django_db
class TestReviseCommonValuesPills:
    """Pills com valores mais usados em `repetitions` e `style` dentro do
    hinário. Editor clica e o input recebe o valor (client-side)."""

    def test_common_repetitions_are_canonical_five(self, authenticated_client, hymn_book_factory, hymn_factory):
        """Repetições vêm da constante canônica do Hymn — 5 padrões fixos,
        independente do que o hinário já tenha cadastrado."""
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X")
        # Mesmo com padrões "exóticos" cadastrados, as 5 pílulas fixas continuam.
        for n in range(10, 14):
            hymn_factory(hymn_book=hb, number=n, repetitions="1-2,3-4,5-6")
        target = hymn_factory(hymn_book=hb, number=1, repetitions="")
        resp = authenticated_client.get(reverse("hymns:editor_revise_hymn", kwargs={"pk": target.pk}))
        common = resp.context["common_repetitions"]
        assert list(common) == ["1-2,3-4", "1-2,3-4,1-4", "1-4", "3-4,1-4", "1-2,1-4"]
        # Valores devem aparecer no markup como pills.
        body = resp.content.decode()
        for value in common:
            assert f'data-suggestion="{value}"' in body

    def test_common_styles_are_canonical_three(self, authenticated_client, hymn_book_factory, hymn_factory):
        """Estilos vêm da constante canônica do Hymn — sempre Marcha/Valsa/Mazurca,
        independente do que o hinário já tenha cadastrado."""
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X")
        # Mesmo com vários "Hino" cadastrados, as pílulas continuam sendo as 3 fixas.
        for n in range(10, 14):
            hymn_factory(hymn_book=hb, number=n, style="Hino")
        target = hymn_factory(hymn_book=hb, number=1)
        resp = authenticated_client.get(reverse("hymns:editor_revise_hymn", kwargs={"pk": target.pk}))
        assert list(resp.context["common_styles"]) == ["Marcha", "Valsa", "Mazurca"]

    def test_canonical_pills_always_present_even_for_empty_book(
        self, authenticated_client, hymn_book_factory, hymn_factory
    ):
        """Tanto repetições quanto estilos vêm de constantes canônicas — não dependem
        do conteúdo do hinário."""
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X")
        h = hymn_factory(hymn_book=hb, number=1)
        resp = authenticated_client.get(reverse("hymns:editor_revise_hymn", kwargs={"pk": h.pk}))
        assert list(resp.context["common_repetitions"]) == [
            "1-2,3-4",
            "1-2,3-4,1-4",
            "1-4",
            "3-4,1-4",
            "1-2,1-4",
        ]
        assert list(resp.context["common_styles"]) == ["Marcha", "Valsa", "Mazurca"]


@pytest.mark.django_db
class TestReviseInlineDiff:
    """Diff inline palavra-por-palavra (gap 2). OCR `iluminna` vs current
    `ilumina` deve gerar tokens `t-sub`/`t-add` lado a lado, não linhas
    inteiras `+/-`."""

    def test_inline_diff_word_substitution_marks_tokens(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X")
        h = hymn_factory(
            hymn_book=hb,
            number=1,
            text="Sol da manhã\nQue ilumina",
            ocr_text="Sol da manhã\nQue iluminna",
        )
        body = authenticated_client.get(reverse("hymns:editor_revise_hymn", kwargs={"pk": h.pk})).content.decode()
        # Token sub para `iluminna` (vai sair) e add para `ilumina` (vai entrar).
        assert 't-sub"' in body or "t-sub'" in body
        assert "iluminna" in body
        assert "ilumina" in body

    def test_inline_diff_added_line_marked(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X")
        h = hymn_factory(
            hymn_book=hb,
            number=1,
            text="A\nB\nC",
            ocr_text="A\nB",
        )
        body = authenticated_client.get(reverse("hymns:editor_revise_hymn", kwargs={"pk": h.pk})).content.decode()
        # Linha "C" foi acrescentada → marcador add.
        assert "diff-line add" in body

    def test_inline_diff_counter_present(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X")
        h = hymn_factory(
            hymn_book=hb,
            number=1,
            text="A\nilumina",
            ocr_text="A\niluminna",
        )
        body = authenticated_client.get(reverse("hymns:editor_revise_hymn", kwargs={"pk": h.pk})).content.decode()
        assert "alterações" in body
        assert "acréscimos" in body

    def test_inline_diff_empty_when_no_ocr(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X")
        h = hymn_factory(hymn_book=hb, number=1, text="qualquer", ocr_text="")
        resp = authenticated_client.get(reverse("hymns:editor_revise_hymn", kwargs={"pk": h.pk}))
        diff = resp.context["inline_diff"]
        assert diff["lines"] == []
        assert diff["changes"] == diff["adds"] == diff["dels"] == 0


@pytest.mark.django_db
class TestReviseStatusColors:
    """Status segmentado pinta o ativo com cor por estado:
    not_reviewed → vermilion, in_review → gold, reviewed → moss."""

    def test_template_uses_status_segmented_classes(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X")
        h = hymn_factory(hymn_book=hb, number=1)
        body = authenticated_client.get(reverse("hymns:editor_revise_hymn", kwargs={"pk": h.pk})).content.decode()
        assert "status-segmented" in body
        assert 'data-status="not_reviewed"' in body
        assert 'data-status="in_review"' in body
        assert 'data-status="reviewed"' in body

    def test_components_css_defines_status_color_rules(self):
        css = _components_css()
        assert ".status-segmented" in css
        # Regra colorindo o ativo por data-status.
        assert "not_reviewed" in css and "vermilion" in css.lower()
        assert "in_review" in css and "gold" in css.lower()
        assert "reviewed" in css and "moss" in css.lower()


@pytest.mark.django_db
class TestReviseTypographyAndLayout:
    def test_number_and_title_use_font_display(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X")
        h = hymn_factory(hymn_book=hb, number=1, title="T")
        body = authenticated_client.get(reverse("hymns:editor_revise_hymn", kwargs={"pk": h.pk})).content.decode()
        # Procura `font-display` no atributo class dos inputs número/título.
        import re

        number_input = re.search(r'<input[^>]*name="number"[^>]*>', body, re.S)
        title_input = re.search(r'<input[^>]*name="title"[^>]*>', body, re.S)
        assert number_input and "font-display" in number_input.group(0)
        assert title_input and "font-display" in title_input.group(0)

    def test_textarea_uses_font_serif(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X")
        h = hymn_factory(hymn_book=hb, number=1, title="T", text="L")
        body = authenticated_client.get(reverse("hymns:editor_revise_hymn", kwargs={"pk": h.pk})).content.decode()
        import re

        ta = re.search(r'<textarea[^>]*name="text"[^>]*>', body, re.S)
        assert ta and "font-serif" in ta.group(0)

    def test_two_col_full_bleed_layout_no_gap(self):
        tpl = _template_text()
        # Layout 2-col full-bleed: usa lg:grid-cols-2 SEM gap-6 e com border-r.
        assert "lg:grid-cols-2" in tpl
        assert "lg:border-r" in tpl

    def test_action_bar_has_kbd_elements(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="X")
        h = hymn_factory(hymn_book=hb, number=1)
        body = authenticated_client.get(reverse("hymns:editor_revise_hymn", kwargs={"pk": h.pk})).content.decode()
        # 3 elementos kbd: Esc, ⌘S, ⏎ — todos no rodapé.
        assert body.count("<kbd") >= 3
        assert "Esc" in body
        assert "⌘S" in body
        assert "⏎" in body

    def test_autosave_status_lives_in_footer(self):
        tpl = _template_text()
        # data-autosave-status precisa estar dentro do <footer>.
        # Heurística: índice do <footer> < índice do data-autosave-status < índice do </footer>.
        f_open = tpl.find("<footer")
        f_close = tpl.find("</footer>", f_open)
        autosave = tpl.find("data-autosave-status")
        assert f_open != -1 and f_close != -1 and autosave != -1
        assert f_open < autosave < f_close
