# Docker Services

Serviços externos gerenciados via Docker.

## Visão Geral

O projeto usa dois serviços externos. A busca usa PostgreSQL FTS nativo — não há mais um serviço dedicado de busca.

| Serviço | Imagem | Porta |
|---------|--------|-------|
| PostgreSQL | postgres:16-alpine | 5432 |
| Redis | redis:7-alpine | 6379 |

## Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: hymnplat
      POSTGRES_USER: hymnplat
      POSTGRES_PASSWORD: hymnplat
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hymnplat"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

## Comandos

### Iniciar Todos

```bash
docker-compose up -d
```

### Parar Todos

```bash
docker-compose down
```

### Ver Logs

```bash
# Todos os serviços
docker-compose logs -f

# Serviço específico
docker-compose logs -f postgres
```

### Reiniciar Serviço

```bash
docker-compose restart postgres
```

### Limpar Dados

```bash
# Para e remove volumes
docker-compose down -v
```

## PostgreSQL

### Conexão

```bash
# Via psql
docker-compose exec postgres psql -U hymnplat

# Via Django
poetry run python manage.py dbshell
```

### Backup

```bash
docker-compose exec postgres pg_dump -U hymnplat hymnplat > backup.sql
```

### Restore

```bash
cat backup.sql | docker-compose exec -T postgres psql -U hymnplat
```

## Redis

### Conexão

```bash
docker-compose exec redis redis-cli
```

### Comandos Úteis

```bash
# Ping
redis-cli ping

# Ver todas as keys
redis-cli keys '*'

# Limpar cache
redis-cli flushall
```

## Troubleshooting

### Container não inicia

```bash
# Ver logs
docker-compose logs postgres

# Verificar recursos
docker stats
```

### Porta já em uso

```bash
# Encontrar processo
lsof -i :5432

# Matar processo
kill -9 <PID>

# Ou mude a porta no docker-compose.yml
ports:
  - "5433:5432"
```

### Dados persistentes

Os dados são persistidos em Docker volumes:

```bash
# Listar volumes
docker volume ls

# Inspecionar volume
docker volume inspect hymns-plat_postgres_data
```
