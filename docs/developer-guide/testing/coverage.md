# Coverage

Medindo e melhorando cobertura de testes.

## Visão Geral

Coverage mede quais linhas de código são executadas pelos testes.

**Meta do projeto: 80%+**

## Ferramentas

### pytest-cov

```bash
# Rodar com coverage
poetry run pytest --cov=apps

# Com relatório HTML
poetry run pytest --cov=apps --cov-report=html

# Abrir relatório
open htmlcov/index.html
```

### Configuração

```toml
# pyproject.toml
[tool.coverage.run]
source = ["apps"]
omit = [
    "*/migrations/*",
    "*/tests/*",
    "*/__init__.py",
]
branch = true

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "def __repr__",
    "raise NotImplementedError",
    "if TYPE_CHECKING:",
]
fail_under = 80
show_missing = true
```

## Relatórios

### Terminal

```
---------- coverage: platform darwin, python 3.11.0 -----------
Name                          Stmts   Miss  Cover
-------------------------------------------------
apps/core/__init__.py             0      0   100%
apps/core/models.py              15      2    87%
apps/hymns/models.py             82      5    94%
apps/hymns/views.py              45      8    82%
apps/search/client.py            32      4    88%
apps/users/models.py             28      3    89%
apps/users/views.py              67     12    82%
-------------------------------------------------
TOTAL                           269     34    87%
```

### HTML

O relatório HTML mostra:

- Arquivos ordenados por coverage
- Linhas cobertas (verde)
- Linhas não cobertas (vermelho)
- Branch coverage

### XML (CI)

```bash
poetry run pytest --cov=apps --cov-report=xml
```

Para upload ao Codecov:

```yaml
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    file: ./coverage.xml
```

## Analisando Gaps

### Encontrar código não coberto

```bash
# Relatório com linhas faltando
poetry run pytest --cov=apps --cov-report=term-missing
```

Output:
```
apps/hymns/views.py    45    8   82%   34-38, 67-70
```

Linhas 34-38 e 67-70 não estão cobertas.

### Analisar arquivo específico

```bash
# Coverage de um arquivo
poetry run pytest tests/unit/test_views.py --cov=apps.hymns.views
```

## Melhorando Coverage

### Identificar Gaps

1. Rodar `pytest --cov-report=html`
2. Abrir `htmlcov/index.html`
3. Clicar em arquivos com baixa cobertura
4. Ver linhas vermelhas

### Adicionar Testes

```python
# Código não coberto
def some_view(request):
    if request.method == 'POST':  # Linha coberta
        return handle_post(request)
    elif request.method == 'PUT':  # Linha NÃO coberta
        return handle_put(request)  # Linha NÃO coberta
    return handle_get(request)  # Linha coberta

# Adicionar teste
def test_put_request(client):
    response = client.put('/endpoint/')
    assert response.status_code == 200
```

### Código que Não Precisa Testar

```python
# Marcar como não-testável
def debug_function():  # pragma: no cover
    """Função apenas para debug."""
    print("Debug info")
```

## Branch Coverage

Mede se ambos os caminhos de um `if` são testados.

```python
def check_value(x):
    if x > 0:  # Branch 1: True
        return "positive"
    return "non-positive"  # Branch 2: False

# Teste incompleto (só cobre Branch 1)
def test_positive():
    assert check_value(5) == "positive"

# Teste completo (cobre ambos)
def test_positive_and_negative():
    assert check_value(5) == "positive"
    assert check_value(-5) == "non-positive"
```

## CI/CD

### Fail se Coverage Baixa

```toml
# pyproject.toml
[tool.coverage.report]
fail_under = 80
```

```bash
# Falha se < 80%
poetry run pytest --cov=apps --cov-fail-under=80
```

### Codecov Badge

```markdown
[![codecov](https://codecov.io/gh/user/repo/branch/main/graph/badge.svg)](https://codecov.io/gh/user/repo)
```

## Métricas Atuais

| Módulo | Coverage |
|--------|----------|
| apps.hymns | 90% |
| apps.search | 85% |
| apps.users | 82% |
| apps.cms | 78% |
| apps.core | 95% |
| **Total** | **83%** |

## Boas Práticas

### Não Persiga 100%

- 80-90% é geralmente suficiente
- Código trivial não precisa de teste
- Foque em código crítico

### Qualidade > Quantidade

```python
# Ruim: teste que só aumenta coverage
def test_model_str():
    obj = Model()
    str(obj)  # Não verifica nada!

# Bom: teste que verifica comportamento
def test_model_str_format():
    obj = Model(name="Test")
    assert str(obj) == "Test"
    assert "Test" in repr(obj)
```

### Teste Edge Cases

```python
def test_edge_cases():
    # Valores limites
    assert function(0) == expected
    assert function(-1) == expected
    assert function(MAX_VALUE) == expected

    # Casos especiais
    assert function(None) raises ValueError
    assert function("") == default
```
