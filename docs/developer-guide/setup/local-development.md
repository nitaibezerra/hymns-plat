# Setup Local

Guia completo para configurar o ambiente de desenvolvimento.

## Pré-requisitos

- Python 3.11+
- Poetry 1.8+
- Docker e Docker Compose
- Git

## Passo a Passo

### 1. Clone o Repositório

```bash
git clone https://github.com/nitai-bezerra/hyms-plat.git
cd hyms-plat
```

### 2. Instale Dependências

```bash
# Instalar Poetry (se não tiver)
curl -sSL https://install.python-poetry.org | python3 -

# Instalar dependências
poetry install
```

### 3. Inicie os Serviços Docker

```bash
docker-compose up -d
```

Isso inicia:

- PostgreSQL 16 (porta 5432)
- Redis 7 (porta 6379)
- TypeSense 27.1 (porta 8108)

### 4. Configure Variáveis de Ambiente

```bash
cp .env.example .env
```

Edite `.env` com suas configurações:

```bash
# Database
DATABASE_URL=postgres://hymnplat:hymnplat@localhost:5432/hymnplat

# TypeSense
TYPESENSE_API_KEY=xyz
TYPESENSE_HOST=localhost
TYPESENSE_PORT=8108
TYPESENSE_PROTOCOL=http

# Redis
REDIS_URL=redis://localhost:6379/0

# Django
SECRET_KEY=sua-chave-secreta-aqui
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
```

### 5. Execute Migrations

```bash
poetry run python manage.py migrate
```

### 6. Crie Superusuário

```bash
poetry run python manage.py createsuperuser
```

### 7. Importe Dados de Teste (Opcional)

```bash
poetry run python manage.py import_yaml tests/fixtures/test_hymnbook.yaml
```

### 8. Indexe no TypeSense

```bash
poetry run python manage.py reindex_typesense
```

### 9. Inicie o Servidor

```bash
poetry run python manage.py runserver
```

Acesse: http://localhost:8000

## Comandos Úteis

```bash
# Servidor Django
poetry run python manage.py runserver

# Shell Django
poetry run python manage.py shell

# Rodar testes
poetry run pytest

# Rodar testes com coverage
poetry run pytest --cov=apps

# Formatar código
poetry run black .
poetry run isort .

# Lint
poetry run ruff check .

# Reindexar busca
poetry run python manage.py reindex_typesense
```

## Verificação

### Tudo funcionando?

- [ ] `http://localhost:8000` - Django rodando
- [ ] `http://localhost:8000/admin/` - Admin acessível
- [ ] `http://localhost:8108/health` - TypeSense saudável
- [ ] `docker ps` - 3 containers rodando

### Rodar testes

```bash
poetry run pytest
```

Todos os testes devem passar.

## Próximos Passos

- [Docker Services](docker-services.md) - Detalhes dos containers
- [Variáveis de Ambiente](environment-variables.md) - Todas as variáveis
- [Problemas Comuns](common-issues.md) - Troubleshooting
