# Variáveis de Ambiente

Todas as variáveis de ambiente usadas no projeto.

## Arquivo .env

Copie o exemplo:

```bash
cp .env.example .env
```

## Variáveis Obrigatórias

### Django

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `SECRET_KEY` | Chave secreta Django | `sua-chave-muito-secreta-aqui` |
| `DEBUG` | Modo debug | `True` / `False` |
| `ALLOWED_HOSTS` | Hosts permitidos | `localhost,127.0.0.1` |

### Database

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `DATABASE_URL` | URL de conexão | `postgres://user:pass@host:5432/db` |

Ou separadamente:

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `DATABASE_NAME` | Nome do banco | `hymnplat` |
| `DATABASE_USER` | Usuário | `hymnplat` |
| `DATABASE_PASSWORD` | Senha | `hymnplat` |
| `DATABASE_HOST` | Host | `localhost` |
| `DATABASE_PORT` | Porta | `5432` |

### TypeSense

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `TYPESENSE_API_KEY` | Chave da API | `xyz` |
| `TYPESENSE_HOST` | Host | `localhost` |
| `TYPESENSE_PORT` | Porta | `8108` |
| `TYPESENSE_PROTOCOL` | Protocolo | `http` / `https` |

### Redis

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `REDIS_URL` | URL de conexão | `redis://localhost:6379/0` |

## Variáveis Opcionais

### Email

| Variável | Descrição | Default |
|----------|-----------|---------|
| `EMAIL_BACKEND` | Backend de email | `console` |
| `EMAIL_HOST` | Servidor SMTP | - |
| `EMAIL_PORT` | Porta SMTP | `587` |
| `EMAIL_USE_TLS` | Usar TLS | `True` |
| `EMAIL_HOST_USER` | Usuário SMTP | - |
| `EMAIL_HOST_PASSWORD` | Senha SMTP | - |

### OAuth (Google)

| Variável | Descrição |
|----------|-----------|
| `GOOGLE_CLIENT_ID` | Client ID do Google |
| `GOOGLE_CLIENT_SECRET` | Client Secret |

### Celery

| Variável | Descrição | Default |
|----------|-----------|---------|
| `CELERY_BROKER_URL` | Broker URL | `redis://localhost:6379/0` |
| `CELERY_RESULT_BACKEND` | Backend | `redis://localhost:6379/0` |

### Logging

| Variável | Descrição | Default |
|----------|-----------|---------|
| `LOG_LEVEL` | Nível de log | `INFO` |

## Exemplo Completo

```bash
# .env

# Django
SECRET_KEY=django-insecure-change-this-in-production
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database
DATABASE_URL=postgres://hymnplat:hymnplat@localhost:5432/hymnplat

# TypeSense
TYPESENSE_API_KEY=xyz
TYPESENSE_HOST=localhost
TYPESENSE_PORT=8108
TYPESENSE_PROTOCOL=http

# Redis
REDIS_URL=redis://localhost:6379/0

# Email (desenvolvimento)
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
```

## Por Ambiente

### Desenvolvimento

```bash
DEBUG=True
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
```

### Produção

```bash
DEBUG=False
ALLOWED_HOSTS=seudominio.com
SECRET_KEY=chave-muito-segura-gerada-aleatoriamente

# Email real
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.seudominio.com
```

## Acessando no Código

```python
import os
from django.conf import settings

# Via os.environ
api_key = os.environ.get('TYPESENSE_API_KEY')

# Via django-environ
from config.settings.base import env
api_key = env('TYPESENSE_API_KEY')

# Via settings
from django.conf import settings
debug = settings.DEBUG
```

## Segurança

!!! warning "Importante"
    - Nunca commite `.env` no repositório
    - Use senhas fortes em produção
    - Rotacione `SECRET_KEY` periodicamente
    - Use variáveis de ambiente do sistema em produção
