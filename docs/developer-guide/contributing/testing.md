# Escrevendo Testes

Guia para escrever testes no projeto.

## Visão Geral

O projeto usa:

- **pytest** - Framework de testes
- **pytest-django** - Integração com Django
- **pytest-cov** - Coverage
- **factory-boy** - Test factories
- **Playwright** - Testes E2E

## Estrutura

```
tests/
├── unit/                    # Testes unitários
│   ├── test_models.py
│   ├── test_views.py
│   └── ...
├── e2e/                     # Testes end-to-end
│   ├── conftest.py
│   ├── test_navigation.py
│   └── ...
├── conftest.py              # Fixtures globais
└── fixtures/                # Arquivos de teste
    └── test_hymnbook.yaml
```

## Testes Unitários

### Convenções

```python
# tests/unit/test_models.py
import pytest
from apps.hymns.models import Hymn, HymnBook


class TestHymnBook:
    """Testes para o model HymnBook."""

    def test_str_returns_name(self, hymnbook):
        """__str__ deve retornar o nome."""
        assert str(hymnbook) == hymnbook.name

    def test_hymn_count_returns_correct_value(self, hymnbook_with_hymns):
        """hymn_count deve retornar quantidade correta."""
        assert hymnbook_with_hymns.hymn_count == 5
```

### Fixtures

```python
# tests/conftest.py
import pytest
from apps.hymns.models import HymnBook, Hymn


@pytest.fixture
def hymnbook(db):
    """Cria um HymnBook básico."""
    return HymnBook.objects.create(
        name="Test Hymnbook",
        owner_name="Test Owner"
    )


@pytest.fixture
def hymnbook_with_hymns(hymnbook):
    """Cria HymnBook com 5 hinos."""
    for i in range(1, 6):
        Hymn.objects.create(
            hymn_book=hymnbook,
            number=i,
            title=f"Hymn {i}",
            text=f"Text for hymn {i}"
        )
    return hymnbook
```

### Factories

```python
# tests/factories.py
import factory
from apps.hymns.models import HymnBook, Hymn


class HymnBookFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = HymnBook

    name = factory.Sequence(lambda n: f"Hymnbook {n}")
    owner_name = factory.Faker('name')


class HymnFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Hymn

    hymn_book = factory.SubFactory(HymnBookFactory)
    number = factory.Sequence(lambda n: n + 1)
    title = factory.Faker('sentence', nb_words=3)
    text = factory.Faker('paragraph')
```

## Testes E2E

### Setup

```python
# tests/e2e/conftest.py
import pytest
from playwright.sync_api import sync_playwright


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        yield browser
        browser.close()


@pytest.fixture
def page(browser):
    context = browser.new_context()
    page = context.new_page()
    yield page
    page.close()
    context.close()


@pytest.fixture
def base_url():
    return "http://localhost:9000"
```

### Exemplo

```python
# tests/e2e/test_navigation.py
import pytest
from playwright.sync_api import Page, expect


@pytest.mark.e2e
class TestNavigation:
    def test_home_page_loads(self, page: Page, base_url: str):
        page.goto(base_url)
        expect(page.locator("h1")).to_be_visible()

    def test_search_works(self, page: Page, base_url: str):
        page.goto(f"{base_url}/busca/")
        page.fill('input[name="q"]', "lua")
        page.click('button[type="submit"]')
        expect(page.locator(".card")).to_be_visible()
```

## Rodando Testes

```bash
# Todos os testes unitários
poetry run pytest tests/unit/

# Teste específico
poetry run pytest tests/unit/test_models.py::TestHymnBook::test_str_returns_name

# Com coverage
poetry run pytest --cov=apps --cov-report=html

# Testes E2E (servidor deve estar rodando)
poetry run pytest tests/e2e/ -v
```

## Boas Práticas

### Nomenclatura

```python
# Classe: Test + Nome do que está testando
class TestHymnBook:
    # Método: test_ + comportamento esperado
    def test_str_returns_name(self):
        pass
```

### Arrange-Act-Assert

```python
def test_hymn_creation(self, hymnbook):
    # Arrange
    title = "New Hymn"
    text = "Hymn lyrics"

    # Act
    hymn = Hymn.objects.create(
        hymn_book=hymnbook,
        number=1,
        title=title,
        text=text
    )

    # Assert
    assert hymn.title == title
    assert hymn.text == text
```

### Isolamento

- Cada teste deve ser independente
- Use fixtures para setup
- Limpe após o teste se necessário

### Coverage

Meta mínima: 80%

```bash
# Ver coverage detalhado
poetry run pytest --cov=apps --cov-report=html
open htmlcov/index.html
```

## CI

Testes rodam automaticamente no GitHub Actions:

1. Lint (Black, isort, Ruff)
2. Unit Tests
3. E2E Tests

Todos devem passar para merge.
