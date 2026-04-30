"""Regression: Django {# ... #} comments only work single-line. If they span
multiple lines they render as raw text to the user. The audit caught two of
those (upload page, mobile drawer); this test prevents future ones."""

from pathlib import Path

import pytest

TEMPLATES_DIR = Path(__file__).resolve().parents[2] / "templates"


@pytest.mark.parametrize("template_path", list(TEMPLATES_DIR.rglob("*.html")))
def test_no_multiline_django_comment_block(template_path):
    """An open `{#` whose matching `#}` is on a different line is a bug —
    Django renders it as plain text. Use `{% comment %}...{% endcomment %}`
    for multi-line comments instead."""
    text = template_path.read_text(encoding="utf-8")
    for lineno, line in enumerate(text.splitlines(), start=1):
        opens = line.count("{#")
        closes = line.count("#}")
        if opens != closes:
            pytest.fail(
                f"{template_path}:{lineno} has unbalanced {{# … #}} on a single line. "
                f"Use {{% comment %}}…{{% endcomment %}} for multi-line comments. "
                f"Line: {line.rstrip()[:120]}"
            )
