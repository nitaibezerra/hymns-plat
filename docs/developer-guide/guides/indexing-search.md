# Reindexar Busca

Guia para gerenciar o índice do TypeSense.

## Quando Reindexar

- Após importação em batch
- Quando dados parecem desatualizados
- Após mudanças no schema
- Após restaurar backup

## Comando Básico

```bash
poetry run python manage.py reindex_typesense
```

## Output Esperado

```
Checking TypeSense connection...
Connection OK: localhost:8108
Deleting existing 'hymns' collection...
Creating 'hymns' collection with schema...
Indexing hymns...
Progress: 100/1234 hymns...
Progress: 200/1234 hymns...
...
Successfully indexed 1234 hymns in 12.5 seconds
```

## Opções

### Batch Size

```bash
# Maior batch = mais rápido, mais memória
poetry run python manage.py reindex_typesense --batch-size=500
```

### Sem Deletar

```bash
# Mantém collection existente, apenas atualiza
poetry run python manage.py reindex_typesense --no-delete
```

## Indexação Individual

### Via Signal

Hinos são indexados automaticamente ao salvar:

```python
# Ao criar/atualizar um hino, o signal dispara
hymn = Hymn.objects.create(...)
# Automaticamente indexado!
```

### Via Código

```python
from apps.search.indexer import index_hymn, delete_hymn

# Indexar
index_hymn(hymn)

# Remover
delete_hymn(str(hymn.id))
```

## Verificar Índice

### Via API

```bash
# Health check
curl http://localhost:8108/health

# Ver collections
curl -H "X-TYPESENSE-API-KEY: xyz" \
  http://localhost:8108/collections

# Ver stats da collection
curl -H "X-TYPESENSE-API-KEY: xyz" \
  http://localhost:8108/collections/hymns
```

### Via Django

```bash
poetry run python manage.py check_typesense
```

## Schema

O schema atual:

```python
HYMNS_SCHEMA = {
    'name': 'hymns',
    'fields': [
        {'name': 'id', 'type': 'string'},
        {'name': 'hymn_book_id', 'type': 'string'},
        {'name': 'hymn_book_name', 'type': 'string', 'facet': True},
        {'name': 'hymn_book_slug', 'type': 'string'},
        {'name': 'owner_name', 'type': 'string', 'facet': True},
        {'name': 'number', 'type': 'int32', 'sort': True},
        {'name': 'title', 'type': 'string'},
        {'name': 'text', 'type': 'string'},
        {'name': 'style', 'type': 'string', 'facet': True, 'optional': True},
    ],
    'default_sorting_field': 'number'
}
```

### Modificando Schema

Se precisar mudar o schema:

1. Atualize `apps/search/schema.py`
2. Execute `reindex_typesense`
3. Collection é recriada com novo schema

## Performance

### Reindexação Grande

Para muitos hinos (10k+):

```bash
# Use batch maior
poetry run python manage.py reindex_typesense --batch-size=1000

# Considere rodar em background
nohup poetry run python manage.py reindex_typesense > reindex.log 2>&1 &
```

### Monitorar Progresso

```bash
# Acompanhar log
tail -f reindex.log
```

## Troubleshooting

### Connection Refused

```bash
# Verificar se TypeSense está rodando
docker-compose ps typesense

# Reiniciar
docker-compose restart typesense
```

### Collection Not Found

```bash
# Recriar collection
poetry run python manage.py reindex_typesense
```

### Dados Desatualizados

```bash
# Forçar recriação
poetry run python manage.py reindex_typesense
```

### Memory Issues

```bash
# Usar batch menor
poetry run python manage.py reindex_typesense --batch-size=50
```

## Em Produção

### Reindexação sem Downtime

```python
# 1. Criar collection temporária
create_collection_with_name('hymns_new')

# 2. Indexar na nova
for hymn in Hymn.objects.iterator():
    index_hymn_to_collection(hymn, 'hymns_new')

# 3. Trocar alias (se usar)
# Ou: deletar antiga e renomear
delete_collection('hymns')
rename_collection('hymns_new', 'hymns')
```

### Via Celery

```python
@celery_app.task
def reindex_typesense_task():
    """Task para reindexar em background."""
    from apps.search.indexer import reindex_all
    return reindex_all()

# Disparar
reindex_typesense_task.delay()
```
