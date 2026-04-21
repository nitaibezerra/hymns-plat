"""
Pytest configuration and fixtures.
"""

import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image


@pytest.fixture
def user_factory():
    """
    Factory for creating test users.
    """
    from apps.users.models import User

    def _create_user(email="test@example.com", password="testpass123", **kwargs):
        return User.objects.create_user(username=email.split("@")[0], email=email, password=password, **kwargs)

    return _create_user


@pytest.fixture
def authenticated_client(client, user_factory):
    """
    Client with authenticated user.
    """
    user = user_factory()
    client.force_login(user)
    client.user = user
    return client


@pytest.fixture
def admin_client(client, user_factory):
    """
    Client with admin user authenticated.
    """
    user = user_factory(email="admin@example.com")
    user.is_staff = True
    user.is_superuser = True
    user.save()
    client.force_login(user)
    client.user = user
    return client


@pytest.fixture
def hymn_book_factory():
    """
    Factory for creating test HymnBooks.
    """
    from apps.hymns.models import HymnBook

    def _create_hymn_book(name="O Cruzeiro", owner_name="Mestre Irineu", **kwargs):
        return HymnBook.objects.create(name=name, owner_name=owner_name, **kwargs)

    return _create_hymn_book


@pytest.fixture
def hymn_factory():
    """
    Factory for creating test Hymns.
    """
    from apps.hymns.models import Hymn

    def _create_hymn(hymn_book, number=1, title="Lua Branca", text="Lua branca...", **kwargs):
        return Hymn.objects.create(hymn_book=hymn_book, number=number, title=title, text=text, **kwargs)

    return _create_hymn


@pytest.fixture
def hymn_book(hymn_book_factory):
    """
    Single HymnBook instance for tests.
    """
    return hymn_book_factory()


@pytest.fixture
def hymn(hymn_book, hymn_factory):
    """
    Single Hymn instance for tests.
    """
    return hymn_factory(hymn_book=hymn_book)


@pytest.fixture
def hymns_multiple(hymn_book, hymn_factory):
    """
    Multiple Hymn instances for tests.
    """
    hymns = []
    for i in range(1, 6):
        hymns.append(hymn_factory(hymn_book=hymn_book, number=i, title=f"Hino {i}", text=f"Letra do hino {i}"))
    return hymns


@pytest.fixture
def sample_image():
    """
    Creates a sample test image.
    """
    image = Image.new("RGB", (100, 100), color="red")
    image_io = io.BytesIO()
    image.save(image_io, format="JPEG")
    image_io.seek(0)
    return SimpleUploadedFile("test_cover.jpg", image_io.read(), content_type="image/jpeg")


@pytest.fixture
def sample_yaml_valid(tmp_path):
    """
    Valid YAML content for testing import.
    """
    yaml_content = """hymn_book:
  name: O Cruzeiro
  owner: Mestre Irineu
  intro_name: Cruzeiro
  description: Hinário do Mestre Irineu
  hymns:
    - number: 1
      title: Lua Branca
      text: |
        Lua branca
        Da luz serena
        Vós sois tão bela
        Sois soberana
      received_at: 1930-07-15
      style: Valsa

    - number: 2
      title: Tuperci
      text: |
        Tuperci é um anjo
        Que vem de lá
        É um anjo divino
        De Juramidã
      style: Marcha
"""
    yaml_file = tmp_path / "valid.yaml"
    yaml_file.write_text(yaml_content)
    return str(yaml_file)


@pytest.fixture
def sample_yaml_invalid(tmp_path):
    """
    Invalid YAML content for testing error handling.
    """
    yaml_content = """hymn_book:
  name: Test Book
  owner: Test Owner
  hymns:
    - number: 1
      style: Valsa
"""
    yaml_file = tmp_path / "invalid.yaml"
    yaml_file.write_text(yaml_content)
    return str(yaml_file)


@pytest.fixture
def sample_yaml_duplicates(tmp_path):
    """
    YAML with duplicate hymn numbers for testing validation.
    """
    yaml_content = """hymn_book:
  name: Test Book
  owner: Test Owner
  hymns:
    - number: 1
      title: First Hymn
      text: First text

    - number: 1
      title: Duplicate Number
      text: Second text
"""
    yaml_file = tmp_path / "duplicates.yaml"
    yaml_file.write_text(yaml_content)
    return str(yaml_file)


@pytest.fixture
def mock_typesense_search_response():
    """
    Mock response for TypeSense search.
    """
    return {
        "found": 2,
        "hits": [
            {
                "document": {
                    "id": "hymn-1",
                    "title": "Lua Branca",
                    "text": "Lua branca da luz serena",
                    "hymn_book_name": "O Cruzeiro",
                    "number": 1,
                },
                "highlight": {"title": {"snippet": "<mark>Lua</mark> Branca"}},
            },
            {
                "document": {
                    "id": "hymn-2",
                    "title": "Tuperci",
                    "text": "Tuperci é um anjo",
                    "hymn_book_name": "O Cruzeiro",
                    "number": 2,
                },
                "highlight": {"text": {"snippet": "Tuperci é um <mark>anjo</mark>"}},
            },
        ],
    }
