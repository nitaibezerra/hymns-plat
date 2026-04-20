# Backup e Restore

Estratégias de backup e recuperação.

## O que Fazer Backup

| Componente | Crítico | Frequência |
|------------|---------|------------|
| PostgreSQL | Sim | Diário |
| Media files | Sim | Diário |
| TypeSense data | Não* | Semanal |
| Redis | Não | Não |
| .env | Sim | Sob demanda |

*TypeSense pode ser reindexado a partir do PostgreSQL.

## PostgreSQL

### Backup Manual

```bash
# Dump completo
pg_dump -U hymsplat hymsplat > backup_$(date +%Y%m%d).sql

# Dump comprimido
pg_dump -U hymsplat hymsplat | gzip > backup_$(date +%Y%m%d).sql.gz

# Dump custom format (mais rápido para restore)
pg_dump -Fc -U hymsplat hymsplat > backup_$(date +%Y%m%d).dump
```

### Restore

```bash
# SQL plain
psql -U hymsplat hymsplat < backup.sql

# Gzip
gunzip -c backup.sql.gz | psql -U hymsplat hymsplat

# Custom format
pg_restore -d hymsplat backup.dump
```

### Backup Automático

```bash
# /etc/cron.d/hymsplat-backup
0 3 * * * hymsplat /home/hymsplat/scripts/backup.sh
```

```bash
#!/bin/bash
# /home/hymsplat/scripts/backup.sh

BACKUP_DIR="/home/hymsplat/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Database
pg_dump -Fc -U hymsplat hymsplat > $BACKUP_DIR/db_$DATE.dump

# Media
tar -czf $BACKUP_DIR/media_$DATE.tar.gz /home/hymsplat/hymns-plat/media/

# Limpar backups antigos (manter últimos 7 dias)
find $BACKUP_DIR -type f -mtime +7 -delete

# Upload para S3 (opcional)
aws s3 cp $BACKUP_DIR/db_$DATE.dump s3://hymsplat-backups/
aws s3 cp $BACKUP_DIR/media_$DATE.tar.gz s3://hymsplat-backups/
```

## Media Files

### Backup

```bash
# Tar completo
tar -czf media_backup.tar.gz /home/hymsplat/hymns-plat/media/

# Rsync para outro servidor
rsync -avz /home/hymsplat/hymns-plat/media/ backup-server:/backups/media/
```

### Restore

```bash
# Extrair
tar -xzf media_backup.tar.gz -C /home/hymsplat/hymns-plat/

# Permissões
chown -R hymsplat:hymsplat /home/hymsplat/hymns-plat/media/
```

## TypeSense

### Backup

```bash
# Snapshot via API
curl -X POST "http://localhost:8108/operations/snapshot?snapshot_path=/backups/typesense" \
  -H "X-TYPESENSE-API-KEY: xyz"
```

### Restore

Geralmente é mais fácil reindexar:

```bash
poetry run python manage.py reindex_typesense
```

## Configurações

### .env

```bash
# Backup
cp .env .env.backup_$(date +%Y%m%d)

# Não commitar .env!
# Guarde em local seguro (1Password, Vault, etc)
```

## Disaster Recovery

### Cenário: Perda Total

1. **Provisionar novo servidor**
   ```bash
   # Usar Terraform/Ansible ou manual
   ```

2. **Restaurar configurações**
   ```bash
   # Clone do repo
   git clone https://github.com/nitai-bezerra/hymns-plat.git
   cd hymns-plat

   # Restaurar .env
   cp /backup/.env.backup .env
   ```

3. **Restaurar database**
   ```bash
   # Criar DB
   sudo -u postgres createdb hymsplat

   # Restore
   pg_restore -d hymsplat /backup/db_latest.dump
   ```

4. **Restaurar media**
   ```bash
   tar -xzf /backup/media_latest.tar.gz -C /home/hymsplat/hymns-plat/
   ```

5. **Setup aplicação**
   ```bash
   poetry install --only main
   python manage.py collectstatic --noinput
   python manage.py reindex_typesense
   ```

6. **Iniciar serviços**
   ```bash
   sudo systemctl start hymsplat
   sudo systemctl start nginx
   ```

### Tempo de Recuperação

| Etapa | Tempo Estimado |
|-------|----------------|
| Provisionar servidor | 10-30 min |
| Restaurar DB | 5-15 min |
| Restaurar media | 5-10 min |
| Setup aplicação | 10-15 min |
| Verificação | 5-10 min |
| **Total** | **35-80 min** |

## Testes de Backup

### Mensal

1. Restaurar backup em ambiente de teste
2. Verificar integridade dos dados
3. Testar funcionalidades principais

### Script de Verificação

```bash
#!/bin/bash
# verify_backup.sh

# Restore para DB de teste
createdb hymsplat_test
pg_restore -d hymsplat_test /backup/db_latest.dump

# Verificar contagens
psql -d hymsplat_test -c "SELECT COUNT(*) FROM hymns_hymnbook;"
psql -d hymsplat_test -c "SELECT COUNT(*) FROM hymns_hymn;"
psql -d hymsplat_test -c "SELECT COUNT(*) FROM users_user;"

# Limpar
dropdb hymsplat_test

echo "Backup verification complete"
```

## Cloud Storage

### S3

```bash
# Install AWS CLI
pip install awscli
aws configure

# Upload
aws s3 cp backup.dump s3://hymsplat-backups/db/
aws s3 cp media.tar.gz s3://hymsplat-backups/media/

# Download
aws s3 cp s3://hymsplat-backups/db/backup.dump ./
```

### Lifecycle Policy

```json
{
  "Rules": [
    {
      "ID": "DeleteOldBackups",
      "Status": "Enabled",
      "Filter": {},
      "Expiration": {
        "Days": 30
      }
    }
  ]
}
```
