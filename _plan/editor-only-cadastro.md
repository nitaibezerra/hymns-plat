# Restringir cadastro/edição de hinários e hinos a Editores e Admins

## Contexto

Hoje qualquer usuário autenticado pode criar um hinário (`hymnbook_create_view` só usa `@login_required`) e, virando dono, pode editar/deletar/publicar o próprio. O usuário quer endurecer essa porta: **só Editores (membros do grupo `editor`) e Admins (`is_superuser`) podem cadastrar/editar/deletar/publicar hinários e hinos**. Usuários comuns ficam restritos a consulta — e nem devem ver os botões de ação.

Decisões tomadas em conversa:
- **Bloquear donos não-editores também.** Hinários existentes passam a ser geridos só por editores/admins.
- **Reutilizar a permissão `hymns.can_review_any_hymnbook`** (já concedida ao grupo `editor` pela migration `0008_editor_group_and_perms.py`). Sem migration nova. Superusers automaticamente satisfazem `user.has_perm(...)` e `{% if perms.X %}` no template.
- **TDD**: testes escritos primeiro (vermelho), depois código (verde).

## Estratégia TDD

Cada passo segue o ciclo *red → green*. As implementações acontecem **só depois** que a fase vermelha mostrar os testes correspondentes falhando pelo motivo certo.

### Fase 1 — Modelo de permissões (`apps/hymns/permissions.py`)

**Red** — adicionar testes em `tests/unit/test_permissions.py`:

```python
class TestCanCreateHymnbook:
    def test_anonymous_cannot_create(...)
    def test_common_user_cannot_create(...)
    def test_editor_can_create(...)
    def test_superuser_can_create(...)

# Em TestCanEditHymnbook (substituir o test_owner_can_edit existente):
def test_owner_who_is_not_editor_cannot_edit(self, user_factory, hymn_book_factory):
    owner = user_factory(email="owner@example.com")
    hb = hymn_book_factory(name="Owned", owner_user=owner)
    assert can_edit_hymnbook(owner, hb) is False  # nova política

# Em TestCanPublishHymnbook (substituir test_owner_can_publish):
def test_owner_who_is_not_editor_cannot_publish(...):
    assert can_publish_hymnbook(owner, hb) is False
```

**Green** — em `apps/hymns/permissions.py`:

```python
def _is_editor_or_admin(user) -> bool:
    if not _is_authenticated(user):
        return False
    if user.is_superuser:
        return True
    return user.has_perm("hymns.can_review_any_hymnbook")

def can_create_hymnbook(user) -> bool:
    return _is_editor_or_admin(user)

def can_edit_hymnbook(user, hymnbook) -> bool:
    return _is_editor_or_admin(user)

def can_publish_hymnbook(user, hymnbook) -> bool:
    if not _is_authenticated(user):
        return False
    if user.is_superuser:
        return True
    return user.has_perm("hymns.can_publish_hymnbook")
```

> Mantém a assinatura `(user, hymnbook)` em `can_edit_hymnbook` e `can_publish_hymnbook` para preservar todos os 12+ call sites em `views.py` e `editor_views.py`. O parâmetro `hymnbook` simplesmente fica ignorado.

### Fase 2 — Gate na view de criação

**Red** — em `tests/unit/test_hymnbook_crud_views.py::TestHymnBookCreateView`:

```python
def test_get_blocked_for_common_user_redirects_with_error(self, authenticated_client):
    url = reverse("hymns:hymnbook_create")
    resp = authenticated_client.get(url)
    assert resp.status_code == 302
    assert resp.url == reverse("hymns:hymnbook_list")

def test_post_blocked_for_common_user(self, authenticated_client):
    resp = authenticated_client.post(reverse("hymns:hymnbook_create"), {...})
    assert resp.status_code == 302
    assert HymnBook.objects.filter(name="Tentativa").count() == 0

def test_get_renders_form_for_editor(self, authenticated_client):
    Group.objects.get(name="editor").user_set.add(authenticated_client.user)
    resp = authenticated_client.get(reverse("hymns:hymnbook_create"))
    assert resp.status_code == 200
```

Os testes existentes `test_get_renders_form` e `test_post_creates_hymnbook_with_owner` precisam ser ajustados para promover o usuário a editor antes da requisição (o usuário comum agora é bloqueado).

**Green** — em `apps/hymns/views.py:hymnbook_create_view`:

```python
@login_required
def hymnbook_create_view(request):
    if not can_create_hymnbook(request.user):
        messages.error(request, "Você não tem permissão para cadastrar hinários.")
        return redirect("hymns:hymnbook_list")
    # ... corpo existente
```

E adicionar import: `from .permissions import can_create_hymnbook, can_edit_hymnbook, can_publish_hymnbook`.

### Fase 3 — Templates (botões escondidos)

**Red** — em `tests/unit/test_hymnbook_crud_views.py` (ou novo arquivo):

```python
class TestHymnBookListButtonVisibility:
    def test_button_hidden_for_anonymous(self, client, hymn_book):
        resp = client.get(reverse("hymns:hymnbook_list"))
        assert b"+ Novo hin" not in resp.content

    def test_button_hidden_for_common_user(self, authenticated_client, hymn_book):
        resp = authenticated_client.get(reverse("hymns:hymnbook_list"))
        assert b"+ Novo hin" not in resp.content

    def test_button_visible_for_editor(self, authenticated_client, hymn_book):
        Group.objects.get(name="editor").user_set.add(authenticated_client.user)
        resp = authenticated_client.get(reverse("hymns:hymnbook_list"))
        assert b"+ Novo hin" in resp.content

    def test_button_visible_for_superuser(self, admin_client, hymn_book):
        resp = admin_client.get(reverse("hymns:hymnbook_list"))
        assert b"+ Novo hin" in resp.content
```

**Green** — em `templates/hymns/hymnbook_list.html:13`:

```diff
- {% if user.is_authenticated %}
+ {% if perms.hymns.can_review_any_hymnbook %}
```

`templates/hymns/hymnbook_detail.html` e `hymn_detail.html` já usam `{% if can_edit %}`, populado em `views.py:51` e `views.py:84` via `can_edit_hymnbook` — ficam corretos automaticamente após a Fase 1.

### Fase 4 — Coerência no editor workspace

**Red** — em `tests/unit/test_editor_workspace.py`, ajustar quaisquer casos que assumem "dono não-editor entra no workspace".

**Green** — em `apps/hymns/editor_views.py:_has_editor_access`:

```python
def _has_editor_access(user) -> bool:
    if not getattr(user, "is_authenticated", False):
        return False
    if user.is_superuser:
        return True
    return user.has_perm("hymns.can_review_any_hymnbook")
```

`_editor_visible_books` e `_pending_audios_for` ficam como estão — seu ramo "filtra por dono" vira inalcançável após o gate, mas mantê-lo reduz churn.

### Fase 5 — Limpeza dos testes pré-existentes

Vários testes em `test_hymnbook_crud_views.py` e `test_hymn_crud_views.py` exercitam o caminho **owner edita o próprio**, que agora é proibido. A correção em cada um é a mesma: promover o usuário a `editor` antes da requisição (em vez de definir `owner_user=authenticated_client.user`). Lista a ajustar:

- `TestHymnBookEditView::test_allowed_for_owner` → renomear para `test_allowed_for_editor`
- `TestHymnBookEditView::test_post_updates_fields` → promover a editor
- `TestHymnBookDeleteView::test_get_shows_confirmation` → promover a editor
- `TestHymnBookDeleteView::test_post_removes_hymnbook` → promover a editor
- `TestHymnBookDeleteView::test_post_cascades_to_hymns` → promover a editor
- `TestHymnCreateView::test_get_renders_form_for_owner` → promover a editor
- `TestHymnCreateView::test_post_creates_hymn` → promover a editor
- `TestHymnCreateView::test_post_rejects_duplicate_number` → promover a editor
- `TestHymnEditView::test_allowed_for_owner` → manter o `test_allowed_for_editor_group` (já existe) e remover/ajustar o `test_allowed_for_owner`
- `TestHymnEditView::test_post_updates_hymn` → promover a editor
- `TestHymnDeleteView::test_get_shows_confirmation` → promover a editor
- `TestHymnDeleteView::test_post_deletes_hymn_and_redirects` → promover a editor

Helper conveniente para reduzir boilerplate (em cada arquivo de teste, ou em `conftest.py`):

```python
@pytest.fixture
def editor_client(authenticated_client):
    from django.contrib.auth.models import Group
    Group.objects.get(name="editor").user_set.add(authenticated_client.user)
    return authenticated_client
```

## Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `apps/hymns/permissions.py` | Adiciona `can_create_hymnbook`; remove fallback de `owner_user`. |
| `apps/hymns/views.py` | Gate em `hymnbook_create_view`; novo import. |
| `apps/hymns/editor_views.py` | Simplifica `_has_editor_access`. |
| `templates/hymns/hymnbook_list.html` | Troca o `if` do botão "+ Novo hinário". |
| `tests/conftest.py` | Adiciona fixture `editor_client`. |
| `tests/unit/test_permissions.py` | Adiciona `TestCanCreateHymnbook` + ajusta casos de dono. |
| `tests/unit/test_hymnbook_crud_views.py` | Novos testes de gate e visibilidade do botão; ajusta casos de dono. |
| `tests/unit/test_hymn_crud_views.py` | Ajusta casos de dono. |
| `tests/unit/test_editor_workspace.py` | Ajusta casos de dono não-editor. |

Sem migrations. Sem mudanças em URLs ou models.

## Verificação ponta-a-ponta

```bash
cd /Users/nitai/dev/hyms-platform/feat-editor-only-crud

# Lint
uv run black --check . && uv run isort --check-only . && uv run ruff check .

# Suíte unit
DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest tests/unit/ -q

# Sanity manual no runserver (pula nesta fase se a suíte cobre tudo)
uv run python manage.py runserver
# Cenários:
#   a) Logado como usuário comum: lista não mostra "+ Novo hinário"; GET /hinarios/novo/ redireciona com erro
#   b) Logado como editor (grupo editor via Django admin): botões aparecem; CRUD funciona
#   c) Superuser: idem editor
#   d) Anônimo: já bloqueado por @login_required; sem regressão
```

## Riscos

- **Donos atuais não-editores perdem acesso de edição** — por decisão do usuário. Em produção, conferir `owner_user` dos hinários existentes (ex.: "O Justiceiro") antes do deploy: se não for editor/superuser, promover via Django admin ou aceitar o lockdown.
- **Sem migration**: reverter é trivial (revert do PR).
