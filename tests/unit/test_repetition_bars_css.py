"""Regressão: garantir que a regra `.repetition-bar` em components.css esteja
escopada à prévia do editor (`.preview-stanza`) e não vaze para o sistema
antigo (`.hymn-grid` em corrido/carrossel/hymn_detail).

A Fase 2 v3 (PR #32) introduziu uma regra GLOBAL `.repetition-bar { position:
absolute; ... }` que conflitava com as barras de grid antigas — elas escapavam
do CSS Grid e ficavam invisíveis no DOM.
"""

import re
from pathlib import Path


def _components_css() -> str:
    path = Path(__file__).resolve().parents[2] / "static" / "css" / "components.css"
    return path.read_text(encoding="utf-8")


class TestRepetitionBarsCssScope:
    def test_no_unscoped_repetition_bar_rule(self):
        css = _components_css()
        # Regras toplevel: começam em coluna 0 e abrem com `.repetition-bar {`.
        # Permitidos: `.preview-stanza .repetition-bar`, `.hymn-grid .repetition-bar`.
        bare = re.findall(r"(?m)^\.repetition-bar\s*\{", css)
        assert bare == [], (
            "Encontrada regra global `.repetition-bar` em components.css "
            "(seletor sem âncora). Escopar a `.preview-stanza .repetition-bar` "
            "para não vazar para o sistema antigo de barras (hymn-grid em "
            "corrido/carrossel)."
        )

    def test_hymn_grid_scoped_rule_still_present(self):
        """Sanidade: o tweak de cor/opacidade das barras continua escopado a
        `.hymn-grid` (não foi acidentalmente removido). Esse é o ÚNICO lugar
        onde o app estiliza `.repetition-bar` agora — a prévia do editor
        reusa o mesmo markup do `render_hymn_body`."""
        css = _components_css()
        assert ".hymn-grid .repetition-bar" in css
