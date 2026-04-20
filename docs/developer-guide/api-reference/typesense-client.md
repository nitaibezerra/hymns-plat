# TypeSense Client

API do cliente TypeSense.

## Configuração

```python
# apps/search/client.py
import typesense

client = typesense.Client({
    'nodes': [{
        'host': settings.TYPESENSE_HOST,
        'port': settings.TYPESENSE_PORT,
        'protocol': settings.TYPESENSE_PROTOCOL,
    }],
    'api_key': settings.TYPESENSE_API_KEY,
    'connection_timeout_seconds': 2
})
```

## Schema

```python
# apps/search/schema.py
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

## Funções

### create_collection

```python
def create_collection() -> None:
    """Cria collection de hinos."""
    try:
        client.collections['hymns'].delete()
    except Exception:
        pass

    client.collections.create(HYMNS_SCHEMA)
```

### index_hymn

```python
def index_hymn(hymn: Hymn) -> None:
    """Indexa um hino."""
    document = {
        'id': str(hymn.id),
        'hymn_book_id': str(hymn.hymn_book_id),
        'hymn_book_name': hymn.hymn_book.name,
        'hymn_book_slug': hymn.hymn_book.slug,
        'owner_name': hymn.hymn_book.owner_name,
        'number': hymn.number,
        'title': hymn.title,
        'text': hymn.text,
        'style': hymn.style or '',
    }

    client.collections['hymns'].documents.upsert(document)
```

### delete_hymn

```python
def delete_hymn(hymn_id: str) -> None:
    """Remove hino do índice."""
    client.collections['hymns'].documents[hymn_id].delete()
```

### search_hymns

```python
def search_hymns(
    query: str,
    per_page: int = 20,
    page: int = 1,
    filters: dict = None
) -> dict:
    """Busca hinos.

    Args:
        query: Termo de busca
        per_page: Resultados por página
        page: Número da página
        filters: Filtros opcionais

    Returns:
        Dict com hits e metadados
    """
    search_parameters = {
        'q': query,
        'query_by': 'title,text,hymn_book_name,owner_name',
        'per_page': per_page,
        'page': page,
        'typo_tolerance': True,
    }

    if filters:
        filter_parts = []
        if 'hymn_book_name' in filters:
            filter_parts.append(f"hymn_book_name:={filters['hymn_book_name']}")
        if 'style' in filters:
            filter_parts.append(f"style:={filters['style']}")

        if filter_parts:
            search_parameters['filter_by'] = ' && '.join(filter_parts)

    return client.collections['hymns'].documents.search(search_parameters)
```

### reindex_all

```python
def reindex_all(batch_size: int = 100) -> int:
    """Reindexa todos os hinos.

    Returns:
        Número de hinos indexados
    """
    create_collection()

    count = 0
    hymns = Hymn.objects.select_related('hymn_book')

    for hymn in hymns.iterator():
        index_hymn(hymn)
        count += 1

    return count
```

## Uso

### Busca Básica

```python
from apps.search.client import search_hymns

results = search_hymns("lua branca")
for hit in results['hits']:
    print(hit['document']['title'])
```

### Busca com Filtros

```python
results = search_hymns(
    query="lua",
    filters={'hymn_book_name': 'O Cruzeiro'}
)
```

### Busca Paginada

```python
page1 = search_hymns("lua", per_page=10, page=1)
page2 = search_hymns("lua", per_page=10, page=2)
```

## Response Format

```python
{
    'found': 42,
    'hits': [
        {
            'document': {
                'id': 'uuid...',
                'title': 'Lua Branca',
                'text': 'Lua branca da luz...',
                'hymn_book_name': 'O Cruzeiro',
                'owner_name': 'Mestre Irineu',
                'number': 1,
            },
            'highlight': {
                'title': {
                    'matched_tokens': ['Lua'],
                    'snippet': '<mark>Lua</mark> Branca'
                }
            },
            'text_match': 130
        },
        # ...
    ],
    'page': 1,
    'out_of': 5
}
```

## Troubleshooting

### Conexão recusada

```python
# Verificar health
import requests
response = requests.get('http://localhost:8108/health')
print(response.json())
```

### Collection não existe

```python
# Criar collection
from apps.search.client import create_collection
create_collection()
```

### Dados desatualizados

```bash
poetry run python manage.py reindex_typesense
```
