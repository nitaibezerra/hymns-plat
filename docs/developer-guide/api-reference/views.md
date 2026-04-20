# Views Reference

Referência das views e URLs.

## apps.hymns

### URLs

```python
# apps/hymns/urls.py
urlpatterns = [
    path('', home_view, name='home'),
    path('hinarios/', hymnbook_list, name='hymnbook_list'),
    path('hinarios/<slug:slug>/', hymnbook_detail, name='hymnbook_detail'),
    path('hino/<uuid:pk>/', hymn_detail, name='hymn_detail'),
    path('busca/', search_view, name='search'),
]
```

### home_view

```python
def home_view(request):
    """Página inicial com estatísticas."""
```

**URL:** `/`
**Template:** `hymns/home.html`
**Context:**

| Variável | Tipo | Descrição |
|----------|------|-----------|
| `hymnbook_count` | int | Total de hinários |
| `hymn_count` | int | Total de hinos |
| `recent_hymnbooks` | QuerySet | Últimos 6 hinários |

### hymnbook_list

```python
def hymnbook_list(request):
    """Lista paginada de hinários."""
```

**URL:** `/hinarios/`
**Template:** `hymns/hymnbook_list.html`
**Context:**

| Variável | Tipo | Descrição |
|----------|------|-----------|
| `hymnbooks` | Page | Página de hinários |

### hymnbook_detail

```python
def hymnbook_detail(request, slug):
    """Detalhes de um hinário."""
```

**URL:** `/hinarios/<slug>/`
**Template:** `hymns/hymnbook_detail.html`
**Context:**

| Variável | Tipo | Descrição |
|----------|------|-----------|
| `hymnbook` | HymnBook | O hinário |
| `hymns` | QuerySet | Hinos do hinário |

### hymn_detail

```python
def hymn_detail(request, pk):
    """Detalhes de um hino."""
```

**URL:** `/hino/<uuid>/`
**Template:** `hymns/hymn_detail.html`
**Context:**

| Variável | Tipo | Descrição |
|----------|------|-----------|
| `hymn` | Hymn | O hino |
| `is_favorite` | bool | Se usuário favoritou |
| `comments` | QuerySet | Comentários |

### search_view

```python
def search_view(request):
    """Busca de hinos."""
```

**URL:** `/busca/`
**Template:** `hymns/search.html`
**GET params:**

| Param | Tipo | Descrição |
|-------|------|-----------|
| `q` | str | Query de busca |

**Context:**

| Variável | Tipo | Descrição |
|----------|------|-----------|
| `results` | list | Hinos encontrados |
| `query` | str | Query usada |
| `total` | int | Total de resultados |

## apps.users

### URLs

```python
# apps/users/urls.py
urlpatterns = [
    path('contribuir/', upload_view, name='upload'),
    path('perfil/<str:username>/', profile_view, name='profile'),
    path('notificacoes/', notifications_view, name='notifications'),
    path('api/favorite/<uuid:hymn_id>/', toggle_favorite, name='toggle_favorite'),
    path('api/comment/<uuid:hymn_id>/', add_comment, name='add_comment'),
    path('api/follow/<str:username>/', toggle_follow, name='toggle_follow'),
]
```

### upload_view

```python
@login_required
def upload_view(request):
    """Upload de hinário YAML."""
```

**URL:** `/contribuir/`
**Template:** `users/upload.html`
**Methods:** GET, POST
**Auth:** Requer login

### profile_view

```python
def profile_view(request, username):
    """Perfil público de usuário."""
```

**URL:** `/perfil/<username>/`
**Template:** `users/profile.html`
**Context:**

| Variável | Tipo | Descrição |
|----------|------|-----------|
| `profile_user` | User | Usuário do perfil |
| `is_following` | bool | Se está seguindo |
| `followers_count` | int | Número de seguidores |
| `following_count` | int | Número de seguidos |

### notifications_view

```python
@login_required
def notifications_view(request):
    """Lista de notificações."""
```

**URL:** `/notificacoes/`
**Template:** `users/notifications.html`
**Auth:** Requer login

### API Endpoints

#### toggle_favorite

```python
@login_required
@require_POST
def toggle_favorite(request, hymn_id):
    """Toggle favorito de um hino."""
```

**URL:** `/api/favorite/<uuid>/`
**Method:** POST
**Response:** JSON `{"favorited": true/false}`

#### add_comment

```python
@login_required
@require_POST
def add_comment(request, hymn_id):
    """Adiciona comentário a um hino."""
```

**URL:** `/api/comment/<uuid>/`
**Method:** POST
**Body:** `{"text": "..."}`
**Response:** JSON com dados do comentário

#### toggle_follow

```python
@login_required
@require_POST
def toggle_follow(request, username):
    """Toggle seguir usuário."""
```

**URL:** `/api/follow/<username>/`
**Method:** POST
**Response:** JSON `{"following": true/false}`

## Decorators Comuns

```python
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST, require_GET

@login_required
def protected_view(request):
    pass

@require_POST
def post_only_view(request):
    pass
```

## Mixins (CBV)

```python
from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import DetailView

class HymnDetailView(LoginRequiredMixin, DetailView):
    model = Hymn
    template_name = 'hymns/detail.html'
```
