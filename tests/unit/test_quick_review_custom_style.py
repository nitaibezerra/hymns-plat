"""Revisão ágil — input livre de estilo + guard genérico nos atalhos.

Mudanças após o refactor:
- Campo `style` virou `<input type="text">` visível ao lado dos 3 botões
  (Marcha/Valsa/Mazurca). Os botões preenchem o input; o input é source of truth.
- Atalhos `keydown` desabilitados quando o foco está em qualquer INPUT/TEXTAREA/
  SELECT/contenteditable — não apenas no input de repetições.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _make_editor(user):
    user.groups.add(Group.objects.get(name="editor"))
    return user


@pytest.mark.django_db
class TestQuickReviewStyleInput:
    def test_style_input_is_text_with_marker(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="Estilo Livre")
        hymn_factory(hymn_book=hb, number=1, title="Hino 1")
        url = reverse("hymns:editor_quick_review", kwargs={"slug": hb.slug})
        body = authenticated_client.get(url).content.decode()
        # Input visível (não mais hidden) com data-quick-style
        assert "data-quick-style" in body
        assert 'type="text" name="style"' in body
        # Hidden input foi removido
        assert 'type="hidden" name="style"' not in body

    def test_custom_style_saves(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="Estilo Custom")
        h = hymn_factory(hymn_book=hb, number=1, title="Hino X")
        url = reverse("hymns:editor_quick_review", kwargs={"slug": hb.slug}) + f"?h={h.number}"
        resp = authenticated_client.post(
            url,
            data={"style": "Hino do Mestre", "repetitions": ""},
        )
        assert resp.status_code in (200, 302)
        h.refresh_from_db()
        assert h.style == "Hino do Mestre"


class TestQuickReviewKeyboardGuard:
    """Bug fix: atalhos 1/2/3/4 e M/V/Z não devem disparar quando o cursor
    está em qualquer INPUT/TEXTAREA. O guard antigo só protegia o input de
    repetições, fazendo o estilo livre quebrar."""

    def _js(self) -> str:
        return (PROJECT_ROOT / "static/js/quick-review.js").read_text(encoding="utf-8")

    def test_guard_covers_any_input_or_textarea(self):
        js = self._js()
        # Padrão "antigo" (restrito ao input de reps) NÃO pode mais existir
        assert (
            "document.activeElement === repsInput" not in js
        ), "guard antigo restrito quebra input livre de estilo — substituir por checagem genérica"
        # Novo guard: detecta INPUT/TEXTAREA/SELECT via tagName
        assert "/^(INPUT|TEXTAREA|SELECT)$/.test" in js or "INPUT|TEXTAREA" in js

    def test_guard_handles_contenteditable(self):
        js = self._js()
        assert "isContentEditable" in js

    def test_style_input_setter_uses_input_not_hidden(self):
        """JS escreve no `styleInput` (não no antigo `styleHidden`)."""
        js = self._js()
        assert "styleHidden" not in js
        assert "styleInput" in js
