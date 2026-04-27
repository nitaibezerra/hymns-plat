# Plano: Integração hymn-ocr no fluxo /contribuir/ (TDD)

**Data:** 2026-04-21
**Abordagem:** Test-Driven Development (Red → Green)

---

## Contexto

O fluxo atual `/contribuir/` exige um YAML pronto. Quem só tem o PDF do hinário (caso real do Padrinho Sebastião — O Justiceiro foi importado fazendo OCR fora da plataforma e ajustando o YAML manualmente) não tem caminho self-service.

Já existe o pacote `hymn-ocr` (em `/Users/nitai/dev/hyms-platform/hymn-ocr`) que expõe uma API limpa: `pdf_to_hymnbook(pdf_path, *, progress_callback, **opts) -> HymnBook`. **Já aceita callback de progresso** (per página) e usa Pydantic — pronto pra usar como biblioteca.

Esta integração:
- Adiciona "Upload PDF" como segunda opção na primeira tela do wizard
- Roda OCR server-side, gera um dict equivalente ao do YAML, **reaproveita disambiguate/preview/confirm sem mudanças**
- Mostra progresso ao usuário (página X de Y) via polling
- Continua sendo síncrono do ponto de vista do usuário: ele fica numa página de processamento até terminar e segue pro preview

## Escopo

**Incluído:**
- Instalação do `hymn-ocr` como dependência local (path develop)
- Service wrapper que adapta `HymnBook` Pydantic → dict do upload flow
- Model `OCRTask` (estado + progresso) + migration
- Branching no `upload_view` para PDF
- Página de processamento com polling JS (sem Celery, sem WebSocket)
- Endpoint AJAX de status
- Threading via `threading.Thread(daemon=True)` com cleanup de conexões DB
- Validação de form: PDF mutuamente exclusivo com YAML
- Campos extra obrigatórios quando PDF: `name` e `owner_name` (hymn-ocr não extrai do PDF)

**Fora do escopo:**
- Modificações no `hymn-ocr` (já está pronto)
- Suporte a bytes/file-like (path-based é suficiente; usamos `tempfile`)
- Migração para Celery (manter thread; fica como follow-up se a pressão crescer)
- Dockerizar deps de sistema (poppler/tesseract) — assumir instalados em dev

**Decisões arquiteturais:**

- **Threading + DB polling, sem Celery.** Não há worker rodando em CI nem em prod, e introduzir Celery pra um único caso é overkill. Thread daemon escreve progresso na tabela `OCRTask`; cliente faz polling de 2s. Para `runserver` e gunicorn isso funciona; restart do servidor mata threads em curso (aceito — usuário só refaz upload).
- **PDF não vira HymnBookVersion.** PDF original é descartado após OCR. Se quisermos preservar depois, é incremento simples no `upload_preview_view` (cria HymnBookVersion com o PDF). Fora deste escopo.
- **Owner não auto-detectado.** O hymn-ocr nunca extrai owner_name do PDF. Form pede explicitamente.

---

## Fases TDD

### Fase 1: Instalar hymn-ocr como dependência

**🔴 Red:** `tests/unit/test_hymn_ocr_install.py` — `test_can_import_hymn_ocr` (basta verificar que o import funciona).

**🟢 Green:**
- `pyproject.toml`: `hymn-ocr = { path = "../hymn-ocr", develop = true }`
- `poetry lock && poetry install`
- README/docs/setup mencionando `brew install poppler tesseract tesseract-lang`

---

### Fase 2: Service wrapper

**🔴 Red:** `tests/unit/test_ocr_service.py`
- `test_run_ocr_returns_upload_data_dict` — mocka `pdf_to_hymnbook` retornando um `HymnBook` Pydantic; verifica que o wrapper devolve dict no shape do upload (`{"hymn_book": {"name", "owner", "hymns": [...]}}`)
- `test_run_ocr_passes_progress_callback` — verifica que o callback fornecido é repassado pra `pdf_to_hymnbook`
- `test_run_ocr_strips_temp_pdf_after_success`
- `test_run_ocr_strips_temp_pdf_after_exception`
- `test_run_ocr_raises_on_empty_hymnbook` — se OCR não extraiu nada útil

**🟢 Green:** `apps/hymns/services/ocr.py`
```python
from typing import Callable, Optional
from pathlib import Path
import os

from hymn_ocr import pdf_to_hymnbook

def run_ocr(pdf_path: str, *, name: str, owner_name: str,
            progress_callback: Optional[Callable[[int, int], None]] = None,
            cleanup: bool = True) -> dict:
    try:
        hymnbook = pdf_to_hymnbook(
            pdf_path, name=name, owner_name=owner_name,
            progress_callback=progress_callback,
        )
        if not hymnbook.hymns:
            raise ValueError("Nenhum hino extraído do PDF.")
        # Adapta HymnBook Pydantic ao shape esperado pelo upload flow:
        return {
            "hymn_book": {
                "name": hymnbook.name,
                "owner": hymnbook.owner_name,
                "intro_name": hymnbook.intro_name or "",
                "hymns": [h.model_dump() for h in hymnbook.hymns],
            }
        }
    finally:
        if cleanup and os.path.exists(pdf_path):
            os.remove(pdf_path)
```

---

### Fase 3: Model OCRTask

**🔴 Red:** `tests/unit/test_ocr_task_model.py`
- `test_task_starts_pending`
- `test_progress_percentage_is_computed_from_pages`
- `test_mark_processing_sets_started_at_and_total`
- `test_mark_progress_updates_current_page`
- `test_mark_completed_stores_result_and_finished_at`
- `test_mark_failed_stores_error_and_finished_at`
- `test_invalid_state_transition_is_rejected`

**🟢 Green:** `apps/hymns/models.py` (ou novo `apps/hymns/ocr_models.py` para isolar)
```python
class OCRTask(models.Model):
    STATUS_PENDING = "pending"
    STATUS_PROCESSING = "processing"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey("users.User", on_delete=models.CASCADE)
    status = models.CharField(max_length=20, default=STATUS_PENDING)
    current_page = models.PositiveIntegerField(default=0)
    total_pages = models.PositiveIntegerField(default=0)
    result_data = models.JSONField(null=True, blank=True)  # dict do upload flow
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    @property
    def progress_pct(self) -> int:
        if self.total_pages <= 0:
            return 0
        return min(100, int(self.current_page * 100 / self.total_pages))
```

Migration via `manage.py makemigrations hymns`.

---

### Fase 4: Form, view de upload (branching), endpoint de status

**🔴 Red:** `tests/unit/test_pdf_upload_views.py`
- `test_upload_form_rejects_when_neither_yaml_nor_pdf`
- `test_upload_form_rejects_when_both_yaml_and_pdf`
- `test_upload_form_requires_name_and_owner_when_pdf`
- `test_upload_view_with_pdf_creates_ocr_task_and_redirects_to_processing`
- `test_processing_view_renders_progress_for_pending_task`
- `test_processing_view_redirects_to_disambiguate_when_task_complete_with_dupes`
- `test_processing_view_redirects_to_preview_when_task_complete_no_dupes`
- `test_processing_view_shows_error_when_task_failed`
- `test_status_endpoint_returns_json_with_progress`
- `test_status_endpoint_returns_403_for_other_user_task`

**🟢 Green:**

`apps/hymns/forms.py` — estender `HymnBookUploadForm`:
- Adicionar `pdf_file` (opcional), `pdf_name`, `pdf_owner_name`
- `clean()` valida exclusividade YAML/PDF e exigência de name/owner com PDF

`apps/users/views.py`:
- `upload_view`: detecta `pdf_file`, salva em tempfile, cria `OCRTask(status=PENDING)`, dispara thread, redirect para `users:upload_processing` com `?task=<uuid>`
- `upload_processing_view`: mostra a página de progresso. Se task estiver `completed`, popula a session com o `result_data` (mesma shape do YAML) e redireciona para `users:upload_disambiguate` ou `users:upload_preview` (chamando `find_duplicates_with_content`). Se `failed`, mostra erro.
- `upload_ocr_status_view`: AJAX/JSON `{status, current, total, percent, ready}`. Bloqueia se `task.user != request.user`.

`apps/users/urls.py`:
```python
path("contribuir/processando/", views.upload_processing_view, name="upload_processing"),
path("contribuir/ocr-status/<uuid:task_id>/", views.upload_ocr_status_view, name="upload_ocr_status"),
```

Worker thread (helper em `apps/hymns/services/ocr.py`):
```python
def run_ocr_async(task_id, pdf_path, name, owner_name):
    from django.db import close_old_connections
    from .models import OCRTask  # ajustar import

    def worker():
        close_old_connections()
        task = OCRTask.objects.get(pk=task_id)
        task.status = OCRTask.STATUS_PROCESSING
        task.started_at = timezone.now()
        task.save()

        def on_progress(current, total):
            OCRTask.objects.filter(pk=task_id).update(
                current_page=current, total_pages=total,
            )

        try:
            data = run_ocr(pdf_path, name=name, owner_name=owner_name,
                           progress_callback=on_progress, cleanup=True)
            task.refresh_from_db()
            task.result_data = data
            task.status = OCRTask.STATUS_COMPLETED
            task.finished_at = timezone.now()
            task.save()
        except Exception as e:
            task.refresh_from_db()
            task.error_message = str(e)
            task.status = OCRTask.STATUS_FAILED
            task.finished_at = timezone.now()
            task.save()
        finally:
            close_old_connections()

    threading.Thread(target=worker, daemon=True).start()
```

---

### Fase 5: Templates

**🔴 Red:** estender `tests/e2e/test_upload.py` ou criar `tests/unit/test_upload_templates.py` para renderização básica:
- `test_upload_template_shows_pdf_section_when_logged_in`
- `test_processing_template_polls_status_endpoint`

**🟢 Green:**

`templates/users/upload.html`:
- Tabs/radio: "Tenho YAML" vs "Tenho PDF"
- Quando PDF: mostra `pdf_file`, `pdf_name`, `pdf_owner_name`, com aviso "Pode levar 1-3 minutos para PDFs grandes"
- Quando YAML: campo único `yaml_file` (atual)

`templates/users/upload_processing.html` (novo):
- Spinner + "Processando: página X de Y (Z%)"
- `<script>` faz `fetch('/contribuir/ocr-status/{task_id}/')` a cada 2s
- Quando `ready: true`: `window.location` para `next_url` retornado pelo backend
- Botão "Cancelar" (opcional, futuro)

Templates de disambiguate/preview/confirm: **inalterados**.

---

### Fase 6: Verificação manual e polish

- Subir Docker, rodar `runserver`
- Login como `nitai@test.com`, `/contribuir/` → escolher PDF → upload do `O-Justiceiro.pdf` → assistir progresso → preview → confirmar com `--update` ou em hinário novo "O Justiceiro Teste"
- Testar fallback: upload de YAML continua funcionando
- Testar erro: PDF inválido (texto curto)
- Cleanup: confirmar que tempfiles `/tmp/*.pdf` são removidos

---

## Arquivos a Criar/Modificar

### Novos
- `apps/hymns/services/__init__.py`
- `apps/hymns/services/ocr.py` — wrapper `run_ocr` + `run_ocr_async`
- `apps/hymns/migrations/000X_ocrtask.py` — gerada
- `templates/users/upload_processing.html`
- `tests/unit/test_hymn_ocr_install.py`
- `tests/unit/test_ocr_service.py`
- `tests/unit/test_ocr_task_model.py`
- `tests/unit/test_pdf_upload_views.py`
- `_plan/plano-ocr-pdf-upload.md` (cópia deste plano para histórico do projeto)

### Modificados
- `pyproject.toml` — dep `hymn-ocr` path develop
- `apps/hymns/models.py` — adicionar `OCRTask`
- `apps/hymns/forms.py` — `HymnBookUploadForm` ganha pdf + name + owner
- `apps/users/views.py` — branch PDF em `upload_view`, novas `upload_processing_view`, `upload_ocr_status_view`
- `apps/users/urls.py` — 2 rotas novas
- `templates/users/upload.html` — toggle YAML/PDF

---

## Padrões/Funções Reusados

- `apps/hymns/disambiguation.py:find_duplicates_with_content` — chamada igual em ambos os caminhos
- `apps/users/views.py:upload_disambiguate_view`, `upload_preview_view`, `upload_confirm_view` — inalterados
- `apps/hymns/forms.py:HymnBookUploadForm` (pattern existente)
- `tempfile.NamedTemporaryFile` — já é o padrão usado para YAML
- `request.session["upload_data"]` — mesmo formato dos dois fluxos

Do `hymn-ocr`:
- `pdf_to_hymnbook(path, *, name, owner_name, progress_callback)`
- `HymnBook`, `Hymn` (Pydantic) — `model_dump()` direto

---

## Verificação End-to-End

1. **Testes unitários:**
```bash
cd /Users/nitai/dev/hyms-platform/hymns-plat
poetry run pytest tests/unit/ -v
poetry run pytest tests/unit/ --cov=apps.hymns --cov=apps.users --cov-report=term-missing
```
Esperado: todos passando, sem regressão dos 315 atuais.

2. **Manual (server local em `:8001`):**
- Login → `/contribuir/` → escolher "PDF" → upload `O-Justiceiro.pdf` (179 páginas)
- Página de processamento mostra "Página X de 179 (Y%)" atualizando a cada ~2s
- Ao terminar (~3min): redirect para `/contribuir/desambiguar/` ou `/contribuir/preview/`
- Confirmar criação → redirect para detalhe do hinário com hinos importados
- Repetir o fluxo com YAML pra garantir que não regrediu

3. **Logs/sanity:**
```bash
ls /tmp/*.pdf  # deve estar vazio depois do processamento
poetry run python manage.py shell -c "from apps.hymns.models import OCRTask; print(OCRTask.objects.values('status','current_page','total_pages'))"
```

4. **Edge cases:**
- PDF corrompido / sem hinos → status `failed`, mensagem visível ao usuário
- Usuário fecha aba durante processamento → thread continua, task fica `completed` no banco; usuário pode reabrir `/contribuir/processando/?task=<uuid>` (futuro: link em "Meus Uploads")
- Reload do `runserver` durante OCR → thread morre, task fica `processing` órfã (limitação aceita; documentar em follow-up)

---

## Critérios de Conclusão

- [ ] Todos os testes novos passando, suite continua verde
- [ ] Coverage `apps.hymns` ≥ 85%, `apps.users` ≥ 80%
- [ ] Upload de YAML continua funcionando (não-regressão)
- [ ] Upload de PDF do "O Justiceiro" gera o mesmo (ou melhor) resultado que o que importamos manualmente
- [ ] Progresso visível no browser
- [ ] Sem deps novas além de `hymn-ocr` (que traz suas próprias)
- [ ] Plano salvo em `_plan/plano-ocr-pdf-upload.md` durante execução
