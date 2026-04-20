# Testes - Visão Geral

Estratégia de testes do projeto.

## Filosofia

- **Testes são documentação** - Mostram como o código funciona
- **Testes rápidos** - Feedback imediato
- **Alta cobertura** - Meta mínima 80%
- **Testes E2E para fluxos críticos** - Validam integração completa

## Tipos de Testes

### Pirâmide de Testes

```
        ┌───────────┐
        │   E2E     │  <- Poucos, lentos, críticos
        │  (15)     │
       ─┼───────────┼─
       │ Integration │  <- Médio, testam integrações
       │    (50)     │
      ─┼─────────────┼─
      │    Unit       │  <- Muitos, rápidos, focados
      │   (240+)      │
     ─┴───────────────┴─
```

### Unitários

Testam funções/classes isoladas:

```python
def test_hymn_book_str_returns_name():
    hymnbook = HymnBook(name="Test")
    assert str(hymnbook) == "Test"
```

### Integração

Testam componentes juntos:

```python
def test_search_returns_indexed_hymns(db, typesense):
    hymn = HymnFactory()
    index_hymn(hymn)

    results = search_hymns(hymn.title)
    assert results['found'] == 1
```

### E2E

Testam fluxos completos via browser:

```python
def test_user_can_search_and_view_hymn(page, base_url):
    page.goto(base_url)
    page.fill('input[name="q"]', "lua")
    page.click('button[type="submit"]')
    page.click(".card a")

    expect(page.locator(".hymn-text")).to_be_visible()
```

## Estrutura

```
tests/
├── conftest.py           # Fixtures globais
├── factories.py          # Factory Boy factories
├── fixtures/             # Arquivos de teste
│   └── test_hymnbook.yaml
├── unit/                 # Testes unitários
│   ├── test_models.py
│   ├── test_views.py
│   ├── test_forms.py
│   └── ...
└── e2e/                  # Testes E2E
    ├── conftest.py       # Fixtures E2E
    ├── test_navigation.py
    ├── test_auth.py
    └── ...
```

## Ferramentas

| Ferramenta | Uso |
|------------|-----|
| pytest | Framework principal |
| pytest-django | Integração Django |
| pytest-cov | Coverage |
| factory-boy | Test factories |
| Playwright | Testes E2E |

## Comandos

```bash
# Todos os testes
poetry run pytest

# Apenas unitários
poetry run pytest tests/unit/

# Apenas E2E
poetry run pytest tests/e2e/ -v

# Com coverage
poetry run pytest --cov=apps --cov-report=html

# Teste específico
poetry run pytest tests/unit/test_models.py::TestHymnBook -v

# Watch mode (com pytest-watch)
poetry run ptw
```

## Configuração

```ini
# pytest.ini
[pytest]
DJANGO_SETTINGS_MODULE = config.settings.test
python_files = test_*.py *_test.py
addopts = -v --tb=short --strict-markers
testpaths = tests
markers =
    e2e: mark test as end-to-end
```

## CI

Testes rodam automaticamente:

1. **Push/PR** → CI dispara
2. **Lint** → Black, isort, Ruff
3. **Unit Tests** → pytest tests/unit/
4. **E2E Tests** → pytest tests/e2e/

Merge bloqueado se falhar.

## Métricas Atuais

| Métrica | Valor |
|---------|-------|
| Testes unitários | 291 |
| Testes E2E | 15 |
| Cobertura | 83%+ |
| Tempo CI | ~5 min |

## Links

- [Testes Unitários](unit-tests.md)
- [Testes de Integração](integration-tests.md)
- [Testes E2E](e2e-tests.md)
- [Coverage](coverage.md)
