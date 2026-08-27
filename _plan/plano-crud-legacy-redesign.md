# Plano: Redesign telas CRUD legadas (Editar Hinário & Editar Hino)

## Contexto

Duas telas escritas no Marco 1 (CRUD inicial) ficaram com cara de Bootstrap 2014 — `color: #2c5282` inline, iteração cega `{% for field in form %}`, sem hierarquia tipográfica, sem agrupamento de campos. Todo o resto do produto (workspace editorial, detail, leitor, revise, quick review) passou pelo redesign editorial (Fase 2.x) com paleta cream/firmament/gold, tipografia em camadas (Cormorant + Source Serif + Inter Tight + JetBrains Mono) e padrões reusáveis (eyebrows, hairlines, chips, focus-ring gold).

O design veio pronto via `claude.ai/design` e foi baixado pra `/tmp/hinaria-design-bundle/`. Entregáveis principais:
- `screens/crud-forms.jsx` — `HymnbookFormScreen` + `HymnFormScreen` com primitives (`EditHeader`, `Field`, `TextInput`, `TextArea`, `SuggestionChips`, `ErrorBanner`, `ActionBar`).
- `_plan/handoff-crud-legacy-redesign.md` — handoff já com decisões finais (inclui §1.1 nova: card "Curadoria editorial" staff-only com **publicação** + prioridade + destaque expostos no próprio form).

Outcome: as duas telas passam a fazer parte do mesmo livro/produto visualmente, e o form de hinário ganha um lugar canônico pra staff controlar `is_published`, `priority`, `is_featured` (hoje espalhados em 3 endpoints separados).

---

## Decisões de design

| Decisão | Escolha | Razão |
|---|---|---|
| `is_published` no form | **Checkbox no card "Visibilidade", validação reusada** | Save() chama `can_publish_hymnbook`; se inválido, ErrorBanner. Seta `published_at`/`published_by` automaticamente. Preserva invariante. (Endpoints antigos seguem vivos como atalho de strip.) |
| Publicação via form vs endpoint | **Form é fonte canônica; endpoints `publicar/`/`despublicar/` permanecem** | Migração suave; strip do detail continua funcionando até a próxima limpeza. |
| `priority` + `is_featured` no form | **Expostos staff-only** | Eliminam o submit POST separado do `hymnbook_editorial_update_view` como caminho preferencial. |
| Partial reusável de campo | **Criar `templates/hymns/_partials/_form_field.html`** | Hoje existe só `_history_drawer.html`. O partial encapsula label eyebrow + erro + help; o `{{ field }}` herda classes Tailwind do widget. |
| Classes Tailwind | **Reusar tokens existentes (`bg-cream-soft`, `text-rust`, `border-rule`, `text-ink-mute`, `ring-gold`)** | Tudo já registrado em `templates/base.html:24-60` (`theme.extend.colors`). |
| Eyebrows / chips / hairline | **Reusar `.eyebrow`, `.label-mono`, `.shortcut-pill`, `.suggestion-chips`, `.hairline`** | Já em `static/css/components.css`. Só falta adicionar `.shortcut-pill.is-active`. |
| Capa sem imagem | **Monograma + gradiente `display_accent`** | Property já existe (`models.py:124-131`); reusar com `linear-gradient(140deg, {{ hb.display_accent }} 0%, color-mix(in srgb, {{ hb.display_accent }} 60%, black) 100%)` igual `_partials/_hymnbook_card.html`. |
| Widget tweaks | **Hardcoded em `forms.py` widgets** (não há `django-widget-tweaks`) | Padrão já em uso. |
| JS dos chips | **Inline no template, padrão event-delegation** | Mesma família do `revise_hymn.html`. Sem novo arquivo `.js` separado. |

---

## Mudanças por bloco

### Bloco 1 — Backend: forms + views

**`apps/hymns/forms.py`**

1. **Estender `HymnBookForm.__init__` com kwarg `user=`** que condiciona staff-only fields:
   ```python
   class HymnBookForm(forms.ModelForm):
       class Meta:
           model = HymnBook
           fields = ["name", "intro_name", "owner_name", "description", "cover_image",
                     "priority", "is_featured", "is_published"]
           widgets = {
               # ... existentes ...
               "priority": forms.RadioSelect(),
               "is_featured": forms.CheckboxInput(),
               "is_published": forms.CheckboxInput(),
           }
           labels = { ..., "priority": "Prioridade", "is_featured": "Em destaque", "is_published": "Publicado" }

       def __init__(self, *args, user=None, **kwargs):
           super().__init__(*args, **kwargs)
           self.user = user
           if user is None or not user.is_staff:
               for f in ("priority", "is_featured", "is_published"):
                   self.fields.pop(f, None)

       def clean(self):
           cleaned = super().clean()
           # Se staff marcou is_published=True e ele NÃO estava publicado: gate via can_publish_hymnbook.
           wants_publish = cleaned.get("is_published") is True
           was_published = self.instance.pk and self.instance.is_published
           if wants_publish and not was_published and self.user is not None:
               from .permissions import can_publish_hymnbook
               if not can_publish_hymnbook(self.user, self.instance):
                   raise forms.ValidationError(
                       "Hinário ainda não pode ser publicado — complete os campos obrigatórios antes."
                   )
           return cleaned

       def save(self, commit=True):
           instance = super().save(commit=False)
           wants_publish = self.cleaned_data.get("is_published") is True
           if wants_publish and not instance.published_at:
               from django.utils import timezone
               instance.published_at = timezone.now()
               instance.published_by = self.user
           if commit:
               instance.save()
           return instance
   ```

2. **`HymnBookEditorialForm` permanece** — ainda alimenta o painel staff no `hymnbook_detail` (não tocar). Quando esse painel sair (próximo PR), aí deletar.

**`apps/hymns/views.py`**

3. **`hymnbook_create_view`** e **`hymnbook_edit_view`** (linhas 350 e 374): passar `user=request.user` ao instanciar `HymnBookForm`.
   ```python
   form = HymnBookForm(request.POST, request.FILES, instance=hymnbook, user=request.user)
   # e no GET:
   form = HymnBookForm(instance=hymnbook, user=request.user)
   ```

4. **`hymn_create_view`** (linha 511) e **`hymn_edit_view`** (linha 544): injetar `style_suggestions` + `repetition_suggestions` no contexto.
   ```python
   from django.db.models import Count

   def _style_suggestions(limit=8):
       qs = (Hymn.objects.exclude(style="")
             .values("style").annotate(c=Count("style")).order_by("-c", "style")[:limit])
       return [row["style"] for row in qs]

   REPETITION_SUGGESTIONS = ["todos 2×", "1-4, 5-8", "sem repetição"]
   # ... contexto ...
   "style_suggestions": _style_suggestions(),
   "repetition_suggestions": REPETITION_SUGGESTIONS,
   ```

### Bloco 2 — Frontend: partial reusável + componentes CSS

**`templates/hymns/_partials/_form_field.html`** (NOVO):
```django
{# Uso: {% include 'hymns/_partials/_form_field.html' with field=form.name eyebrow="Nome do hinário" %} #}
<label class="block" for="{{ field.id_for_label }}">
  <span class="eyebrow flex items-center gap-1.5 mb-1.5">
    {{ eyebrow|default:field.label }}{% if field.field.required %}<span class="text-rust">*</span>{% endif %}
  </span>
  {{ field }}
  {% if field.errors %}
    <p class="font-mono text-[11.5px] text-rust mt-1.5" id="{{ field.id_for_label }}-err">{{ field.errors.0 }}</p>
  {% elif field.help_text %}
    <p class="font-serif text-[12.5px] text-ink-mute mt-1.5 leading-snug" id="{{ field.id_for_label }}-help">{{ field.help_text }}</p>
  {% endif %}
</label>
```

**`static/css/components.css`** — adicionar **apenas**:
```css
/* Chip ativo: o estado :hover já existe; falta o is-active */
.shortcut-pill.is-active {
  background: color-mix(in oklab, var(--color-gold) 15%, var(--color-bg));
  border-color: var(--color-gold);
  color: color-mix(in oklab, var(--color-gold) 80%, var(--color-ink));
}
```

**`apps/hymns/forms.py`** — atualizar widgets pra incluir classes Tailwind base:
```python
INPUT_BASE = ("w-full px-3.5 py-2.5 rounded-lg border border-rule bg-cream-soft "
              "text-ink outline-none focus:border-gold focus:ring-[3px] focus:ring-gold/35")
TEXTAREA_BASE = INPUT_BASE + " leading-relaxed resize-y"
DISPLAY_INPUT = INPUT_BASE + " font-display text-[22px]"  # name, title, número
SERIF_TEXTAREA = TEXTAREA_BASE + " font-serif text-base"
```
Aplicar nos widgets de cada campo (`name`, `title`, `number` usam `DISPLAY_INPUT`; `text`, `description` usam `SERIF_TEXTAREA`; demais usam `INPUT_BASE`/`TEXTAREA_BASE`).

### Bloco 3 — Frontend: `templates/hymns/hymnbook_form.html` (reescrita)

Espelha `HymnbookFormScreen` do JSX. Estrutura:

```django
{% extends "base.html" %}
{% block title %}{{ title }} - {{ block.super }}{% endblock %}

{% block content %}
{# Header sticky: ← volta · título central · eyebrow direita #}
<section class="sticky top-0 z-10 bg-cream border-b border-rule">
  <div class="max-w-5xl mx-auto px-6 md:px-10 py-3.5 grid grid-cols-3 items-center gap-4">
    <a href="{% if hymnbook %}{% url 'hymns:hymnbook_detail' hymnbook.slug %}{% else %}{% url 'hymns:hymnbook_list' %}{% endif %}"
       class="font-serif text-sm text-ink-mute justify-self-start no-underline hover:text-gold">
      ← {% if hymnbook %}Hinário · {{ hymnbook.name }}{% else %}Hinários{% endif %}
    </a>
    <div class="text-center">
      <div class="font-display text-lg leading-none">{{ title }}</div>
    </div>
    <span class="eyebrow justify-self-end">{% if hymnbook %}EDITAR HINÁRIO{% else %}NOVO HINÁRIO{% endif %}</span>
  </div>
</section>

<form method="post" enctype="multipart/form-data" class="max-w-5xl mx-auto px-6 md:px-10 py-10 pb-14">
  {% csrf_token %}

  {# ErrorBanner consolidado #}
  {% if form.non_field_errors or form.errors %}
    <div class="border-l-4 border-rust bg-rust/[0.06] rounded-r-lg px-4 py-3 mb-7">
      <div class="eyebrow text-rust mb-1">Corrija antes de salvar</div>
      <div class="font-serif text-[13.5px] text-ink-soft">
        {% for e in form.non_field_errors %}{{ e }}{% if not forloop.last %}<br>{% endif %}{% endfor %}
        {% if form.non_field_errors and form.errors|length > 0 %}<br>{% endif %}
        {% if form.errors|length > 1 %}Há campos com problema abaixo — confira os destaques em vermelho.{% endif %}
      </div>
    </div>
  {% endif %}

  {# Grid capa + identidade #}
  <div class="grid md:grid-cols-[200px_1fr] gap-10 items-start">
    {# Capa: <img> se cover, senão monograma com display_accent #}
    <div>
      {% if hymnbook.cover_image %}
        <img src="{{ hymnbook.cover_image.url }}" alt="" class="aspect-[3/4] w-full object-cover rounded-lg border border-rule">
      {% else %}
        <div class="aspect-[3/4] rounded-lg overflow-hidden relative grid place-items-center border border-white/10 shadow-soft"
             style="background: linear-gradient(140deg, {{ hymnbook.display_accent|default:'#1d3b6a' }} 0%, color-mix(in srgb, {{ hymnbook.display_accent|default:'#1d3b6a' }} 60%, black) 100%);">
          <span class="font-display text-[108px] text-cream/45 leading-none">{{ hymnbook.name|slice:":1"|upper|default:"?" }}</span>
          <span class="absolute bottom-3 inset-x-0 text-center label-mono text-cream/50">{% if hymnbook %}SEM CAPA{% else %}NOVA CAPA{% endif %}</span>
        </div>
      {% endif %}
      {# input file escondido + botão visível #}
      <div class="mt-3 flex gap-2">
        <label class="btn-outline-firmament text-xs flex-1 justify-center cursor-pointer">
          {% if hymnbook.cover_image %}Trocar capa{% else %}Adicionar capa{% endif %}
          <span class="hidden">{{ form.cover_image }}</span>
        </label>
      </div>
      <p class="font-serif text-[11.5px] text-ink-mute mt-2.5 leading-snug">PNG, JPG ou WebP. Pelo menos 600×800px. Aparece nos cards do workspace e no detalhe.</p>
    </div>

    {# Identidade: name, intro_name, owner_name #}
    <div class="flex flex-col gap-5">
      {% include 'hymns/_partials/_form_field.html' with field=form.name eyebrow="Nome do hinário" %}
      {% include 'hymns/_partials/_form_field.html' with field=form.intro_name eyebrow="Nome curto" %}
      {% include 'hymns/_partials/_form_field.html' with field=form.owner_name eyebrow="Dono / Autor" %}
    </div>
  </div>

  {# Descrição full-width #}
  <div class="mt-10">
    {% include 'hymns/_partials/_form_field.html' with field=form.description eyebrow="Descrição" %}
  </div>

  {# §1.1 — Curadoria editorial (só staff) #}
  {% if request.user.is_staff %}
    <div class="mt-9 p-6 rounded-[10px] border border-rule bg-cream">
      <div class="flex items-center gap-2.5 mb-5">
        <span class="grid place-items-center w-[22px] h-[22px] rounded-[5px] bg-ink text-cream font-mono text-[10px] font-semibold">S</span>
        <span class="eyebrow">CURADORIA EDITORIAL · visível apenas para staff</span>
      </div>
      <div class="grid md:grid-cols-2 gap-8 items-start">
        {# Prioridade: P1/P2/P3 como cards-radio. Renderizar o form.priority manualmente. #}
        <div>
          <span class="eyebrow block mb-2.5">PRIORIDADE NA FILA DE REVISÃO</span>
          <div class="flex flex-col gap-2" data-priority-cards>
            {# Loop nos choices do field.priority, gerando os 3 cards com cor por escolha #}
            {# ver helper inline em _partials/_priority_radio.html #}
            {% include 'hymns/_partials/_priority_radio.html' with field=form.priority %}
          </div>
        </div>
        {# Visibilidade: is_published (moss) + is_featured (gold) como cards-checkbox #}
        <div class="flex flex-col gap-3">
          <span class="eyebrow block">VISIBILIDADE</span>
          {% include 'hymns/_partials/_visibility_card.html' with field=form.is_published color="moss" on_label="Publicado" off_label="Rascunho (não publicado)" on_help="visível publicamente em hinaria.com.br" off_help="oculto do público — só editores veem" %}
          {% include 'hymns/_partials/_visibility_card.html' with field=form.is_featured color="gold" on_label="Em destaque na home" off_label="Em destaque na home" on_help="entra no sorteio dos 6 cards da home" off_help="entra no sorteio dos 6 cards da home" show_star=True %}
        </div>
      </div>
    </div>
  {% endif %}

  {# ActionBar #}
  <div class="mt-9 pt-6 border-t border-rule flex items-center gap-4 justify-end">
    <a href="{% if hymnbook %}{% url 'hymns:hymnbook_detail' hymnbook.slug %}{% else %}{% url 'hymns:hymnbook_list' %}{% endif %}"
       class="btn-outline-firmament">Cancelar</a>
    <button type="submit" class="btn-primary-firmament">{{ submit_label }} →</button>
  </div>
</form>
{% endblock %}
```

Partials auxiliares novos (`_priority_radio.html`, `_visibility_card.html`) encapsulam só a apresentação dos cards-radio/checkbox — pequenos, cobertos por testes unitários do partial principal.

### Bloco 4 — Frontend: `templates/hymns/hymn_form.html` (reescrita)

Espelha `HymnFormScreen`. Estrutura (resumida — mesmo header sticky + ActionBar do Bloco 3):

```django
<form method="post" class="max-w-6xl mx-auto px-6 md:px-10 py-9 pb-14">
  {% csrf_token %}
  {# ErrorBanner se houver erros #}

  <div class="grid lg:grid-cols-[minmax(0,380px)_1fr] gap-10 items-start">
    {# COLUNA ESQUERDA — metadados #}
    <div>
      <div class="eyebrow mb-4">METADADOS</div>

      {# número + título, grid 88px / 1fr #}
      <div class="grid grid-cols-[88px_1fr] gap-3 mb-5">
        {% include 'hymns/_partials/_form_field.html' with field=form.number eyebrow="Nº" %}
        {% include 'hymns/_partials/_form_field.html' with field=form.title eyebrow="Título" %}
      </div>

      {# received_at + offered_to #}
      <div class="grid grid-cols-2 gap-3 mb-5">
        {% include 'hymns/_partials/_form_field.html' with field=form.received_at eyebrow="Recebido em" %}
        {% include 'hymns/_partials/_form_field.html' with field=form.offered_to eyebrow="Oferecido para" %}
      </div>

      <div class="mb-6">
        {% include 'hymns/_partials/_form_field.html' with field=form.section eyebrow="Seção" %}
      </div>

      <hr class="hairline">
      <div class="mt-5 mb-4"></div>

      {# style + chips #}
      <div class="mb-5">
        {% include 'hymns/_partials/_form_field.html' with field=form.style eyebrow="Estilo" %}
        <div class="suggestion-chips mt-2" data-target="{{ form.style.id_for_label }}">
          {% for s in style_suggestions %}
            <button type="button" class="shortcut-pill" data-value="{{ s }}">{{ s }}</button>
          {% endfor %}
        </div>
      </div>

      {# repetitions + chips #}
      <div class="mb-5">
        {% include 'hymns/_partials/_form_field.html' with field=form.repetitions eyebrow="Repetições" %}
        <div class="suggestion-chips mt-2" data-target="{{ form.repetitions.id_for_label }}">
          {% for r in repetition_suggestions %}
            <button type="button" class="shortcut-pill" data-value="{{ r }}">{{ r }}</button>
          {% endfor %}
        </div>
      </div>

      {% include 'hymns/_partials/_form_field.html' with field=form.extra_instructions eyebrow="Instruções" %}
    </div>

    {# COLUNA DIREITA — LETRA #}
    <div>
      <div class="eyebrow mb-4">LETRA</div>
      {{ form.text }}
      <div class="font-mono text-[11px] text-ink-mute tracking-[.04em] mt-2 flex gap-4">
        <span><span data-line-count>{{ hymn.text|default:""|linecount }}</span> linhas</span>
        <span><span data-char-count>{{ hymn.text|default:""|length }}</span> caracteres</span>
      </div>
    </div>
  </div>

  {# ActionBar idem Bloco 3 #}
</form>
```

Widget de `form.text` recebe `min-h-[560px] px-7 py-6 font-serif text-base` via `widgets={}` em `forms.py`.

### Bloco 5 — JS dos chips e do contador (inline)

No final do `hymn_form.html`:
```html
<script>
(function () {
  // Chips: clica → escreve valor no input. Input muda → marca chip ativo.
  document.querySelectorAll('.suggestion-chips[data-target]').forEach(function (group) {
    var input = document.getElementById(group.dataset.target);
    if (!input) return;
    var sync = function () {
      var v = (input.value || '').trim().toLowerCase();
      group.querySelectorAll('.shortcut-pill').forEach(function (b) {
        b.classList.toggle('is-active', (b.dataset.value || '').toLowerCase() === v);
      });
    };
    group.addEventListener('click', function (e) {
      var b = e.target.closest('.shortcut-pill'); if (!b) return;
      e.preventDefault();
      input.value = b.dataset.value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      sync();
    });
    input.addEventListener('input', sync);
    sync();
  });

  // Contador linhas/chars no textarea da letra
  var text = document.querySelector('textarea[name="text"]');
  var lineEl = document.querySelector('[data-line-count]');
  var charEl = document.querySelector('[data-char-count]');
  if (text && lineEl && charEl) {
    var upd = function () {
      lineEl.textContent = (text.value.match(/\n/g) || []).length + (text.value ? 1 : 0);
      charEl.textContent = text.value.length;
    };
    text.addEventListener('input', upd);
    upd();
  }
})();
</script>
```

### Bloco 6 — Cobertura de tests

**`tests/unit/test_form_partial.py`** (NOVO):
- Render `_form_field.html` com required → mostra `*` em `text-rust`.
- Render com `errors` → mostra `<p class="text-rust">` e NÃO mostra help.
- Render com só `help_text` → mostra help em `text-ink-mute`.
- Render sem errors e sem help → não emite `<p>`.

**`tests/unit/test_hymnbookform_staff.py`** (NOVO):
- `HymnBookForm(user=non_staff)` → `is_published`, `priority`, `is_featured` ausentes em `fields`.
- `HymnBookForm(user=staff)` → 3 campos presentes.
- `clean()` rejeita `is_published=True` quando `can_publish_hymnbook(user, hb) is False` (mock).
- `save()` seta `published_at` + `published_by` quando `is_published` vira True.
- `save()` NÃO sobrescreve `published_at` quando já estava publicado.

**`tests/unit/test_hymnform_suggestions.py`** (NOVO):
- `hymn_edit_view` injeta `style_suggestions` no contexto (≤ 8 itens, ordem por frequência desc).
- `hymn_create_view` mesma coisa.
- `repetition_suggestions == ["todos 2×", "1-4, 5-8", "sem repetição"]`.

**`tests/e2e/test_crud_legacy.py`** (NOVO):
- Editor logado abre `/hinarios/<slug>/editar/` → vê o card "Curadoria editorial" (staff) ou não (non-staff). Cards Visibilidade/Prioridade respondem.
- Marcar `is_published` num hinário incompleto → vê banner rust.
- Abrir `/hinos/<uuid>/editar/` → vê coluna esquerda com `METADADOS` + LETRA dominante na direita. Clica chip "Valsa" → input recebe "Valsa", chip fica `is-active`.
- Digitar na textarea → contador linhas/chars atualiza.

---

## Arquivos a editar/criar

**Editar:**
- `apps/hymns/forms.py` — estender `HymnBookForm` (user kwarg + clean + save); adicionar classes Tailwind nos widgets de `HymnBookForm` e `HymnForm` (constantes `INPUT_BASE`, etc.).
- `apps/hymns/views.py` — passar `user=request.user` em `hymnbook_create_view` (L350) + `hymnbook_edit_view` (L374); injetar `style_suggestions`/`repetition_suggestions` em `hymn_create_view` (L511) + `hymn_edit_view` (L544).
- `templates/hymns/hymnbook_form.html` — reescrita completa (Bloco 3).
- `templates/hymns/hymn_form.html` — reescrita completa (Bloco 4 + 5).
- `static/css/components.css` — adicionar `.shortcut-pill.is-active`.

**Criar:**
- `templates/hymns/_partials/_form_field.html` — Field reusável.
- `templates/hymns/_partials/_priority_radio.html` — 3 cards-radio P1/P2/P3.
- `templates/hymns/_partials/_visibility_card.html` — card-checkbox `is_published` ou `is_featured`.
- `tests/unit/test_form_partial.py` · `tests/unit/test_hymnbookform_staff.py` · `tests/unit/test_hymnform_suggestions.py`.
- `tests/e2e/test_crud_legacy.py`.

**Não tocar / fora de escopo:**
- `HymnBookEditorialForm` (continua existindo; deprecação fica pra outro PR).
- `hymnbook_publish_view`/`hymnbook_unpublish_view` (continuam vivas como atalho).
- Strip "Curadoria editorial" no `hymnbook_detail` (limpeza em outro PR).
- Migration (nada novo no model).
- URL mudanças.
- Rich-text na letra, live-preview, crop de capa.

## Referências no projeto

- Mockup: `screens/crud-forms.jsx` (em `/tmp/hinaria-design-bundle/hymns-platform/project/`) — fonte de verdade visual.
- Handoff: `_plan/handoff-crud-legacy-redesign.md` (no bundle do design) e cópia já em `_design/complete_crud/HANDOFF.md`.
- Padrões existentes a copiar:
  - `templates/hymns/editor/revise_hymn.html` — header sticky, eyebrows, focus-ring gold, JS de shortcuts (event delegation).
  - `templates/_partials/_hymnbook_card.html` — gradient `display_accent` 140deg.
  - `apps/hymns/models.py:124-131` — `HymnBook.display_accent` property.
  - `apps/hymns/permissions.py` — `can_publish_hymnbook(user, hb)` reusado no `HymnBookForm.clean()`.

## Verificação

```bash
# Lint + unit
uv run black . && uv run isort . && uv run ruff check .
DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest tests/unit/ -q

# E2E (server :9000 + seed)
uv run python manage.py runserver 9000 &
DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest tests/e2e/test_crud_legacy.py -v

# Manual
DJANGO_SETTINGS_MODULE=config.settings.local uv run python manage.py runserver 8000
```

1. `/hinarios/o-convite/editar/` como **staff**: card "Curadoria editorial" visível; marcar `Publicado` num hinário incompleto → banner rust; salvar com tudo válido → redireciona pro detail com flash success.
2. Mesma URL como **non-staff**: cards de curadoria ausentes; só nome/intro/owner/desc/capa.
3. `/hinos/<uuid>/editar/`: clique em chip "Valsa" preenche input; contador linhas/chars atualiza ao digitar; LETRA ocupa >50% da largura em desktop.
4. Mobile ≤ 640px (DevTools): tudo empilhado, sem overflow horizontal, ActionBar fica acessível ao rolar.
5. Comparar pixel-a-pixel com `screens/crud-forms.jsx` aberto no canvas do design.

## Trade-offs

1. **`is_published` agora tem 2 caminhos** (form + endpoint dedicado) até a limpeza da strip do detail. Aceitável por ~1 sprint.
2. **`HymnBookEditorialForm` continua existindo** redundante. Será removido no próximo PR junto com a strip.
3. **Chips de estilo dependem de dados** — em DB vazio (dev novo), `style_suggestions` vira lista vazia e a div some. OK como progressive enhancement.
4. **Sem live preview da letra** (existe no `revise_hymn` por motivo distinto). Não é regressão; sempre faltou aqui.
5. **`forms.py` fica mais "alto"** com `clean()`/`save()` custom. Trade pela centralização do gate de publicação.

## Notas operacionais

- Branch: `feature/crud-legacy-redesign`.
- PR único cobrindo backend + frontend + tests.
- Auto-merge habilitado após CI verde (per memory).
- Nada de migration, nada de URL change.
