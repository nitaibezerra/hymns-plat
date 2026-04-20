# CI/CD

Pipeline de Integração e Deploy Contínuo.

## GitHub Actions

O projeto usa GitHub Actions para CI/CD.

### Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint:
    name: Lint & Format Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.13'

      - name: Install Poetry
        uses: snok/install-poetry@v1

      - name: Install dependencies
        run: poetry install

      - name: Run Black
        run: poetry run black --check .

      - name: Run isort
        run: poetry run isort --check-only .

      - name: Run Ruff
        run: poetry run ruff check .

  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.13'

      - name: Install dependencies
        run: poetry install

      - name: Run tests
        env:
          DJANGO_SETTINGS_MODULE: config.settings.test
        run: poetry run pytest tests/unit/ --cov=apps

  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: hymnplat
          POSTGRES_USER: hymnplat
          POSTGRES_PASSWORD: hymnplat
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

      typesense:
        image: typesense/typesense:27.1
        ports:
          - 8108:8108
        env:
          TYPESENSE_API_KEY: xyz

    steps:
      - uses: actions/checkout@v4

      - name: Setup and run E2E tests
        run: |
          poetry install
          poetry run playwright install chromium --with-deps
          poetry run python manage.py migrate
          poetry run python manage.py runserver 9000 &
          sleep 5
          poetry run pytest tests/e2e/ -v
```

## Jobs

### lint

Verifica formatação e estilo:

- Black (formatação)
- isort (imports)
- Ruff (linting)

### unit-tests

Roda testes unitários:

- pytest com coverage
- Banco em memória (SQLite)
- TypeSense mockado

### e2e-tests

Roda testes E2E:

- PostgreSQL real
- Redis real
- TypeSense real
- Playwright browser

## Triggers

| Evento | Quando | Jobs |
|--------|--------|------|
| push main | Merge em main | Todos |
| push develop | Merge em develop | Todos |
| pull_request | PR aberto/atualizado | Todos |

## Secrets

Configure no GitHub:

| Secret | Descrição |
|--------|-----------|
| `DEPLOY_KEY` | SSH key para servidor |
| `CODECOV_TOKEN` | Token do Codecov |

## Deploy Automático

### Deploy em Staging

```yaml
# .github/workflows/deploy-staging.yml
name: Deploy Staging

on:
  push:
    branches: [develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    needs: [lint, unit-tests, e2e-tests]
    steps:
      - name: Deploy to staging
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: hymsplat
          key: ${{ secrets.DEPLOY_KEY }}
          script: |
            cd /home/hymsplat/hyms-plat
            git pull origin develop
            source venv/bin/activate
            poetry install --only main
            python manage.py migrate
            python manage.py collectstatic --noinput
            sudo systemctl restart hymsplat
```

### Deploy em Produção

```yaml
# .github/workflows/deploy-production.yml
name: Deploy Production

on:
  release:
    types: [published]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to production
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.PRODUCTION_HOST }}
          username: hymsplat
          key: ${{ secrets.DEPLOY_KEY }}
          script: |
            cd /home/hymsplat/hyms-plat
            git fetch --tags
            git checkout ${{ github.event.release.tag_name }}
            source venv/bin/activate
            poetry install --only main
            python manage.py migrate
            python manage.py collectstatic --noinput
            sudo systemctl restart hymsplat
            python manage.py reindex_typesense
```

## Badges

```markdown
![CI](https://github.com/nitai-bezerra/hyms-plat/workflows/CI/badge.svg)
[![codecov](https://codecov.io/gh/nitai-bezerra/hyms-plat/branch/main/graph/badge.svg)](https://codecov.io/gh/nitai-bezerra/hyms-plat)
```

## Rodando Localmente

```bash
# Simular CI localmente com act
brew install act

# Rodar workflow
act push

# Rodar job específico
act -j unit-tests
```

## Troubleshooting

### Job Falhou

1. Clique no job no GitHub
2. Veja os logs
3. Identifique o erro
4. Corrija localmente
5. Push novamente

### Cache Problema

```yaml
# Limpar cache
- name: Clear cache
  run: |
    poetry cache clear . --all
```

### Timeout

```yaml
jobs:
  test:
    timeout-minutes: 30
```
