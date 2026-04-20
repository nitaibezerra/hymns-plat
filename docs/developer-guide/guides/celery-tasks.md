# Celery Tasks

Guia para tarefas em background com Celery.

## Configuração

### Settings

```python
# config/settings/base.py
CELERY_BROKER_URL = env('CELERY_BROKER_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND = env('CELERY_RESULT_BACKEND', default='redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'America/Sao_Paulo'
```

### Celery App

```python
# config/celery.py
import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')

app = Celery('hymsplat')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
```

### Init

```python
# config/__init__.py
from .celery import app as celery_app

__all__ = ('celery_app',)
```

## Criando Tasks

### Task Simples

```python
# apps/hymns/tasks.py
from celery import shared_task
from apps.search.indexer import reindex_all


@shared_task
def reindex_typesense_task():
    """Reindexa todos os hinos no TypeSense."""
    count = reindex_all()
    return f'Indexed {count} hymns'
```

### Task com Retry

```python
@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60
)
def send_email_task(self, user_id, subject, body):
    """Envia email com retry automático."""
    try:
        user = User.objects.get(pk=user_id)
        user.email_user(subject, body)
    except Exception as exc:
        raise self.retry(exc=exc)
```

### Task com Timeout

```python
@shared_task(time_limit=300, soft_time_limit=240)
def process_large_file_task(file_path):
    """Processa arquivo grande com timeout."""
    # 5 min hard limit, 4 min soft limit
    pass
```

## Chamando Tasks

### Assíncrono

```python
from apps.hymns.tasks import reindex_typesense_task

# Dispara e não espera
reindex_typesense_task.delay()

# Com argumentos
send_email_task.delay(user_id=123, subject='Hi', body='Hello')
```

### Síncrono (debug)

```python
# Executa imediatamente (bloqueia)
result = reindex_typesense_task()
```

### Com Options

```python
# Agendar para depois
from datetime import timedelta

reindex_typesense_task.apply_async(
    countdown=60  # em 60 segundos
)

# Em horário específico
from datetime import datetime
reindex_typesense_task.apply_async(
    eta=datetime(2024, 1, 15, 10, 0, 0)
)
```

## Rodando Workers

### Desenvolvimento

```bash
# Terminal 1: Django
poetry run python manage.py runserver

# Terminal 2: Celery worker
poetry run celery -A config worker -l INFO
```

### Com Auto-reload

```bash
poetry run celery -A config worker -l INFO --autoreload
```

### Beat (Agendamento)

```bash
# Terminal 3: Celery beat
poetry run celery -A config beat -l INFO
```

## Tarefas Agendadas

```python
# config/celery.py
from celery.schedules import crontab

app.conf.beat_schedule = {
    'reindex-every-night': {
        'task': 'apps.hymns.tasks.reindex_typesense_task',
        'schedule': crontab(hour=3, minute=0),
    },
    'cleanup-every-hour': {
        'task': 'apps.core.tasks.cleanup_old_data_task',
        'schedule': crontab(minute=0),
    },
}
```

## Monitoramento

### Flower

```bash
# Instalar
poetry add flower

# Rodar
poetry run celery -A config flower

# Acessar
open http://localhost:5555
```

### Logs

```bash
# Ver logs do worker
poetry run celery -A config worker -l DEBUG

# Com arquivo
poetry run celery -A config worker -l INFO --logfile=celery.log
```

## Tasks Úteis

### Notificações

```python
@shared_task
def send_notification_task(user_id, notification_type, data):
    """Cria notificação para usuário."""
    from apps.users.models import Notification

    Notification.objects.create(
        user_id=user_id,
        notification_type=notification_type,
        data=data
    )
```

### Cleanup

```python
@shared_task
def cleanup_old_notifications_task(days=30):
    """Remove notificações antigas."""
    from datetime import timedelta
    from django.utils import timezone
    from apps.users.models import Notification

    cutoff = timezone.now() - timedelta(days=days)
    deleted, _ = Notification.objects.filter(
        created_at__lt=cutoff,
        read=True
    ).delete()

    return f'Deleted {deleted} notifications'
```

### Processamento de Upload

```python
@shared_task(bind=True)
def process_upload_task(self, version_id):
    """Processa upload de hinário."""
    from apps.hymns.models import HymnBookVersion
    from apps.hymns.services import process_hymnbook_version

    version = HymnBookVersion.objects.get(pk=version_id)

    try:
        process_hymnbook_version(version)
        version.status = 'approved'
    except Exception as e:
        version.status = 'rejected'
        version.changes['error'] = str(e)

    version.save()
```

## Troubleshooting

### Task não executa

```python
# Verificar broker
import redis
r = redis.from_url('redis://localhost:6379/0')
r.ping()  # Deve retornar True
```

### Worker não conecta

```bash
# Verificar Redis
docker-compose ps redis

# Testar conexão
redis-cli ping
```

### Task presa

```bash
# Listar tasks ativas
poetry run celery -A config inspect active

# Cancelar task
poetry run celery -A config control revoke <task_id>
```
