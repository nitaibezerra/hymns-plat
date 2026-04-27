"""Template tags do app hymns."""

from django import template
from django.utils.html import conditional_escape, format_html_join
from django.utils.safestring import mark_safe

from apps.hymns.repetitions import parse_and_layout

register = template.Library()


BAR_COLOR = "#000000"
BAR_COLUMN_WIDTH_PX = 9
TEXT_GUTTER_PX = 13.5  # coluna adjacente ao texto: 50% mais larga que as internas
BAR_THICKNESS_PX = 2.4
LINE_HEIGHT_EM = 1.8


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
        return mark_safe(f'<div class="hymn-text">{conditional_escape(text)}</div>')

    text_col = n + 1
    # col adjacente ao texto (última coluna de barras, grid-column = n) fica
    # mais larga para aumentar a respiração entre a barra e o texto.
    if n == 1:
        tracks = f"{TEXT_GUTTER_PX}px"
    else:
        tracks = f"repeat({n - 1},{BAR_COLUMN_WIDTH_PX}px) {TEXT_GUTTER_PX}px"
    grid_style = (
        f"display:grid;grid-template-columns:{tracks} minmax(0,1fr);gap:0;"
    )

    line_style = (
        f"white-space:pre-wrap;"
        f"overflow-wrap:break-word;"
        f"min-height:{LINE_HEIGHT_EM}em;"
        f"line-height:{LINE_HEIGHT_EM};"
    )

    lines_html = format_html_join(
        "",
        '<div class="hymn-line" style="grid-column:{};grid-row:{};{}">{}</div>',
        (
            (text_col, i + 1, mark_safe(line_style), row["text"])
            for i, row in enumerate(data["rows"])
        ),
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

    return mark_safe(
        f'<div class="hymn-grid" style="{grid_style}">{lines_html}{bars_html}</div>'
    )
