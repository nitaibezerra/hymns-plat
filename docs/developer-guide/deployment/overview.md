# Deployment Overview

Visão geral do deploy do projeto.

## Ambientes

| Ambiente | Uso | URL |
|----------|-----|-----|
| Local | Desenvolvimento | localhost:8000 |
| Staging | Testes | staging.portal-hinarios.com.br |
| Production | Usuários | portal-hinarios.com.br |

## Stack de Produção

```
                    ┌─────────────┐
                    │   Cloudflare │ (CDN/DNS)
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │    Nginx     │ (Reverse Proxy)
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
    │ Gunicorn │      │ Gunicorn │      │ Gunicorn │
    │ Worker 1 │      │ Worker 2 │      │ Worker N │
    └────┬────┘      └────┬────┘      └────┬────┘
         │                 │                 │
         └─────────────────┼─────────────────┘
                           │
    ┌──────────────────────┼──────────────────────┐
    │                      │                      │
┌───▼────┐          ┌──────▼──────┐          ┌────▼────┐
│PostgreSQL│          │   TypeSense  │          │  Redis   │
└─────────┘          └─────────────┘          └─────────┘
```

## Componentes

### Application Server

**Gunicorn** com múltiplos workers:

```bash
gunicorn config.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers 4 \
  --threads 2 \
  --worker-class gthread
```

### Reverse Proxy

**Nginx** para:

- SSL termination
- Static files
- Load balancing
- Rate limiting

### Database

**PostgreSQL** com:

- Connection pooling (PgBouncer)
- Backups diários
- Replicação (opcional)

### Search

**TypeSense** com:

- Alta disponibilidade
- Replicação
- Backups

### Cache/Queue

**Redis** para:

- Cache de sessões
- Celery broker
- Cache de queries

### Background Tasks

**Celery** com:

- Workers para tasks
- Beat para agendamento
- Flower para monitoramento

## Checklist de Deploy

### Pré-deploy

- [ ] Testes passando (CI)
- [ ] Migrations testadas
- [ ] Assets buildados
- [ ] Variáveis de ambiente configuradas
- [ ] Backups verificados

### Deploy

- [ ] Migrate database
- [ ] Collect static files
- [ ] Restart workers
- [ ] Reindex search (se necessário)
- [ ] Verificar logs

### Pós-deploy

- [ ] Smoke tests
- [ ] Monitorar erros
- [ ] Verificar métricas
- [ ] Comunicar equipe

## Estratégias

### Blue-Green

1. Dois ambientes idênticos
2. Deploy no ambiente inativo
3. Switch de tráfego
4. Rollback rápido

### Rolling

1. Atualiza um server por vez
2. Sem downtime
3. Rollback complexo

### Canary

1. Deploy para subset de usuários
2. Monitorar erros
3. Rollout gradual

## Ferramentas

| Ferramenta | Uso |
|------------|-----|
| Docker | Containerização |
| GitHub Actions | CI/CD |
| Ansible | Provisioning |
| Terraform | Infrastructure |

## Links

- [Setup Produção](production-setup.md)
- [CI/CD](ci-cd.md)
- [Monitoramento](monitoring.md)
- [Backup/Restore](backup-restore.md)
