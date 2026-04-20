# Problemas Comuns

Soluções para problemas frequentes no setup.

## Instalação

### Poetry não encontrado

**Erro:**
```
command not found: poetry
```

**Solução:**
```bash
# Instalar Poetry
curl -sSL https://install.python-poetry.org | python3 -

# Adicionar ao PATH
export PATH="$HOME/.local/bin:$PATH"
```

### Versão Python incorreta

**Erro:**
```
The currently activated Python version 3.9.x is not supported
```

**Solução:**
```bash
# Instalar Python 3.11+
# macOS
brew install python@3.11

# Ubuntu
sudo apt install python3.11

# Usar versão específica
poetry env use python3.11
poetry install
```

### Erro ao instalar psycopg2

**Erro:**
```
Error: pg_config executable not found
```

**Solução:**
```bash
# macOS
brew install postgresql

# Ubuntu
sudo apt install libpq-dev python3-dev
```

## Docker

### Container não inicia

**Erro:**
```
port is already allocated
```

**Solução:**
```bash
# Encontrar processo usando a porta
lsof -i :5432

# Matar processo
kill -9 <PID>

# Ou mude a porta no docker-compose.yml
```

### Permissão negada

**Erro:**
```
permission denied while trying to connect to Docker
```

**Solução:**
```bash
# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER

# Logout e login novamente
```

### Volume com dados antigos

**Problema:** Migrations não funcionam

**Solução:**
```bash
# Limpar volumes
docker-compose down -v
docker-compose up -d
```

## Database

### Connection refused

**Erro:**
```
connection refused to localhost:5432
```

**Solução:**

1. Verificar se container está rodando:
```bash
docker-compose ps
```

2. Verificar logs:
```bash
docker-compose logs postgres
```

3. Reiniciar container:
```bash
docker-compose restart postgres
```

### Migrations falham

**Erro:**
```
relation "table_name" does not exist
```

**Solução:**
```bash
# Reset completo
docker-compose down -v
docker-compose up -d
poetry run python manage.py migrate
```

## TypeSense

### Connection refused

**Erro:**
```
typesense.exceptions.RequestUnauthorized
```

**Solução:**

1. Verificar se container está rodando
2. Verificar `TYPESENSE_API_KEY` no `.env`
3. Testar conexão:
```bash
curl -H "X-TYPESENSE-API-KEY: xyz" \
  http://localhost:8108/health
```

### Collection não existe

**Erro:**
```
ObjectNotFound: Collection 'hymns' not found
```

**Solução:**
```bash
poetry run python manage.py reindex_typesense
```

## Redis

### Connection refused

**Erro:**
```
redis.exceptions.ConnectionError
```

**Solução:**
```bash
# Verificar container
docker-compose ps redis

# Testar conexão
redis-cli ping
```

## Testes

### Testes E2E falham

**Erro:**
```
playwright._impl._errors.Error: Browser not found
```

**Solução:**
```bash
poetry run playwright install chromium
```

### Servidor não está rodando

**Erro:**
```
ConnectionRefusedError: [Errno 111] Connection refused
```

**Solução:**
```bash
# Em um terminal
poetry run python manage.py runserver 9000

# Em outro terminal
poetry run pytest tests/e2e/ -v
```

### Coverage baixa

**Problema:** Coverage < 80%

**Solução:**
```bash
# Ver arquivos não cobertos
poetry run pytest --cov=apps --cov-report=html
open htmlcov/index.html
```

## Geral

### Import error

**Erro:**
```
ModuleNotFoundError: No module named 'apps'
```

**Solução:**
```bash
# Certificar que está no diretório correto
cd hymns-plat

# Reinstalar dependências
poetry install
```

### Settings não encontradas

**Erro:**
```
django.core.exceptions.ImproperlyConfigured
```

**Solução:**
```bash
export DJANGO_SETTINGS_MODULE=config.settings.local
```

### Arquivo .env não carrega

**Problema:** Variáveis undefined

**Solução:**

1. Verificar se `.env` existe:
```bash
ls -la .env
```

2. Verificar formato:
```bash
# Correto
DATABASE_URL=postgres://...

# Errado (não use aspas)
DATABASE_URL="postgres://..."
```

## Ainda com problemas?

1. Verifique os [Issues no GitHub](https://github.com/nitai-bezerra/hymns-plat/issues)
2. Abra um novo issue com:
   - Descrição do problema
   - Mensagem de erro completa
   - Sistema operacional
   - Versões (Python, Docker, etc.)
