# Plano: Remover upload de YAML via web em /contribuir/

**Data:** 2026-04-21
**Abordagem:** TDD (Red → Green)

---

## Contexto

Após a integração do `hymn-ocr` no PR #8, `/contribuir/` aceita tanto YAML quanto PDF. A intenção agora é simplificar a porta de entrada para o usuário comum: **PDF é o único formato que o usuário sobe pela web**. O YAML continua disponível só onde faz sentido:

- `python manage.py import_yaml` (CLI/admin para imports em massa)
- Django Admin (CRUD direto)
- `/hinarios/novo/` (criação manual hino-a-hino, sem upload)
- `HymnBookVersion.yaml_file` em formulários do admin (versões podem ter um YAML anexado)

O motivo é UX: ter dois caminhos no mesmo formulário (toggle YAML/PDF) confunde mais do que ajuda. PDF é o que 95% dos usuários têm em mãos. Quem realmente tem YAML pronto é tipicamente um dev/admin com acesso ao CLI.

---

## Escopo

**Remover:**
- Campo `yaml_file` do `HymnBookUploadForm`
- Branch YAML em `upload_view` (toda a lógica de parse + tempfile + `find_duplicates_with_content` direto)
- Toggle YAML/PDF no template `upload.html` (e o JS que faz a troca)
- Testes que dependem do fluxo YAML web: `test_form_still_accepts_yaml_alone`, `test_upload_invalid_yaml_shows_error` (E2E), `TestUploadView::test_post_with_valid_yaml*` em `test_user_views.py` e `test_upload_views_simple.py`

**Manter (não tocar):**
- `apps/hymns/management/commands/import_yaml.py` e seus testes
- `HymnBookVersion.yaml_file` (model + admin + migration)
- `tests/conftest.py:sample_yaml_*` fixtures (usadas pelo command)
- `upload_disambiguate_view`, `upload_preview_view`, `upload_confirm_view` — continuam funcionando, dados vêm de PDF agora
- `/hinarios/novo/` (cadastro manual)

**Renomear/Refatorar:**
- `HymnBookUploadForm` → `HymnBookPdfUploadForm` (deixa claro o escopo). Remover prefixo `pdf_` dos campos: `name`, `owner_name`, `pdf_file`, `cover_image`. Mais simples.
- `upload_view` deixa de ter branch — vira diretamente o "PDF flow".

**Ajuste técnico:**
- No `upload_confirm_view` (criar `HymnBookVersion`), o `yaml_content` da session vem do OCR (dict serializado). Para gravar corretamente em `version.yaml_file`, converter para YAML real via `yaml.safe_dump(data)` antes de salvar. Sem isso, o arquivo gravado é Python repr, não YAML válido.

---

## Fases TDD

### Fase 1: Atualizar tests existentes (RED)

Editar testes que ainda esperavam YAML upload web:

- **`tests/unit/test_forms.py`** — substituir testes do `HymnBookUploadForm` (que validavam yaml_file) por equivalentes do `HymnBookPdfUploadForm`. Manter cobertura de campos obrigatórios, tamanho máximo, extensão, etc.
- **`tests/unit/test_pdf_upload_views.py`** — remover `test_form_still_accepts_yaml_alone`. Renomear `pdf_name` → `name`, `pdf_owner_name` → `owner_name` nos testes de form. Remover `test_form_rejects_when_both_yaml_and_pdf` (impossível agora).
- **`tests/unit/test_user_views.py`, `test_upload_views_simple.py`** — remover/atualizar testes que postavam YAML em `/contribuir/`.
- **`tests/e2e/test_upload.py`** — remover `test_upload_invalid_yaml_shows_error`. Adicionar (se não houver) um teste de upload válido / inválido de PDF.

Rodar suite e ver explosão controlada.

### Fase 2: Refatorar form (GREEN)

`apps/hymns/forms.py`:

```python
class HymnBookPdfUploadForm(forms.Form):
    pdf_file = forms.FileField(
        label="Arquivo PDF",
        widget=forms.FileInput(attrs={"accept": ".pdf", "class": "form-control"}),
    )
    name = forms.CharField(label="Nome do Hinário", max_length=255,
                           widget=forms.TextInput(attrs={"class": "form-control",
                                                         "placeholder": "Ex: O Justiceiro"}))
    owner_name = forms.CharField(label="Dono do Hinário", max_length=255,
                                 widget=forms.TextInput(attrs={"class": "form-control",
                                                               "placeholder": "Ex: Padrinho Sebastião"}))
    cover_image = forms.ImageField(label="Imagem de Capa (opcional)", required=False,
                                   widget=forms.FileInput(attrs={"accept": "image/*",
                                                                 "class": "form-control"}))

    def clean_pdf_file(self):
        f = self.cleaned_data.get("pdf_file")
        if not f.name.lower().endswith(".pdf"):
            raise forms.ValidationError("O arquivo deve ter extensão .pdf")
        if f.size > 50 * 1024 * 1024:
            raise forms.ValidationError("O arquivo não pode ser maior que 50MB")
        return f
```

Manter o nome antigo como alias temporário (`HymnBookUploadForm = HymnBookPdfUploadForm`) por uma sessão se houver hesitação — ou simplesmente fazer a substituição definitiva (preferido).

### Fase 3: Simplificar view (GREEN)

`apps/users/views.py:upload_view` perde o branching:

```python
@login_required
def upload_view(request):
    from apps.hymns.forms import HymnBookPdfUploadForm

    if request.method == "POST":
        form = HymnBookPdfUploadForm(request.POST, request.FILES)
        if form.is_valid():
            return _start_pdf_ocr(request, form, form.cleaned_data["pdf_file"])
    else:
        form = HymnBookPdfUploadForm()
    return render(request, "users/upload.html", {"form": form, "title": "Contribuir com Hinário"})
```

`_start_pdf_ocr` adapta-se aos novos nomes (`name`/`owner_name` em vez de `pdf_name`/`pdf_owner_name`).

`upload_confirm_view`: na hora de salvar `version.yaml_file`, dump real:

```python
import yaml
yaml_bytes = yaml.safe_dump(data, allow_unicode=True, sort_keys=False).encode("utf-8")
version.yaml_file.save(filename, ContentFile(yaml_bytes))
```

(substituindo o atual `version.yaml_file.save(...File(f))` que repassa o arquivo original).

Remover imports de `tempfile` e `yaml` que ficaram órfãos no `upload_view`.

### Fase 4: Refatorar template (GREEN)

`templates/users/upload.html` perde abas, JS, e seção YAML. Vira um formulário enxuto com PDF + name + owner + cover. O bloco "Como funciona?" é reescrito para mencionar só o caminho PDF/OCR.

### Fase 5: Verificação

- Suite completa verde
- Manual: `/contribuir/` mostra só formulário PDF
- Manual: upload → processing → preview → criar hinário novo (ou adicionar versão se duplicado)
- Manual: ao "Add as version", o `HymnBookVersion.yaml_file` baixado deve ser YAML válido (testar `yaml.safe_load`)

---

## Arquivos modificados

- `apps/hymns/forms.py` (renomear/simplificar)
- `apps/users/views.py` (sem branch + dump YAML real)
- `templates/users/upload.html` (sem toggle)
- `tests/unit/test_forms.py`
- `tests/unit/test_pdf_upload_views.py`
- `tests/unit/test_user_views.py`
- `tests/unit/test_upload_views_simple.py`
- `tests/e2e/test_upload.py`

## Arquivos NÃO modificados (preservar)

- `apps/hymns/management/commands/import_yaml.py`
- `apps/hymns/models.py` (HymnBookVersion.yaml_file fica)
- `apps/hymns/admin.py`
- `tests/unit/test_import_yaml_command.py`
- `tests/unit/test_hymnbook_version.py`
- `tests/conftest.py` (fixtures `sample_yaml_*` ficam)

---

## Verificação End-to-End

```bash
poetry run pytest tests/unit/ 2>&1 | tail -3      # esperado: ainda verde
poetry run pytest tests/e2e/ 2>&1 | tail -3       # esperado: ainda verde
poetry run black --check . && poetry run isort --check-only . && poetry run ruff check .
```

Manual:
1. http://localhost:8001/contribuir/ — formulário PDF puro (sem abas)
2. Upload de PDF inválido (não-PDF) → erro de validação
3. Upload válido → processing → preview → criar
4. Em caso de duplicata: "Adicionar como versão" → confirmar → conferir que `HymnBookVersion.yaml_file` baixado parseia com `yaml.safe_load`

## Critérios de Conclusão

- [ ] Suite verde após remoções/ajustes
- [ ] Lint clean
- [ ] `/contribuir/` mostra só formulário PDF
- [ ] Comando CLI `import_yaml` continua funcionando (sanity test)
- [ ] `HymnBookVersion.yaml_file` salvo via web é YAML real e parseável
