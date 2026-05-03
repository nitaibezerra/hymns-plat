"""Template tags do app hymns."""

from django import template
from django.utils.html import conditional_escape, format_html_join
from django.utils.safestring import mark_safe

from apps.hymns.repetitions import parse_and_layout

register = template.Library()


@register.filter
def format_duration(seconds):
    """Formata segundos como mm:ss (ou h:mm:ss para áudios longos)."""
    if seconds is None:
        return ""
    try:
        s = int(seconds)
    except (TypeError, ValueError):
        return ""
    if s < 0:
        s = 0
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    if h:
        return f"{h}:{m:02d}:{sec:02d}"
    return f"{m}:{sec:02d}"


BAR_COLOR = "#000000"
BAR_COLUMN_WIDTH_PX = 9
TEXT_GUTTER_PX = 13.5  # coluna adjacente ao texto: 50% mais larga que as internas
BAR_THICKNESS_PX = 2.4
# Line-height espelha `_design/fase2-bundle/.../components.css` (`.hymn-body`
# = 1.55). Antes estava em 1.8 — espaçamento entre versos ficava esparso
# demais, longe do design impresso de cantador.
LINE_HEIGHT_EM = 1.55


@register.simple_tag
def render_hymn_body(hymn):
    """
    Renderiza a letra do hino com barras de repetição à esquerda.

    Fallback: se `hymn.repetitions` está vazio ou inválido, renderiza texto
    simples sem grid. Saída em HTML compacto (sem whitespace entre tags)
    para evitar que o CSS Grid crie anonymous items por cada text node.
    """
    text = hymn.text or ""
    data = parse_and_layout(text, hymn.repetitions or "")
    n = data["n_columns"]

    if n == 0:
        # `white-space: pre-line` preserva os `\n` do texto sem depender de CSS
        # externo. Sem isso, o navegador colapsa todas as quebras para espaço
        # simples e o hino vira uma única linha (regressão do redesign Fase 2).
        return mark_safe(
            '<div class="hymn-text" style="white-space:pre-line;'
            f'line-height:{LINE_HEIGHT_EM};">{conditional_escape(text)}</div>'
        )

    text_col = n + 1
    # col adjacente ao texto (última coluna de barras, grid-column = n) fica
    # mais larga para aumentar a respiração entre a barra e o texto.
    if n == 1:
        tracks = f"{TEXT_GUTTER_PX}px"
    else:
        tracks = f"repeat({n - 1},{BAR_COLUMN_WIDTH_PX}px) {TEXT_GUTTER_PX}px"
    grid_style = f"display:grid;grid-template-columns:{tracks} minmax(0,1fr);gap:0;"

    line_style = (
        f"white-space:pre-wrap;"
        f"overflow-wrap:break-word;"
        f"min-height:{LINE_HEIGHT_EM}em;"
        f"line-height:{LINE_HEIGHT_EM};"
    )

    lines_html = format_html_join(
        "",
        '<div class="hymn-line" style="grid-column:{};grid-row:{};{}">{}</div>',
        ((text_col, i + 1, mark_safe(line_style), row["text"]) for i, row in enumerate(data["rows"])),
    )

    # col 0 é adjacente ao texto → última coluna de barras no grid.
    # col N-1 é mais à esquerda → primeira coluna de barras no grid.
    bars_html = format_html_join(
        "",
        '<div class="repetition-bar" data-column="{}" data-start-verse="{}" '
        'data-end-verse="{}" style="grid-column:{};grid-row:{} / {};'
        f"border-left:{BAR_THICKNESS_PX}px solid {BAR_COLOR};"
        'margin:4px 0;align-self:stretch;justify-self:start;width:0;"></div>',
        (
            (
                bar["column"],
                bar["start_verse"],
                bar["end_verse"],
                n - bar["column"],
                bar["start_row"] + 1,
                bar["end_row"] + 2,
            )
            for bar in data["bars"]
        ),
    )

    return mark_safe(f'<div class="hymn-grid" style="{grid_style}">{lines_html}{bars_html}</div>')
