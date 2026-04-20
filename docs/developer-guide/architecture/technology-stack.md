# Stack Tecnológico

Visão detalhada das tecnologias utilizadas no projeto.

## Backend

### Python 3.11+

Linguagem principal do projeto.

**Por que 3.11+:**

- Performance melhorada
- Melhor mensagens de erro
- `tomllib` nativo
- Typing improvements

### Django 5.1

Framework web principal.

**Features utilizadas:**

- ORM completo
- Admin interface
- Form validation
- Signals
- Management commands
- Middleware

**Configuração:**

```python
# config/settings/base.py
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    # ...
    'apps.core',
    'apps.hymns',
    'apps.search',
    'apps.users',
    'apps.cms',
]
```

### Wagtail 6.4

CMS para páginas editáveis.

**Uso:**

- HomePage customizada
- Páginas de conteúdo estático
- StreamFields para conteúdo rico

## Banco de Dados

### PostgreSQL 16

Banco de dados principal.

**Features utilizadas:**

- UUID fields
- Full-text search (backup)
- JSONField
- Indexes

**Conexão:**

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': env('DATABASE_NAME'),
        'USER': env('DATABASE_USER'),
        'PASSWORD': env('DATABASE_PASSWORD'),
        'HOST': env('DATABASE_HOST'),
        'PORT': env('DATABASE_PORT', default='5432'),
    }
}
```

## Busca

### TypeSense 27.1

Motor de busca principal.

**Features:**

- Typo-tolerance nativo
- Busca instantânea
- Faceted search
- Relevância configurável

**Schema dos hinos:**

```python
HYMNS_SCHEMA = {
    'name': 'hymns',
    'fields': [
        {'name': 'id', 'type': 'string'},
        {'name': 'title', 'type': 'string'},
        {'name': 'text', 'type': 'string'},
        {'name': 'hymn_book_name', 'type': 'string', 'facet': True},
        {'name': 'owner_name', 'type': 'string', 'facet': True},
        {'name': 'number', 'type': 'int32', 'sort': True},
    ],
    'default_sorting_field': 'number'
}
```

## Cache e Queue

### Redis 7

Cache e message broker.

**Uso:**

- Cache de sessões
- Broker do Celery
- Cache de queries

### Celery 5.4

Task queue para operações assíncronas.

**Uso:**

- Indexação em batch
- Processamento de uploads
- Envio de emails

## Autenticação

### django-allauth 65.x

Autenticação completa.

**Features:**

- Login email/senha
- Login social (Google)
- Verificação de email
- Recuperação de senha

## Frontend

### Templates Django

Templates server-side com:

- Template inheritance
- Custom template tags
- Context processors

### CSS Framework

Bootstrap 5 para estilos.

### JavaScript

Vanilla JS para interações simples.

## Testes

### pytest + pytest-django

Framework de testes.

**Plugins:**

- `pytest-cov` - Coverage
- `pytest-django` - Django integration
- `factory-boy` - Test factories

### Playwright

Testes E2E.

**Uso:**

- Navegação
- Autenticação
- Upload
- Features sociais

## Qualidade de Código

### Black

Formatador de código.

```bash
poetry run black .
```

### isort

Ordenação de imports.

```bash
poetry run isort .
```

### Ruff

Linter rápido.

```bash
poetry run ruff check .
```

## CI/CD

### GitHub Actions

Pipeline de CI/CD.

**Jobs:**

1. Lint (Black, isort, Ruff)
2. Unit Tests
3. E2E Tests

## Docker

### Serviços

```yaml
services:
  postgres:
    image: postgres:16-alpine

  redis:
    image: redis:7-alpine

  typesense:
    image: typesense/typesense:27.1
```

## Dependências Principais

```toml
[tool.poetry.dependencies]
python = "^3.11"
django = "^5.1"
wagtail = "^6.4"
psycopg2-binary = "^2.9"
typesense = "^0.21"
django-allauth = "^65.3"
celery = "^5.4"
redis = "^5.2"
pyyaml = "^6.0"
pillow = "^11.1"
```

Veja `pyproject.toml` para lista completa.
