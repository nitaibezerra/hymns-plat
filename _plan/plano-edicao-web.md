# Plano: Edição e Cadastro Web de Hinos e Hinários (TDD)

**Data:** 2026-04-06
**Abordagem:** Test-Driven Development (Red → Green → Refactor)
**Prioridade:** Fase 4+ (pós-MVP)

---

## Contexto

Atualmente usuários só conseguem criar hinários via upload YAML (fluxo de 4 passos) ou via Django Admin. Não há como:

- Corrigir erros em hinários já subidos
- Adicionar hinos individuais (ex.: completar os 32 hinos faltantes de "O Justiceiro" extraídos com erros de OCR)
- Editar metadados de um hinário
- Criar um hinário manualmente sem YAML

Também identificamos dois **gaps críticos de TypeSense sync**:
1. Edições via Admin não re-indexam → busca fica com dados stale
2. Deleções de hinos não removem do TypeSense → registros órfãos

Este plano resolve os dois problemas: entrega CRUD web para hinos/hinários e fecha os gaps via Django signals.

---

## Escopo

**Operações CRUD via web** (todas exigem login + permissão):

| Ação | Entidade | Rota |
|------|----------|------|
| Criar | HymnBook | `/hinarios/novo/` |
| Editar | HymnBook | `/hinarios/<slug>/editar/` |
| Deletar | HymnBook | `/hinarios/<slug>/deletar/` |
| Criar | Hymn | `/hinarios/<slug>/hinos/novo/` |
| Editar | Hymn | `/hinos/<uuid>/editar/` |
| Deletar | Hymn | `/hinos/<uuid>/deletar/` |

**Permissão:** `request.user == hymnbook.owner_user` OU `request.user.is_superuser`. A segunda condição permite superuser editar hinários importados via YAML command (que têm `owner_user=NULL`).

**Fora do escopo:**
- Edição de `HymnBookVersion` (tem fluxo próprio)
- Edição de `HymnAudio` (já tem moderação)
- Transferência de ownership
- "Reivindicar" hinário sem dono

---

## Fases TDD

### Fase 1: Signals de TypeSense (Foundation)

**Por que primeiro?** Tudo depende disso. Se os signals funcionam, qualquer edição (admin, web, command) sincroniza automaticamente.

**🔴 Red — escrever testes:**
Criar `tests/unit/test_typesense_signals.py`:
- `test_hymn_post_save_calls_index_hymn` (mockar `index_hymn`)
- `test_hymn_post_delete_calls_delete_hymn` (mockar `delete_hymn`)
- `test_hymnbook_post_save_reindexes_children_on_update`
- `test_hymnbook_post_save_skips_reindex_on_create` (sem hinos ainda)
- `test_signal_swallows_typesense_exception` (mock raises, view não explode)

**🟢 Green — implementar:**
- Criar `apps/hymns/signals.py` com receivers
- Modificar `apps/hymns/apps.py` para registrar em `ready()`
- Remover `try/except index_hymn()` manual de `apps/users/views.py:upload_preview_view`

**🔵 Refactor:** garantir que signals não disparem em tests via fixtures do `conftest.py` se necessário (provavelmente usar `@pytest.mark.django_db` e mocks).

---

### Fase 2: Forms

**🔴 Red — `tests/unit/test_hymn_forms.py` (novos):**
- `test_hymnbook_form_valid_minimal_data`
- `test_hymnbook_form_valid_full_data`
- `test_hymnbook_form_rejects_missing_name`
- `test_hymnbook_form_accepts_cover_image`
- `test_hymn_form_valid_minimal_data`
- `test_hymn_form_rejects_duplicate_number_in_same_hymnbook`
- `test_hymn_form_accepts_same_number_in_different_hymnbooks`
- `test_hymn_form_rejects_missing_required_fields`

**🟢 Green — implementar em `apps/hymns/forms.py`:**
- `HymnBookForm(ModelForm)` — fields: `name`, `intro_name`, `owner_name`, `description`, `cover_image`
- `HymnForm(ModelForm)` — fields: `number`, `title`, `text`, `received_at`, `offered_to`, `style`, `extra_instructions`, `repetitions`
  - Override `__init__` para receber `hymn_book` (necessário para `clean_number`)
  - `clean_number` valida unicidade dentro do hinário

Padrão visual: seguir `HymnBookVersionForm` (linhas 54-99 de `forms.py`).

---

### Fase 3: HymnBook CRUD Views

**🔴 Red — `tests/unit/test_hymnbook_crud_views.py` (novos):**

Permission & access:
- `test_create_requires_login` (redireciona anônimo)
- `test_edit_requires_login`
- `test_edit_forbidden_for_non_owner`
- `test_edit_allowed_for_owner`
- `test_edit_allowed_for_superuser_even_without_owner`
- `test_delete_requires_login`
- `test_delete_forbidden_for_non_owner`

Create flow:
- `test_create_get_renders_form`
- `test_create_post_saves_hymnbook_with_current_user_as_owner`
- `test_create_post_redirects_to_detail`
- `test_create_post_invalid_shows_errors`

Edit flow:
- `test_edit_get_renders_prefilled_form`
- `test_edit_post_updates_fields`
- `test_edit_post_redirects_to_detail`

Delete flow:
- `test_delete_get_shows_confirmation`
- `test_delete_post_removes_hymnbook`
- `test_delete_post_cascades_to_hymns`
- `test_delete_post_redirects_to_list`

**🟢 Green — implementar:**

`apps/hymns/views.py` (FBVs):
```python
def _can_edit_hymnbook(user, hymnbook):
    return user.is_authenticated and (user.is_superuser or user == hymnbook.owner_user)

@login_required
def hymnbook_create_view(request): ...

@login_required
def hymnbook_edit_view(request, slug): ...

@login_required
def hymnbook_delete_view(request, slug): ...
```

`apps/hymns/urls.py` (ordem importa — `novo` antes de `<slug>`):
```python
path("hinarios/novo/", views.hymnbook_create_view, name="hymnbook_create"),
path("hinarios/<slug:slug>/editar/", views.hymnbook_edit_view, name="hymnbook_edit"),
path("hinarios/<slug:slug>/deletar/", views.hymnbook_delete_view, name="hymnbook_delete"),
```

Templates (self-contained, padrão `profile_edit.html`):
- `templates/hymns/hymnbook_form.html` (usado para create e edit)
- `templates/hymns/hymnbook_confirm_delete.html`

---

### Fase 4: Hymn CRUD Views

**🔴 Red — `tests/unit/test_hymn_crud_views.py` (novos):**

Análogo ao da Fase 3, adaptado para Hymn:
- Permission checks (via `hymn.hymn_book.owner_user`)
- Create: `hymn_book` vem da URL slug, não do form
- Create: validação de número duplicado
- Edit: prefill funciona
- Delete: remove do banco (e signal remove do TypeSense — testado em Fase 1)

**🟢 Green — implementar:**

`apps/hymns/views.py`:
```python
@login_required
def hymn_create_view(request, slug): ...  # slug do hymnbook pai

@login_required
def hymn_edit_view(request, pk): ...

@login_required
def hymn_delete_view(request, pk): ...
```

`apps/hymns/urls.py`:
```python
path("hinarios/<slug:slug>/hinos/novo/", views.hymn_create_view, name="hymn_create"),
path("hinos/<uuid:pk>/editar/", views.hymn_edit_view, name="hymn_edit"),
path("hinos/<uuid:pk>/deletar/", views.hymn_delete_view, name="hymn_delete"),
```

Templates:
- `templates/hymns/hymn_form.html` (create e edit)
- `templates/hymns/hymn_confirm_delete.html`

---

### Fase 5: UI Integration

**🔴 Red — estender `tests/unit/test_hymn_views.py`:**
- `test_hymnbook_detail_shows_edit_button_for_owner`
- `test_hymnbook_detail_hides_edit_button_for_anonymous`
- `test_hymnbook_detail_shows_edit_button_for_superuser`
- `test_hymn_detail_shows_edit_button_for_owner`
- `test_hymnbook_list_shows_create_button_for_logged_in_users`

**🟢 Green — modificar:**

Views em `apps/hymns/views.py` — adicionar `can_edit` no context:
- `HymnBookDetailView.get_context_data`
- `HymnDetailView.get_context_data`

Templates a modificar:
- `templates/hymns/hymnbook_list.html` — botão "Novo Hinário" se logado
- `templates/hymns/hymnbook_detail.html` — botões "Editar", "Deletar", "Adicionar Hino" se `can_edit`
- `templates/hymns/hymn_detail.html` — botões "Editar", "Deletar" se `can_edit`

---

## Arquivos a Modificar/Criar

### Novos
- `apps/hymns/signals.py`
- `tests/unit/test_typesense_signals.py`
- `tests/unit/test_hymn_forms.py`
- `tests/unit/test_hymnbook_crud_views.py`
- `tests/unit/test_hymn_crud_views.py`
- `templates/hymns/hymnbook_form.html`
- `templates/hymns/hymnbook_confirm_delete.html`
- `templates/hymns/hymn_form.html`
- `templates/hymns/hymn_confirm_delete.html`

### Modificados
- `apps/hymns/apps.py` (register signals)
- `apps/hymns/forms.py` (add HymnBookForm, HymnForm)
- `apps/hymns/views.py` (add 6 FBVs + can_edit context)
- `apps/hymns/urls.py` (add 6 URLs)
- `apps/users/views.py` (remove manual index_hymn — signals cuidam)
- `templates/hymns/hymnbook_list.html` (botão criar)
- `templates/hymns/hymnbook_detail.html` (botões gerenciar)
- `templates/hymns/hymn_detail.html` (botões gerenciar)
- `tests/unit/test_hymn_views.py` (testes de can_edit no context)

---

## Padrões Reusados

- `apps/users/views.py:57-82` — FBV edit com ownership check
- `apps/hymns/forms.py:54-99` — padrão `HymnBookVersionForm`
- `apps/search/typesense_client.py` — `index_hymn()`, `delete_hymn()`
- `templates/users/profile_edit.html` — template form self-contained
- Classes CSS existentes: `.card`, `.btn`, `.btn-secondary`, `.form-control`

---

## Verificação End-to-End

### 1. Testes unitários
```bash
cd /Users/nitai/dev/hyms-platform/hyms-plat
poetry run pytest tests/unit/ -v
poetry run pytest tests/unit/ --cov=apps.hymns --cov-report=term-missing
```
Esperado: todos passando, coverage >= 85%.

### 2. Teste manual no browser
Servidor `:8001`, usuário `nitai@test.com`:
- `/hinarios/` → "Novo Hinário" → criar "Teste" → redirect para detalhe
- Detalhe → "Adicionar Hino" → criar hino #1 → conferir listagem
- "Editar Hino" → mudar título → salvar → conferir mudança
- `/busca/?q=<novo_titulo>` → aparece (signal indexou)
- "Deletar Hino" → confirmar → buscar de novo → sumiu (signal deletou)
- Logout, login outro usuário → tentar editar → redirect + mensagem de erro
- Como superuser, editar "O Justiceiro" → os 124 hinos re-aparecem com novo `hymn_book_name` na busca

### 3. Sync TypeSense direto
```bash
curl "http://localhost:8108/collections/hymns/documents/search?q=TermoNovo&query_by=title,text" -H "X-TYPESENSE-API-KEY: xyz"
```

### 4. Smoke test do gap corrigido
Deletar hino via Django Admin → confirmar que sumiu do TypeSense.

---

## Critérios de Conclusão

- [ ] Todos os testes novos passando
- [ ] Coverage de `apps/hymns/views.py` e `apps/hymns/forms.py` >= 85%
- [ ] Fluxos manuais verificados no browser
- [ ] Signals resolvem os gaps de TypeSense (verificado em teste manual)
- [ ] Não quebra testes existentes (291 unit tests continuam passando)
