"""
Tests for `templates/hymns/_partials/_form_field.html` — partial reusável que
renderiza label-eyebrow + control + help/erro.
"""

from django import forms
from django.template.loader import render_to_string


class _ToyForm(forms.Form):
    required_name = forms.CharField(
        label="Required name",
        widget=forms.TextInput(attrs={"class": "input-cls"}),
    )
    optional_email = forms.EmailField(
        label="Optional email",
        required=False,
        help_text="Opcional · usado só para contato.",
        widget=forms.EmailInput(attrs={"class": "input-cls"}),
    )
    has_error_field = forms.CharField(label="With error", required=True)


def _render(field, **ctx):
    return render_to_string("hymns/_partials/_form_field.html", {"field": field, **ctx})


class TestFormFieldPartial:
    def test_required_field_renders_asterisk_in_rust(self):
        form = _ToyForm()
        html = _render(form["required_name"])
        assert "text-rust" in html
        assert "*" in html
        assert "Required name" in html
        assert 'class="input-cls"' in html  # widget class preserved

    def test_optional_field_renders_help_in_ink_mute(self):
        form = _ToyForm()
        html = _render(form["optional_email"])
        assert "Opcional · usado só para contato." in html
        assert "text-ink-mute" in html
        # Sem erros, sem mensagem rust nesse partial:
        assert "text-rust mt-1.5" not in html

    def test_error_takes_precedence_over_help(self):
        form = _ToyForm(data={"required_name": "ok", "has_error_field": ""})
        assert not form.is_valid()
        html = _render(form["has_error_field"])
        assert "text-rust mt-1.5" in html  # mensagem de erro

    def test_eyebrow_override_uses_custom_label(self):
        form = _ToyForm()
        html = _render(form["required_name"], eyebrow="Nome completo")
        assert "Nome completo" in html
        # O label original sumiu do eyebrow (mas pode aparecer no `for=` do label tag — não importa)
        assert ">Required name<" not in html

    def test_no_help_no_error_does_not_emit_paragraph(self):
        form = _ToyForm()
        html = _render(form["required_name"])
        # Sem help_text e sem erros, o partial não deve emitir nenhum <p>:
        assert "<p " not in html
