# Monitoramento

Observabilidade e monitoramento em produção.

## Logs

### Django Logging

```python
# config/settings/production.py
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': '/var/log/hymsplat/django.log',
            'maxBytes': 10485760,  # 10MB
            'backupCount': 5,
            'formatter': 'verbose',
        },
        'error_file': {
            'level': 'ERROR',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': '/var/log/hymsplat/error.log',
            'maxBytes': 10485760,
            'backupCount': 5,
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['file'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['file', 'error_file'],
            'level': 'INFO',
            'propagate': True,
        },
    },
}
```

### Gunicorn Logs

```python
# gunicorn.conf.py
errorlog = "/var/log/gunicorn/error.log"
accesslog = "/var/log/gunicorn/access.log"
loglevel = "info"
```

### Nginx Logs

```nginx
access_log /var/log/nginx/hymsplat.access.log;
error_log /var/log/nginx/hymsplat.error.log;
```

## Métricas

### Django Prometheus

```python
# config/settings/production.py
INSTALLED_APPS += ['django_prometheus']

MIDDLEWARE = [
    'django_prometheus.middleware.PrometheusBeforeMiddleware',
    # ... outros middlewares ...
    'django_prometheus.middleware.PrometheusAfterMiddleware',
]
```

```python
# config/urls.py
urlpatterns += [
    path('metrics/', include('django_prometheus.urls')),
]
```

### Métricas Disponíveis

- Request count
- Request latency
- Response status codes
- Database queries
- Cache hits/misses

## Alertas

### Sentry

```python
# config/settings/production.py
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration

sentry_sdk.init(
    dsn=env('SENTRY_DSN'),
    integrations=[DjangoIntegration()],
    traces_sample_rate=0.1,
    send_default_pii=True
)
```

### Alertas Recomendados

| Alerta | Condição | Ação |
|--------|----------|------|
| Error Rate | >1% em 5min | Investigar |
| Latency | p99 >2s | Otimizar |
| 5xx | >10 em 1min | Investigar |
| Disk | >80% | Limpar/expandir |
| Memory | >90% | Investigar leak |

## Health Checks

### Endpoint

```python
# apps/core/views.py
from django.http import JsonResponse
from django.db import connection

def health_check(request):
    """Endpoint de health check."""
    status = {'status': 'healthy'}

    # Database
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
        status['database'] = 'ok'
    except Exception as e:
        status['database'] = f'error: {e}'
        status['status'] = 'unhealthy'

    # TypeSense
    try:
        import requests
        resp = requests.get(f'{TYPESENSE_HOST}/health', timeout=2)
        status['typesense'] = 'ok' if resp.ok else 'error'
    except Exception:
        status['typesense'] = 'error'

    # Redis
    try:
        import redis
        r = redis.from_url(REDIS_URL)
        r.ping()
        status['redis'] = 'ok'
    except Exception:
        status['redis'] = 'error'

    http_status = 200 if status['status'] == 'healthy' else 503
    return JsonResponse(status, status=http_status)
```

### Nginx Health

```nginx
location /health/ {
    proxy_pass http://hymsplat;
    proxy_read_timeout 5s;
}
```

## Dashboards

### Grafana

Métricas recomendadas:

1. **Request Rate** - Requests/segundo
2. **Error Rate** - % de erros
3. **Latency** - p50, p95, p99
4. **Active Users** - Sessões ativas
5. **Search Latency** - Tempo de busca

### Exemplo Dashboard

```json
{
  "panels": [
    {
      "title": "Request Rate",
      "type": "graph",
      "targets": [
        {
          "expr": "rate(django_http_requests_total[5m])"
        }
      ]
    },
    {
      "title": "Error Rate",
      "type": "singlestat",
      "targets": [
        {
          "expr": "sum(rate(django_http_requests_total{status=~\"5..\"}[5m])) / sum(rate(django_http_requests_total[5m])) * 100"
        }
      ]
    }
  ]
}
```

## Comandos Úteis

```bash
# Logs em tempo real
sudo journalctl -u hymsplat -f

# Erros recentes
sudo tail -100 /var/log/hymsplat/error.log

# Nginx access
sudo tail -f /var/log/nginx/hymsplat.access.log | grep -v health

# Celery workers
poetry run celery -A config inspect active

# Redis stats
redis-cli info
```

## Troubleshooting

### Alto Tempo de Resposta

1. Verificar queries lentas: `pg_stat_statements`
2. Verificar cache: `redis-cli info stats`
3. Verificar CPU/Memory: `htop`

### Erros 500

1. Verificar logs: `/var/log/hymsplat/error.log`
2. Verificar Sentry
3. Verificar conexões: DB, Redis, TypeSense

### Memória Alta

1. Verificar workers: `ps aux | grep gunicorn`
2. Verificar cache size
3. Restart workers: `sudo systemctl restart hymsplat`
