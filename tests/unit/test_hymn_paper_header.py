"""Header 'página do hinário em papel': as 3 telas (hymn_detail, corrido,
carrossel) devem usar o mesmo trio de classes do design — `.hymn-num`,
`.hymn-title`, `.title-rule` — e a régua warm de 70% no lugar do
`<hr w-32 border-ink/30>` antigo.

Referência: `_design/fase2-bundle/project/screens/hymn-detail.jsx` linhas 29-49
e `_design/fase2-bundle/project/styles/components.css` linhas 188-249.
"""

from datetime import date
from pathlib import Path

import pytest
from django.urls import reverse

PROJECT_ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.django_db
class TestHymnDetailPaperHeader:
    def test_uses_paper_header_classes(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Cruzeiro Test")
        h = hymn_factory(hymn_book=hb, number=7, title="Estrela Brilhante")
        resp = client.get(reverse("hymns:hymn_detail", kwargs={"pk": h.pk}))
        assert resp.status_code == 200
        body = resp.content.decode()
        assert 'class="hymn-num"' in body
        assert 'class="hymn-title"' in body
        assert 'class="title-rule"' in body

    def test_does_not_use_old_hr(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Cruzeiro Test 2")
        h = hymn_factory(hymn_book=hb, number=7)
        body = client.get(reverse("hymns:hymn_detail", kwargs={"pk": h.pk})).content.decode()
        assert "border-ink/30" not in body
        assert "w-32 mx-auto border-ink" not in body

    def test_meta_row_with_fields(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Cruzeiro Test 3")
        h = hymn_factory(
            hymn_book=hb,
            number=1,
            style="Mazurca",
            received_at=date(1934, 5, 12),
            offered_to="N. Sra. Conceição",
        )
        body = client.get(reverse("hymns:hymn_detail", kwargs={"pk": h.pk})).content.decode()
        assert 'class="hymn-meta-row"' in body
        assert "Mazurca" in body
        assert "Conceição" in body

    def test_meta_row_omitted_when_empty(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Cruzeiro Test 4")
        h = hymn_factory(hymn_book=hb, number=1, style="", offered_to="")
        body = client.get(reverse("hymns:hymn_detail", kwargs={"pk": h.pk})).content.decode()
        assert 'class="hymn-meta-row"' not in body


@pytest.mark.django_db
class TestHymnbookCorridoPaperHeader:
    def test_uses_paper_header_classes(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Corrido Test")
        hymn_factory(hymn_book=hb, number=1)
        url = reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}) + "?mode=corrido"
        body = client.get(url).content.decode()
        idx = body.find('data-mode-pane="corrido"')
        assert idx >= 0
        section = body[idx : idx + 8000]
        assert 'class="hymn-num"' in section
        assert 'class="hymn-title"' in section
        assert 'class="title-rule"' in section
        assert "w-24 mx-auto border-rule" not in section


@pytest.mark.django_db
class TestHymnbookCarrosselPaperHeader:
    def test_uses_paper_header_classes(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="Carrossel Test")
        hymn_factory(hymn_book=hb, number=1)
        url = reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}) + "?mode=carrossel"
        body = client.get(url).content.decode()
        idx = body.find('data-mode-pane="carrossel"')
        assert idx >= 0
        section = body[idx : idx + 8000]
        assert 'class="hymn-num"' in section
        assert 'class="hymn-title"' in section
        assert 'class="title-rule"' in section


class TestComponentsCssDefinesPaperHeader:
    """O CSS precisa definir os blocos da família `.hymn-page` para o markup
    novo ter aparência."""

    def _css(self) -> str:
        return (PROJECT_ROOT / "static/css/components.css").read_text(encoding="utf-8")

    def test_classes_present(self):
        css = self._css()
        for cls in (
            ".hymn-page .hymn-num",
            ".hymn-page .hymn-title",
            ".hymn-page .title-rule",
            ".hymn-page .hymn-meta-row",
        ):
            assert cls in css, f"missing CSS rule for {cls}"

    def test_title_rule_is_70pct_wide(self):
        css = self._css()
        idx = css.index(".hymn-page .title-rule")
        block = css[idx : idx + 400]
        assert "width: 70%" in block

    def test_hymn_title_28px(self):
        css = self._css()
        idx = css.index(".hymn-page .hymn-title")
        block = css[idx : idx + 400]
        assert "font-size: 28px" in block
