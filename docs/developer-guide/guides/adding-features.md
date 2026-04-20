# Adicionar Features

Guia para adicionar novas funcionalidades.

## Workflow

1. Criar branch
2. Implementar feature
3. Adicionar testes
4. Rodar CI local
5. Abrir PR

## Exemplo: Nova Feature

Vamos adicionar um sistema de "playlists" como exemplo.

### 1. Criar Model

```python
# apps/users/models.py
class Playlist(models.Model):
    """Playlist de hinos."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='playlists')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    hymns = models.ManyToManyField('hymns.Hymn', through='PlaylistItem')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class PlaylistItem(models.Model):
    """Item de playlist (hymn + ordem)."""

    playlist = models.ForeignKey(Playlist, on_delete=models.CASCADE)
    hymn = models.ForeignKey('hymns.Hymn', on_delete=models.CASCADE)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']
        unique_together = [['playlist', 'hymn']]
```

### 2. Criar Migration

```bash
poetry run python manage.py makemigrations users
poetry run python manage.py migrate
```

### 3. Criar Views

```python
# apps/users/views.py
@login_required
def playlist_list(request):
    playlists = request.user.playlists.all()
    return render(request, 'users/playlist_list.html', {'playlists': playlists})


@login_required
def playlist_detail(request, pk):
    playlist = get_object_or_404(Playlist, pk=pk, user=request.user)
    items = playlist.playlistitem_set.select_related('hymn')
    return render(request, 'users/playlist_detail.html', {
        'playlist': playlist,
        'items': items,
    })


@login_required
@require_POST
def create_playlist(request):
    name = request.POST.get('name')
    if not name:
        return JsonResponse({'error': 'Name required'}, status=400)

    playlist = Playlist.objects.create(user=request.user, name=name)
    return JsonResponse({'id': str(playlist.id), 'name': playlist.name})


@login_required
@require_POST
def add_to_playlist(request, playlist_id, hymn_id):
    playlist = get_object_or_404(Playlist, pk=playlist_id, user=request.user)
    hymn = get_object_or_404(Hymn, pk=hymn_id)

    item, created = PlaylistItem.objects.get_or_create(
        playlist=playlist,
        hymn=hymn,
        defaults={'order': playlist.playlistitem_set.count()}
    )

    return JsonResponse({'added': created})
```

### 4. Adicionar URLs

```python
# apps/users/urls.py
urlpatterns += [
    path('playlists/', playlist_list, name='playlist_list'),
    path('playlists/<uuid:pk>/', playlist_detail, name='playlist_detail'),
    path('api/playlists/', create_playlist, name='create_playlist'),
    path('api/playlists/<uuid:playlist_id>/add/<uuid:hymn_id>/',
         add_to_playlist, name='add_to_playlist'),
]
```

### 5. Criar Templates

```html
<!-- templates/users/playlist_list.html -->
{% extends "base.html" %}

{% block content %}
<h1>Minhas Playlists</h1>

<button id="create-playlist">Nova Playlist</button>

<ul>
{% for playlist in playlists %}
  <li>
    <a href="{% url 'playlist_detail' playlist.pk %}">
      {{ playlist.name }}
    </a>
    ({{ playlist.hymns.count }} hinos)
  </li>
{% empty %}
  <li>Nenhuma playlist ainda.</li>
{% endfor %}
</ul>
{% endblock %}
```

### 6. Adicionar Testes

```python
# tests/unit/test_playlists.py
import pytest
from apps.users.models import Playlist, PlaylistItem


@pytest.fixture
def playlist(user):
    return Playlist.objects.create(user=user, name="My Playlist")


class TestPlaylist:
    def test_create_playlist(self, user):
        playlist = Playlist.objects.create(user=user, name="Test")
        assert playlist.name == "Test"
        assert playlist.user == user

    def test_add_hymn_to_playlist(self, playlist, hymn):
        item = PlaylistItem.objects.create(playlist=playlist, hymn=hymn)
        assert item in playlist.playlistitem_set.all()

    def test_playlist_ordering(self, playlist, hymn_factory):
        hymns = [hymn_factory() for _ in range(3)]
        for i, hymn in enumerate(hymns):
            PlaylistItem.objects.create(playlist=playlist, hymn=hymn, order=i)

        items = list(playlist.playlistitem_set.all())
        assert items[0].order < items[1].order < items[2].order
```

### 7. Testes E2E

```python
# tests/e2e/test_playlists.py
import pytest
from playwright.sync_api import Page, expect


@pytest.mark.e2e
class TestPlaylists:
    def test_create_playlist(self, authenticated_page: Page, base_url: str):
        authenticated_page.goto(f"{base_url}/playlists/")
        authenticated_page.click("#create-playlist")
        authenticated_page.fill('input[name="name"]', "Minha Playlist")
        authenticated_page.click('button[type="submit"]')

        expect(authenticated_page.locator("text=Minha Playlist")).to_be_visible()
```

### 8. Rodar Testes

```bash
# Unitários
poetry run pytest tests/unit/test_playlists.py -v

# E2E (com servidor rodando)
poetry run pytest tests/e2e/test_playlists.py -v

# Coverage
poetry run pytest --cov=apps tests/
```

### 9. Formatar e Lint

```bash
poetry run black .
poetry run isort .
poetry run ruff check --fix .
```

### 10. Commit e PR

```bash
git add .
git commit -m "feat(users): adiciona sistema de playlists"
git push origin feat/playlists
```

## Checklist

Antes de abrir PR:

- [ ] Models com docstrings
- [ ] Migrations criadas
- [ ] Views implementadas
- [ ] URLs registradas
- [ ] Templates criados
- [ ] Testes unitários
- [ ] Testes E2E (se aplicável)
- [ ] Coverage > 80%
- [ ] Código formatado
- [ ] Lint passa

## Dicas

### Use Factories

```python
# tests/factories.py
class PlaylistFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Playlist

    user = factory.SubFactory(UserFactory)
    name = factory.Faker('sentence', nb_words=3)
```

### Use Fixtures

```python
@pytest.fixture
def playlist_with_hymns(playlist, hymn_factory):
    for i in range(5):
        PlaylistItem.objects.create(
            playlist=playlist,
            hymn=hymn_factory(),
            order=i
        )
    return playlist
```

### Mantenha Simples

- Uma feature por PR
- Commits pequenos
- Testes focados
