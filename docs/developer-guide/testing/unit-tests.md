# Testes Unitários

Guia para escrever testes unitários.

## Convenções

### Nomenclatura

```python
# Arquivo: test_<module>.py
# tests/unit/test_models.py

# Classe: Test<ClasseName>
class TestHymnBook:
    # Método: test_<behavior>
    def test_str_returns_name(self):
        pass
```

### Estrutura AAA

```python
def test_hymn_creation(self, hymnbook):
    # Arrange - Preparar dados
    title = "Lua Branca"
    text = "Lua branca..."

    # Act - Executar ação
    hymn = Hymn.objects.create(
        hymn_book=hymnbook,
        number=1,
        title=title,
        text=text
    )

    # Assert - Verificar resultado
    assert hymn.title == title
    assert hymn.hymn_book == hymnbook
```

## Fixtures

### Básicas

```python
# tests/conftest.py
import pytest
from apps.hymns.models import HymnBook, Hymn


@pytest.fixture
def hymnbook(db):
    """Cria um HymnBook simples."""
    return HymnBook.objects.create(
        name="Test Hymnbook",
        owner_name="Test Owner"
    )


@pytest.fixture
def hymn(hymnbook):
    """Cria um Hymn simples."""
    return Hymn.objects.create(
        hymn_book=hymnbook,
        number=1,
        title="Test Hymn",
        text="Test lyrics"
    )
```

### Compostas

```python
@pytest.fixture
def hymnbook_with_hymns(hymnbook):
    """Cria HymnBook com múltiplos hinos."""
    for i in range(1, 6):
        Hymn.objects.create(
            hymn_book=hymnbook,
            number=i,
            title=f"Hymn {i}",
            text=f"Lyrics {i}"
        )
    return hymnbook
```

### Fixtures de Requisição

```python
@pytest.fixture
def authenticated_client(client, user):
    """Client autenticado."""
    client.force_login(user)
    return client
```

## Factories

```python
# tests/factories.py
import factory
from apps.hymns.models import HymnBook, Hymn
from apps.users.models import User


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User

    username = factory.Sequence(lambda n: f"user{n}")
    email = factory.LazyAttribute(lambda obj: f"{obj.username}@example.com")
    password = factory.PostGenerationMethodCall('set_password', 'password123')


class HymnBookFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = HymnBook

    name = factory.Sequence(lambda n: f"Hymnbook {n}")
    owner_name = factory.Faker('name')


class HymnFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Hymn

    hymn_book = factory.SubFactory(HymnBookFactory)
    number = factory.Sequence(lambda n: n + 1)
    title = factory.Faker('sentence', nb_words=3)
    text = factory.Faker('paragraph', nb_sentences=5)
```

## Exemplos por Tipo

### Models

```python
# tests/unit/test_models.py
import pytest
from apps.hymns.models import HymnBook, Hymn


class TestHymnBook:
    def test_str_returns_name(self, hymnbook):
        assert str(hymnbook) == hymnbook.name

    def test_hymn_count_property(self, hymnbook_with_hymns):
        assert hymnbook_with_hymns.hymn_count == 5

    def test_slug_auto_generated(self, db):
        hb = HymnBook.objects.create(
            name="O Cruzeiro",
            owner_name="Mestre Irineu"
        )
        assert hb.slug == "o-cruzeiro"


class TestHymn:
    def test_unique_number_per_hymnbook(self, hymn):
        with pytest.raises(IntegrityError):
            Hymn.objects.create(
                hymn_book=hymn.hymn_book,
                number=hymn.number,  # Mesmo número!
                title="Duplicate",
                text="Text"
            )
```

### Views

```python
# tests/unit/test_views.py
import pytest
from django.urls import reverse


class TestHomeView:
    def test_home_returns_200(self, client):
        response = client.get(reverse('home'))
        assert response.status_code == 200

    def test_home_shows_stats(self, client, hymnbook_with_hymns):
        response = client.get(reverse('home'))
        assert b'hinários' in response.content.lower()


class TestHymnDetailView:
    def test_returns_404_for_invalid_id(self, client):
        response = client.get(reverse('hymn_detail', args=['invalid-uuid']))
        assert response.status_code == 404

    def test_shows_hymn_text(self, client, hymn):
        response = client.get(reverse('hymn_detail', args=[hymn.pk]))
        assert hymn.text.encode() in response.content
```

### Forms

```python
# tests/unit/test_forms.py
import pytest
from apps.users.forms import UploadForm


class TestUploadForm:
    def test_valid_yaml_accepted(self, valid_yaml_file):
        form = UploadForm(files={'yaml_file': valid_yaml_file})
        assert form.is_valid()

    def test_invalid_yaml_rejected(self, invalid_yaml_file):
        form = UploadForm(files={'yaml_file': invalid_yaml_file})
        assert not form.is_valid()
        assert 'yaml_file' in form.errors
```

### Services

```python
# tests/unit/test_disambiguation.py
import pytest
from apps.hymns.disambiguation import calculate_string_similarity


class TestStringSimlarity:
    def test_identical_strings(self):
        assert calculate_string_similarity("abc", "abc") == 1.0

    def test_different_strings(self):
        score = calculate_string_similarity("abc", "xyz")
        assert score < 0.5

    def test_handles_none(self):
        assert calculate_string_similarity(None, "abc") == 0.0
        assert calculate_string_similarity("abc", None) == 0.0
```

## Mocking

```python
from unittest.mock import patch, MagicMock


class TestSearchView:
    @patch('apps.search.client.search_hymns')
    def test_search_calls_typesense(self, mock_search, client):
        mock_search.return_value = {'hits': [], 'found': 0}

        client.get(reverse('search'), {'q': 'lua'})

        mock_search.assert_called_once_with('lua')

    @patch('apps.search.client.search_hymns')
    def test_search_handles_error(self, mock_search, client):
        mock_search.side_effect = Exception("Connection error")

        response = client.get(reverse('search'), {'q': 'lua'})

        assert response.status_code == 200  # Graceful degradation
```

## Rodando

```bash
# Todos unitários
poetry run pytest tests/unit/

# Arquivo específico
poetry run pytest tests/unit/test_models.py

# Teste específico
poetry run pytest tests/unit/test_models.py::TestHymnBook::test_str_returns_name -v

# Com output verbose
poetry run pytest -v -s
```
