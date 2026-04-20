# Testes E2E

Testes end-to-end com Playwright.

## Visão Geral

Testes E2E simulam usuários reais navegando pelo site.

```python
def test_user_can_search(page, base_url):
    page.goto(base_url)
    page.fill('input[name="q"]', "lua")
    page.click('button[type="submit"]')

    expect(page.locator(".card")).to_be_visible()
```

## Setup

### Instalação

```bash
# Dependência (já no pyproject.toml)
poetry add playwright --group dev

# Instalar browsers
poetry run playwright install chromium
```

### Configuração

```python
# tests/e2e/conftest.py
import pytest
from playwright.sync_api import sync_playwright, Page, Browser


@pytest.fixture(scope="session")
def browser():
    """Browser instance compartilhada."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        yield browser
        browser.close()


@pytest.fixture
def page(browser: Browser):
    """Nova página para cada teste."""
    context = browser.new_context(
        viewport={"width": 1280, "height": 720}
    )
    page = context.new_page()
    yield page
    page.close()
    context.close()


@pytest.fixture
def base_url():
    """URL do servidor de testes."""
    return "http://localhost:9000"


@pytest.fixture
def authenticated_page(page: Page, base_url: str):
    """Página com usuário logado."""
    page.goto(f"{base_url}/accounts/login/")
    page.fill('input[name="login"]', "teste2e@example.com")
    page.fill('input[name="password"]', "testpass123")
    page.click('button[type="submit"]')
    page.wait_for_url(f"{base_url}/**")
    return page
```

## Estrutura

```
tests/e2e/
├── conftest.py           # Fixtures E2E
├── test_navigation.py    # Navegação pública
├── test_auth.py          # Autenticação
├── test_upload.py        # Upload de hinários
└── test_social.py        # Features sociais
```

## Exemplos

### Navegação

```python
# tests/e2e/test_navigation.py
import pytest
from playwright.sync_api import Page, expect


@pytest.mark.e2e
class TestPublicNavigation:
    def test_home_page_loads(self, page: Page, base_url: str):
        page.goto(base_url)

        expect(page.locator("h1")).to_be_visible()
        title = page.title()
        assert "Portal" in title or "Hinário" in title

    def test_hymnbook_list(self, page: Page, base_url: str):
        page.goto(f"{base_url}/hinarios/")

        expect(page.get_by_role("heading", name="Hinários")).to_be_visible()
        expect(page.locator(".card").first).to_be_visible()

    def test_search_works(self, page: Page, base_url: str):
        page.goto(f"{base_url}/busca/")
        page.fill('input[name="q"]', "lua")
        page.click('button[type="submit"]')

        page.wait_for_load_state("networkidle")
        # Verifica resultados ou mensagem de não encontrado
```

### Autenticação

```python
# tests/e2e/test_auth.py
@pytest.mark.e2e
class TestAuthentication:
    def test_login_page_loads(self, page: Page, base_url: str):
        page.goto(f"{base_url}/accounts/login/")

        expect(page.locator('input[name="login"]')).to_be_visible()
        expect(page.locator('input[name="password"]')).to_be_visible()

    def test_invalid_login_shows_error(self, page: Page, base_url: str):
        page.goto(f"{base_url}/accounts/login/")
        page.fill('input[name="login"]', "wrong@example.com")
        page.fill('input[name="password"]', "wrongpass")
        page.click('button[type="submit"]')

        page.wait_for_load_state("networkidle")
        # Deve mostrar erro ou permanecer na página
        assert "/accounts/login/" in page.url

    def test_protected_page_redirects(self, page: Page, base_url: str):
        page.goto(f"{base_url}/contribuir/")

        page.wait_for_load_state("networkidle")
        assert "/accounts/login/" in page.url
```

### Upload

```python
# tests/e2e/test_upload.py
@pytest.mark.e2e
class TestUpload:
    def test_upload_requires_auth(self, page: Page, base_url: str):
        page.goto(f"{base_url}/contribuir/")

        assert "/accounts/login/" in page.url

    def test_upload_page_loads(self, authenticated_page: Page, base_url: str):
        authenticated_page.goto(f"{base_url}/contribuir/")

        expect(authenticated_page.locator('input[name="yaml_file"]')).to_be_visible()

    def test_invalid_yaml_shows_error(self, authenticated_page: Page, base_url: str, tmp_path):
        # Criar YAML inválido
        yaml_file = tmp_path / "invalid.yaml"
        yaml_file.write_text("invalid: true\nno_name: here")

        authenticated_page.goto(f"{base_url}/contribuir/")
        authenticated_page.set_input_files('input[name="yaml_file"]', str(yaml_file))
        authenticated_page.click('button[type="submit"]')

        page.wait_for_load_state("networkidle")
        expect(authenticated_page.locator(".errorlist, .error")).to_be_visible()
```

## Rodando

### Pré-requisitos

```bash
# 1. Servidor rodando
poetry run python manage.py runserver 9000

# 2. Usuário de teste criado
poetry run python manage.py shell -c "
from apps.users.models import User
if not User.objects.filter(email='teste2e@example.com').exists():
    User.objects.create_user('teste2e', 'teste2e@example.com', 'testpass123')
"

# 3. Dados de exemplo
poetry run python manage.py import_yaml tests/fixtures/test_hymnbook.yaml
```

### Comandos

```bash
# Rodar E2E
poetry run pytest tests/e2e/ -v

# Com browser visível
poetry run pytest tests/e2e/ -v --headed

# Teste específico
poetry run pytest tests/e2e/test_navigation.py::TestPublicNavigation::test_home_page_loads -v

# Slow motion (debug)
poetry run pytest tests/e2e/ --slowmo=500
```

## Boas Práticas

### Esperar por Estado

```python
# Bom: espera explícito
page.wait_for_load_state("networkidle")
page.wait_for_selector(".card")

# Evitar: sleep fixo
import time
time.sleep(2)  # Não faça isso
```

### Seletores Robustos

```python
# Bom: seletores específicos
page.locator('[data-testid="search-button"]')
page.get_by_role("button", name="Buscar")
page.locator('button[type="submit"]')

# Evitar: seletores frágeis
page.locator("div > div > button")
page.locator(".btn-primary")  # Pode mudar
```

### Screenshots em Falha

```python
@pytest.fixture
def page(browser):
    context = browser.new_context()
    page = context.new_page()
    yield page

    # Screenshot se falhou
    if hasattr(page, '_test_failed'):
        page.screenshot(path=f"tests/e2e/screenshots/{test_name}.png")

    page.close()
```

## CI

```yaml
# .github/workflows/ci.yml
e2e-tests:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:16-alpine
    typesense:
      image: typesense/typesense:27.1
    redis:
      image: redis:7-alpine

  steps:
    - name: Install Playwright
      run: poetry run playwright install chromium --with-deps

    - name: Start server
      run: |
        poetry run python manage.py migrate
        poetry run python manage.py runserver 9000 &
        sleep 5

    - name: Run E2E tests
      run: poetry run pytest tests/e2e/ -v
```
