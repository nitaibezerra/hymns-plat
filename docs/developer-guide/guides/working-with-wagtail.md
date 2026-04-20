# Wagtail CMS

Guia para trabalhar com Wagtail no projeto.

## Visão Geral

Wagtail é usado para:

- Páginas editáveis (Home, About)
- Conteúdo estático gerenciável
- Admin de conteúdo amigável

## Estrutura

```
apps/cms/
├── __init__.py
├── models.py          # Page models
├── wagtail_hooks.py   # Customizações admin
└── migrations/
```

## HomePage Model

```python
# apps/cms/models.py
from wagtail.models import Page
from wagtail.fields import RichTextField
from wagtail.admin.panels import FieldPanel


class HomePage(Page):
    """Página inicial customizada."""

    # Campos
    intro = RichTextField(blank=True)
    hero_title = models.CharField(max_length=255, blank=True)
    hero_subtitle = models.CharField(max_length=255, blank=True)

    # Panels para admin
    content_panels = Page.content_panels + [
        FieldPanel('hero_title'),
        FieldPanel('hero_subtitle'),
        FieldPanel('intro'),
    ]

    # Restrições
    parent_page_types = []  # Só pode ser raiz
    subpage_types = ['cms.ContentPage']  # Páginas filhas permitidas

    def get_context(self, request):
        context = super().get_context(request)
        # Adiciona dados dinâmicos
        context['hymnbook_count'] = HymnBook.objects.count()
        context['hymn_count'] = Hymn.objects.count()
        return context
```

## ContentPage

```python
class ContentPage(Page):
    """Página de conteúdo genérica."""

    body = RichTextField()

    content_panels = Page.content_panels + [
        FieldPanel('body'),
    ]

    parent_page_types = ['cms.HomePage']
```

## StreamField

Para conteúdo mais flexível:

```python
from wagtail.blocks import CharBlock, RichTextBlock, StructBlock
from wagtail.fields import StreamField
from wagtail.images.blocks import ImageChooserBlock


class HeroBlock(StructBlock):
    title = CharBlock()
    subtitle = CharBlock(required=False)
    image = ImageChooserBlock(required=False)

    class Meta:
        template = 'blocks/hero.html'


class FlexiblePage(Page):
    body = StreamField([
        ('hero', HeroBlock()),
        ('text', RichTextBlock()),
        ('image', ImageChooserBlock()),
    ], blank=True)

    content_panels = Page.content_panels + [
        FieldPanel('body'),
    ]
```

## Templates

### Template Base

```html
<!-- templates/cms/home_page.html -->
{% extends "base.html" %}
{% load wagtailcore_tags %}

{% block content %}
<section class="hero">
  <h1>{{ page.hero_title }}</h1>
  <p>{{ page.hero_subtitle }}</p>
</section>

<section class="intro">
  {{ page.intro|richtext }}
</section>

<section class="stats">
  <p>{{ hymnbook_count }} hinários</p>
  <p>{{ hymn_count }} hinos</p>
</section>
{% endblock %}
```

### StreamField Template

```html
<!-- templates/cms/flexible_page.html -->
{% extends "base.html" %}
{% load wagtailcore_tags %}

{% block content %}
{% for block in page.body %}
  {% include_block block %}
{% endfor %}
{% endblock %}
```

## Admin Customização

```python
# apps/cms/wagtail_hooks.py
from wagtail import hooks
from wagtail.admin.panels import FieldPanel


@hooks.register('construct_main_menu')
def hide_snippets_menu(request, menu_items):
    """Remove itens do menu que não usamos."""
    menu_items[:] = [item for item in menu_items
                     if item.name not in ['snippets']]
```

## Imagens

### Upload

```python
from wagtail.images.models import Image

# Via admin Wagtail
# Imagens → Upload

# Via código
from django.core.files import File
with open('image.jpg', 'rb') as f:
    image = Image.objects.create(
        title='Minha Imagem',
        file=File(f, name='image.jpg')
    )
```

### Em Templates

```html
{% load wagtailimages_tags %}

{% image page.cover_image width-300 as img %}
<img src="{{ img.url }}" alt="{{ img.alt }}">
```

## Migrations

```bash
# Criar migrations do CMS
poetry run python manage.py makemigrations cms

# Aplicar
poetry run python manage.py migrate
```

## Acessar Admin

1. Inicie o servidor
2. Acesse `/admin/` (Django) ou `/cms/` (Wagtail)
3. Use credenciais de superusuário

## Páginas Iniciais

Após setup, crie:

1. **Root Page** (automática)
2. **HomePage** como filha da root
3. Defina como `Site.root_page`

```python
# Via shell
from wagtail.models import Site
from apps.cms.models import HomePage

home = HomePage.objects.get(slug='home')
Site.objects.filter(is_default_site=True).update(root_page=home)
```

## Boas Práticas

### Campos

- Use `RichTextField` para texto formatado
- Use `StreamField` para layouts flexíveis
- Adicione `help_text` aos campos

### Templates

- Crie templates em `templates/cms/`
- Use `{% include_block %}` para StreamField
- Prefira template tags a lógica complexa

### Performance

- Use `select_related` quando buscar páginas
- Cache páginas que mudam pouco
- Otimize queries no `get_context`

## Troubleshooting

### Página não aparece

```python
# Verificar se está publicada
page = HomePage.objects.get(slug='home')
print(page.live)  # Deve ser True
```

### Template não encontrado

Verifique:

1. Nome do template: `{app_label}/{model_name}.html`
2. Localização: `templates/cms/home_page.html`

### Site não configurado

```python
from wagtail.models import Site
Site.objects.all()  # Verificar sites
```
