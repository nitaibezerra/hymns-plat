"""
Tests para o campo `Hymn.section` (suporte a hinários multi-seção).

Cobre:
- Modelo: default vazio, não compõe unique_together.
- import_yaml: lê `section:` do YAML.
- HymnForm: campo presente.
- Template hymnbook_detail (modo indice): agrupa por section quando presente,
  sem regressão visual em hinários single-section.
- Template hymn_detail: meta-row e detalhes mostram seção quando preenchida.
"""

from pathlib import Path

import pytest
from django.core.management import call_command
from django.test import Client

from apps.hymns.forms import HymnForm
from apps.hymns.models import Hymn, HymnBook

# ---------------------------------------------------------------------------
# Modelo
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_hymn_section_default_is_blank_string():
    book = HymnBook.objects.create(name="X", owner_name="Y")
    hymn = Hymn.objects.create(hymn_book=book, number=1, title="t", text="x")
    assert hymn.section == ""


@pytest.mark.django_db
def test_hymn_section_does_not_affect_unique_together():
    """unique_together permanece (hymn_book, number); seções diferentes
    com mesmo número no mesmo hinário continuam proibidas."""
    from django.db import IntegrityError, transaction

    book = HymnBook.objects.create(name="X", owner_name="Y")
    Hymn.objects.create(hymn_book=book, number=1, title="A", text="x", section="Sec1")
    with pytest.raises(IntegrityError), transaction.atomic():
        Hymn.objects.create(hymn_book=book, number=1, title="B", text="y", section="Sec2")


# ---------------------------------------------------------------------------
# import_yaml
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_import_yaml_reads_section_field(tmp_path: Path):
    yaml_text = """hymn_book:
  name: Multi Section Book
  owner: Test Owner
  hymns:
    - number: 1
      title: First
      section: Offered to X
      text: |
        a
    - number: 2
      title: Second
      section: Main Body
      text: |
        b
    - number: 3
      title: Third
      text: |
        c
"""
    yaml_path = tmp_path / "book.yaml"
    yaml_path.write_text(yaml_text)
    call_command("import_yaml", str(yaml_path))

    h1 = Hymn.objects.get(number=1)
    h2 = Hymn.objects.get(number=2)
    h3 = Hymn.objects.get(number=3)
    assert h1.section == "Offered to X"
    assert h2.section == "Main Body"
    assert h3.section == ""


@pytest.mark.django_db
def test_import_yaml_without_section_field_keeps_blank(tmp_path: Path):
    """Compat backward: YAMLs antigos sem `section:` continuam funcionando."""
    yaml_text = """hymn_book:
  name: Legacy Book
  owner: Owner
  hymns:
    - number: 1
      title: T
      text: x
"""
    yaml_path = tmp_path / "legacy.yaml"
    yaml_path.write_text(yaml_text)
    call_command("import_yaml", str(yaml_path))
    assert Hymn.objects.get().section == ""


# ---------------------------------------------------------------------------
# HymnForm
# ---------------------------------------------------------------------------


def test_hymn_form_includes_section_field():
    assert "section" in HymnForm.Meta.fields


@pytest.mark.django_db
def test_hymn_form_section_is_optional():
    book = HymnBook.objects.create(name="X", owner_name="Y")
    form = HymnForm(
        data={"number": 1, "title": "X", "text": "y", "section": ""},
        hymn_book=book,
    )
    # Vazio é aceito (CharField blank=True).
    form.is_valid()
    assert "section" not in form.errors


# ---------------------------------------------------------------------------
# Template hymnbook_detail.html — modo indice
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_indice_groups_hymns_by_section_when_present(client: Client):
    book = HymnBook.objects.create(name="Multi", owner_name="O", is_published=True)
    Hymn.objects.create(hymn_book=book, number=1, title="A", text="t", section="Seção Alfa")
    Hymn.objects.create(hymn_book=book, number=2, title="B", text="t", section="Seção Alfa")
    Hymn.objects.create(hymn_book=book, number=3, title="C", text="t", section="Seção Beta")

    resp = client.get(f"/hinarios/{book.slug}/?mode=indice")
    assert resp.status_code == 200
    body = resp.content.decode()
    # Cabeçalhos das duas seções aparecem
    assert "Seção Alfa" in body
    assert "Seção Beta" in body
    # Marcador `data-section-header` é o sinal estável de que o agrupamento foi aplicado
    assert body.count("data-section-header") == 2


@pytest.mark.django_db
def test_indice_renders_no_section_header_for_single_section_hinario(client: Client):
    """Hinários single-section (Cruzeiro, etc.) não devem mostrar nenhum
    cabeçalho de seção — preserva visual histórico."""
    book = HymnBook.objects.create(name="Single", owner_name="O", is_published=True)
    for n in range(1, 4):
        Hymn.objects.create(hymn_book=book, number=n, title=f"H{n}", text="t")

    resp = client.get(f"/hinarios/{book.slug}/?mode=indice")
    assert resp.status_code == 200
    assert "data-section-header" not in resp.content.decode()


# ---------------------------------------------------------------------------
# Template hymn_detail.html
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_hymn_detail_shows_section_when_present(client: Client):
    book = HymnBook.objects.create(name="MS", owner_name="O", is_published=True)
    h = Hymn.objects.create(hymn_book=book, number=1, title="T", text="x", section="Offered to Sônia")
    resp = client.get(f"/hinos/{h.pk}/")
    assert resp.status_code == 200
    body = resp.content.decode()
    assert "Offered to Sônia" in body


@pytest.mark.django_db
def test_hymn_detail_omits_section_label_when_blank(client: Client):
    book = HymnBook.objects.create(name="NS", owner_name="O", is_published=True)
    h = Hymn.objects.create(hymn_book=book, number=1, title="T", text="x")
    resp = client.get(f"/hinos/{h.pk}/")
    assert resp.status_code == 200
    body = resp.content.decode()
    # Sem o rótulo 'Seção' quando section está vazio
    assert "Seção · " not in body
    assert '<dt class="text-ink-soft">Seção</dt>' not in body
