# Testes de Integração

Testando componentes integrados.

## O que São

Testes de integração verificam que múltiplos componentes funcionam juntos:

- Django + Database
- Views + Templates
- Django + TypeSense
- Django + Redis/Celery

## Diferença de Unitários

| Aspecto | Unitário | Integração |
|---------|----------|------------|
| Escopo | Uma função/classe | Múltiplos componentes |
| Database | Mockado/Memory | Real (test DB) |
| Velocidade | Muito rápido | Mais lento |
| Isolamento | Total | Parcial |

## Exemplos

### Django + Database

```python
# tests/unit/test_integration_db.py
import pytest
from django.db import transaction
from apps.hymns.models import HymnBook, Hymn


class TestDatabaseIntegration:
    def test_cascade_delete(self, hymnbook_with_hymns):
        """Verifica que hinos são deletados com hinário."""
        hymnbook_id = hymnbook_with_hymns.id
        hymn_ids = list(hymnbook_with_hymns.hymns.values_list('id', flat=True))

        hymnbook_with_hymns.delete()

        assert not HymnBook.objects.filter(id=hymnbook_id).exists()
        assert not Hymn.objects.filter(id__in=hymn_ids).exists()

    def test_transaction_rollback(self, hymnbook):
        """Verifica rollback em erro."""
        initial_count = Hymn.objects.count()

        try:
            with transaction.atomic():
                Hymn.objects.create(
                    hymn_book=hymnbook,
                    number=1,
                    title="Test",
                    text="Text"
                )
                raise Exception("Simulated error")
        except Exception:
            pass

        assert Hymn.objects.count() == initial_count
```

### Views + Templates

```python
class TestViewsIntegration:
    def test_hymnbook_list_shows_all_books(self, client, hymnbook_factory):
        """Lista mostra todos os hinários."""
        books = [hymnbook_factory() for _ in range(5)]

        response = client.get(reverse('hymnbook_list'))

        for book in books:
            assert book.name.encode() in response.content

    def test_search_results_clickable(self, client, hymn):
        """Resultados de busca linkam para detalhes."""
        response = client.get(reverse('search'), {'q': hymn.title})

        assert f'/hino/{hymn.pk}/' in response.content.decode()
```

### Django + TypeSense

```python
# tests/unit/test_integration_search.py
import pytest
from apps.search.indexer import index_hymn, search_hymns


@pytest.mark.integration
class TestSearchIntegration:
    @pytest.fixture(autouse=True)
    def setup_typesense(self, typesense_client):
        """Setup TypeSense para testes."""
        # Limpar antes do teste
        try:
            typesense_client.collections['hymns'].delete()
        except:
            pass
        typesense_client.collections.create(HYMNS_SCHEMA)

    def test_index_and_search(self, hymn):
        """Indexa e busca um hino."""
        index_hymn(hymn)

        results = search_hymns(hymn.title)

        assert results['found'] == 1
        assert results['hits'][0]['document']['id'] == str(hymn.id)

    def test_search_by_text_content(self, hymn):
        """Busca por conteúdo da letra."""
        hymn.text = "Lua branca da luz serena"
        hymn.save()
        index_hymn(hymn)

        results = search_hymns("luz serena")

        assert results['found'] == 1

    def test_typo_tolerance(self, hymn):
        """Tolerância a erros de digitação."""
        hymn.title = "Lua Branca"
        hymn.save()
        index_hymn(hymn)

        # Erro de digitação
        results = search_hymns("Lua Bramca")

        assert results['found'] == 1
```

### Django + Celery

```python
# tests/unit/test_integration_celery.py
import pytest
from unittest.mock import patch


@pytest.mark.integration
class TestCeleryIntegration:
    @patch('apps.hymns.tasks.reindex_typesense_task.delay')
    def test_upload_triggers_reindex(self, mock_task, authenticated_client, valid_yaml):
        """Upload dispara task de reindexação."""
        response = authenticated_client.post(
            reverse('upload'),
            {'yaml_file': valid_yaml}
        )

        mock_task.assert_called_once()

    def test_task_actual_execution(self, celery_app, hymn):
        """Task executa corretamente (eager mode)."""
        # Com CELERY_TASK_ALWAYS_EAGER=True
        from apps.hymns.tasks import reindex_typesense_task

        result = reindex_typesense_task()

        assert 'Indexed' in result
```

## Fixtures de Integração

```python
# tests/conftest.py
import pytest
import typesense


@pytest.fixture(scope='session')
def typesense_client():
    """Cliente TypeSense para testes."""
    return typesense.Client({
        'nodes': [{'host': 'localhost', 'port': 8108, 'protocol': 'http'}],
        'api_key': 'xyz',
        'connection_timeout_seconds': 2
    })


@pytest.fixture
def clean_search_index(typesense_client):
    """Limpa índice antes de cada teste."""
    try:
        typesense_client.collections['hymns'].delete()
    except:
        pass
    typesense_client.collections.create(HYMNS_SCHEMA)
    yield
    typesense_client.collections['hymns'].delete()
```

## Markers

```python
# pytest.ini
[pytest]
markers =
    integration: mark test as integration test
    slow: mark test as slow
```

```python
# Uso
@pytest.mark.integration
def test_something_integrated():
    pass

# Rodar apenas integração
# poetry run pytest -m integration
```

## Boas Práticas

### Isolamento

```python
@pytest.fixture(autouse=True)
def reset_state():
    """Limpa estado entre testes."""
    yield
    # Cleanup
    cache.clear()
```

### Timeouts

```python
@pytest.mark.timeout(10)
def test_slow_integration():
    pass
```

### Skip Condicional

```python
import pytest

typesense_available = check_typesense_connection()

@pytest.mark.skipif(not typesense_available, reason="TypeSense not available")
def test_search():
    pass
```
