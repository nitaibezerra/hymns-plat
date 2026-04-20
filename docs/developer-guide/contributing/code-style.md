# Code Style

Padrões de código do projeto.

## Ferramentas

O projeto usa três ferramentas para garantir consistência:

| Ferramenta | Função |
|------------|--------|
| Black | Formatação |
| isort | Ordenação de imports |
| Ruff | Linting |

## Black

Formatador automático de código Python.

### Configuração

```toml
# pyproject.toml
[tool.black]
line-length = 120
target-version = ['py311']
include = '\.pyi?$'
exclude = '''
/(
    \.git
  | migrations
)/
'''
```

### Uso

```bash
# Formatar tudo
poetry run black .

# Checar sem modificar
poetry run black --check .
```

## isort

Ordenação automática de imports.

### Configuração

```toml
# pyproject.toml
[tool.isort]
profile = "black"
line_length = 120
skip = ["migrations", ".venv"]
```

### Uso

```bash
# Ordenar imports
poetry run isort .

# Checar sem modificar
poetry run isort --check-only .
```

## Ruff

Linter rápido para Python.

### Configuração

```toml
# pyproject.toml
[tool.ruff]
line-length = 120
target-version = "py311"
exclude = ["migrations", ".venv"]

[tool.ruff.lint]
select = ["E", "F", "W", "I", "N", "B", "C4"]
ignore = ["E501"]
```

### Regras Ativadas

| Código | Descrição |
|--------|-----------|
| E | pycodestyle errors |
| F | Pyflakes |
| W | pycodestyle warnings |
| I | isort |
| N | pep8-naming |
| B | flake8-bugbear |
| C4 | flake8-comprehensions |

### Uso

```bash
# Checar
poetry run ruff check .

# Corrigir automaticamente
poetry run ruff check --fix .
```

## Pre-commit

Hooks automáticos antes de cada commit.

### Configuração

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/psf/black
    rev: 24.10.0
    hooks:
      - id: black

  - repo: https://github.com/pycqa/isort
    rev: 5.13.0
    hooks:
      - id: isort

  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.0
    hooks:
      - id: ruff
```

### Instalação

```bash
poetry run pre-commit install
```

## Convenções de Código

### Naming

```python
# Classes: PascalCase
class HymnBook:
    pass

# Funções e variáveis: snake_case
def get_hymn_count():
    hymn_count = 10

# Constantes: UPPER_SNAKE_CASE
MAX_UPLOAD_SIZE = 10 * 1024 * 1024
```

### Imports

```python
# Ordem: stdlib → third-party → local
import os
from typing import Optional

from django.db import models

from apps.core.models import BaseModel
```

### Docstrings

```python
def calculate_similarity(str1: str, str2: str) -> float:
    """Calcula similaridade entre duas strings.

    Args:
        str1: Primeira string
        str2: Segunda string

    Returns:
        Valor entre 0.0 e 1.0

    Raises:
        ValueError: Se alguma string for None
    """
    pass
```

### Type Hints

```python
from typing import Optional, List

def get_hymns(
    hymn_book_id: str,
    limit: Optional[int] = None
) -> List[Hymn]:
    pass
```

## Django Específico

### Models

```python
class Hymn(models.Model):
    """Docstring descrevendo o model."""

    # Campos organizados por tipo
    id = models.UUIDField(primary_key=True)

    hymn_book = models.ForeignKey(HymnBook)

    title = models.CharField(max_length=255)
    text = models.TextField()

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['number']
        verbose_name = "Hino"

    def __str__(self):
        return self.title
```

### Views

```python
def hymn_detail(request, pk):
    """View para detalhes de um hino."""
    hymn = get_object_or_404(Hymn, pk=pk)
    return render(request, 'hymns/detail.html', {'hymn': hymn})
```

## Rodando Todas as Verificações

```bash
# Formatar
poetry run black .
poetry run isort .

# Lint
poetry run ruff check .

# Testes
poetry run pytest
```

O CI verifica tudo isso automaticamente.
