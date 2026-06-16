# Portal de Hinários

Portal para pesquisa e acesso a hinários do Santo Daime.

## Stack Tecnológico

- **Backend:** Django 5.x + Wagtail 6.x
- **Database:** PostgreSQL
- **Search:** TypeSense
- **Task Queue:** Celery + Redis
- **Language:** Python 3.11+

## Setup Local

### Pré-requisitos

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- Docker & Docker Compose

### Instalação

1. Clone o repositório:
```bash
git clone https://github.com/nitaibezerra/hymns-plat.git
cd hymns-plat
```

2. Instale as dependências:
```bash
uv sync
```

3. Copie o arquivo de ambiente:
```bash
cp .env.example .env
```

4. Inicie os serviços com Docker:
```bash
docker-compose up -d
```

5. Execute as migrações:
```bash
uv run python manage.py migrate
```

6. Crie um superusuário:
```bash
uv run python manage.py createsuperuser
```

7. Inicie o servidor de desenvolvimento:
```bash
uv run python manage.py runserver
```

Acesse:
- **Frontend:** http://localhost:8000
- **Admin Django:** http://localhost:8000/django-admin/
- **Admin Wagtail:** http://localhost:8000/admin/

## Testes

Execute os testes:
```bash
uv run pytest
```

Com cobertura:
```bash
uv run pytest --cov=apps --cov-report=html
```

## Estrutura do Projeto

```
hymns-plat/
├── apps/
│   ├── core/       # Configurações base, mixins
│   ├── hymns/      # Models de hinários e hinos
│   ├── search/     # Integração TypeSense
│   ├── users/      # Autenticação e perfis
│   └── cms/        # Páginas Wagtail
├── config/         # Configurações Django
├── templates/      # Templates HTML
├── static/         # Arquivos estáticos
├── media/          # Uploads de usuários
└── tests/          # Testes
```

## Desenvolvimento

### Pre-commit hooks

Instale os hooks:
```bash
uv run pre-commit install
```

### Linting e Formatação

```bash
uv run black .
uv run isort .
uv run ruff check .
```

## Deploy

Ver documentação em `_plan/plano-implementacao.md`

## Licença

TBD

