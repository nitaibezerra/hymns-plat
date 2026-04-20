# Models Reference

Referência completa dos models Django.

## apps.hymns

### HymnBook

```python
class HymnBook(models.Model):
    """Hinário - coleção de hinos."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    name = models.CharField(max_length=255, unique=True, db_index=True)
    slug = models.SlugField(unique=True, max_length=255)
    intro_name = models.CharField(max_length=100, blank=True)
    owner_name = models.CharField(max_length=255)
    owner_user = models.ForeignKey('users.User', null=True, blank=True)
    cover_image = models.ImageField(upload_to='hymn_covers/', blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

**Propriedades:**

| Propriedade | Tipo | Descrição |
|-------------|------|-----------|
| `hymn_count` | int | Número de hinos no hinário |

**Métodos:**

| Método | Retorno | Descrição |
|--------|---------|-----------|
| `save()` | None | Auto-gera slug se não existir |
| `__str__()` | str | Retorna `name` |

### Hymn

```python
class Hymn(models.Model):
    """Hino individual."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    hymn_book = models.ForeignKey(HymnBook, related_name='hymns')
    number = models.PositiveIntegerField()
    title = models.CharField(max_length=255, db_index=True)
    text = models.TextField()
    received_at = models.DateField(null=True, blank=True)
    offered_to = models.CharField(max_length=255, blank=True)
    style = models.CharField(max_length=50, blank=True)
    extra_instructions = models.TextField(blank=True)
    repetitions = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

**Propriedades:**

| Propriedade | Tipo | Descrição |
|-------------|------|-----------|
| `full_title` | str | "Hinário - Nº. Título" |

**Meta:**

- `unique_together = [['hymn_book', 'number']]`
- `ordering = ['hymn_book', 'number']`

### HymnBookVersion

```python
class HymnBookVersion(models.Model):
    """Versão de um hinário."""

    STATUS_CHOICES = [
        ('pending', 'Pendente'),
        ('approved', 'Aprovado'),
        ('rejected', 'Rejeitado'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    original = models.ForeignKey(HymnBook, related_name='versions')
    uploaded_by = models.ForeignKey('users.User')
    version_number = models.PositiveIntegerField()
    changes = models.JSONField(default=dict)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
```

## apps.users

### User

```python
class User(AbstractUser):
    """Usuário customizado."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    bio = models.TextField(blank=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True)
```

### Favorite

```python
class Favorite(models.Model):
    """Hino favoritado."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user = models.ForeignKey(User, related_name='favorites')
    hymn = models.ForeignKey('hymns.Hymn', related_name='favorites')
    created_at = models.DateTimeField(auto_now_add=True)
```

**Meta:**

- `unique_together = [['user', 'hymn']]`

### Comment

```python
class Comment(models.Model):
    """Comentário em hino."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user = models.ForeignKey(User, related_name='comments')
    hymn = models.ForeignKey('hymns.Hymn', related_name='comments')
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

### Follow

```python
class Follow(models.Model):
    """Seguir usuário."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    follower = models.ForeignKey(User, related_name='following')
    following = models.ForeignKey(User, related_name='followers')
    created_at = models.DateTimeField(auto_now_add=True)
```

**Meta:**

- `unique_together = [['follower', 'following']]`

### Notification

```python
class Notification(models.Model):
    """Notificação para usuário."""

    TYPE_CHOICES = [
        ('favorite', 'Favoritou'),
        ('comment', 'Comentário'),
        ('follow', 'Seguiu'),
        ('upload', 'Upload'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user = models.ForeignKey(User, related_name='notifications')
    notification_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    data = models.JSONField(default=dict)
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
```

## Managers

### HymnBook.objects

```python
# Todos os hinários
HymnBook.objects.all()

# Por nome
HymnBook.objects.get(name="O Cruzeiro")

# Por slug
HymnBook.objects.get(slug="o-cruzeiro")

# Com prefetch de hinos
HymnBook.objects.prefetch_related('hymns')
```

### Hymn.objects

```python
# Todos os hinos
Hymn.objects.all()

# De um hinário
Hymn.objects.filter(hymn_book=hymnbook)

# Com select_related
Hymn.objects.select_related('hymn_book')

# Busca por título
Hymn.objects.filter(title__icontains="lua")
```

## Signals

```python
# apps/hymns/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender=Hymn)
def index_hymn_on_save(sender, instance, **kwargs):
    """Indexa hino no TypeSense ao salvar."""
    from apps.search.indexer import index_hymn
    index_hymn(instance)
```
