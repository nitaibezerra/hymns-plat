# Setup de Produção

Configuração do ambiente de produção.

## Requisitos

### Hardware Mínimo

| Componente | Mínimo | Recomendado |
|------------|--------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Storage | 20 GB | 50+ GB SSD |

### Software

- Ubuntu 22.04 LTS
- Python 3.11+
- PostgreSQL 16
- Redis 7
- Nginx
- Supervisor/Systemd

## Instalação

### 1. Sistema Base

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependências
sudo apt install -y \
  python3.11 python3.11-venv python3-pip \
  postgresql-16 postgresql-contrib \
  redis-server \
  nginx \
  supervisor \
  git curl
```

### 2. Usuário da Aplicação

```bash
sudo useradd -m -s /bin/bash hymsplat
sudo su - hymsplat
```

### 3. Clone e Setup

```bash
cd /home/hymsplat
git clone https://github.com/nitai-bezerra/hyms-plat.git
cd hyms-plat

# Ambiente virtual
python3.11 -m venv venv
source venv/bin/activate

# Dependências
pip install poetry
poetry install --only main
```

### 4. Configuração

```bash
# Copiar exemplo
cp .env.example .env

# Editar com valores de produção
nano .env
```

```bash
# .env (produção)
DEBUG=False
ALLOWED_HOSTS=portal-hinarios.com.br,www.portal-hinarios.com.br
SECRET_KEY=<gerar-chave-segura>

DATABASE_URL=postgres://user:pass@localhost:5432/hymsplat
REDIS_URL=redis://localhost:6379/0

TYPESENSE_API_KEY=<chave-segura>
TYPESENSE_HOST=localhost
TYPESENSE_PORT=8108
TYPESENSE_PROTOCOL=http
```

### 5. Database

```bash
# Como postgres user
sudo -u postgres psql

CREATE DATABASE hymsplat;
CREATE USER hymsplat WITH PASSWORD 'senha-segura';
GRANT ALL PRIVILEGES ON DATABASE hymsplat TO hymsplat;
\q

# Migrations
python manage.py migrate
python manage.py createsuperuser
```

### 6. Static Files

```bash
python manage.py collectstatic --noinput
```

## Gunicorn

### Configuração

```python
# gunicorn.conf.py
bind = "127.0.0.1:8000"
workers = 4
threads = 2
worker_class = "gthread"
timeout = 30
keepalive = 5
errorlog = "/var/log/gunicorn/error.log"
accesslog = "/var/log/gunicorn/access.log"
loglevel = "info"
```

### Systemd Service

```ini
# /etc/systemd/system/hymsplat.service
[Unit]
Description=hyms-plat gunicorn daemon
After=network.target

[Service]
User=hymsplat
Group=hymsplat
WorkingDirectory=/home/hymsplat/hyms-plat
Environment="PATH=/home/hymsplat/hyms-plat/venv/bin"
ExecStart=/home/hymsplat/hyms-plat/venv/bin/gunicorn \
  --config gunicorn.conf.py \
  config.wsgi:application
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable hymsplat
sudo systemctl start hymsplat
```

## Nginx

```nginx
# /etc/nginx/sites-available/hymsplat
upstream hymsplat {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name portal-hinarios.com.br;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name portal-hinarios.com.br;

    ssl_certificate /etc/letsencrypt/live/portal-hinarios.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/portal-hinarios.com.br/privkey.pem;

    location /static/ {
        alias /home/hymsplat/hyms-plat/staticfiles/;
        expires 30d;
    }

    location /media/ {
        alias /home/hymsplat/hyms-plat/media/;
        expires 7d;
    }

    location / {
        proxy_pass http://hymsplat;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/hymsplat /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## SSL

```bash
# Certbot
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d portal-hinarios.com.br
```

## TypeSense

```bash
# Docker (recomendado)
docker run -d \
  --name typesense \
  -p 8108:8108 \
  -v /data/typesense:/data \
  typesense/typesense:27.1 \
  --data-dir /data \
  --api-key=$TYPESENSE_API_KEY
```

## Celery

```ini
# /etc/systemd/system/celery.service
[Unit]
Description=Celery Worker
After=network.target

[Service]
User=hymsplat
Group=hymsplat
WorkingDirectory=/home/hymsplat/hyms-plat
Environment="PATH=/home/hymsplat/hyms-plat/venv/bin"
ExecStart=/home/hymsplat/hyms-plat/venv/bin/celery \
  -A config worker \
  -l INFO
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

## Verificação

```bash
# Serviços
sudo systemctl status hymsplat
sudo systemctl status nginx
sudo systemctl status postgresql
sudo systemctl status redis

# Aplicação
curl -I https://portal-hinarios.com.br/

# Logs
sudo journalctl -u hymsplat -f
```
