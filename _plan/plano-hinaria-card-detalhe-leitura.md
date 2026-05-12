# Plano: refactor do card de hinário, simplificação da tela de detalhe e nova tela de leitura sincronizada

## Contexto

Três blocos de mudança UX no `hinaria.com.br`:

1. **Card de hinário pouco descritivo** — quando há `cover_image` (que na prática é foto do dono, não capa), só aparece a imagem; nome e dono somem. Sem foto, aparece "EST. 2026" que não acrescenta valor. Em mobile, o `aspect-[3/4]` em 1 coluna ocupa quase toda a tela — só cabe 1 card por vez.
2. **Tela de detalhe do hinário pesada** — header redundante ("Hinário publicado") e barra "Modo de leitura: Índice / Corrido / Carrossel" exposta ao usuário, sendo que o "índice" não é um modo de leitura (não se lê hinos lá, só títulos). Os dois modos reais — corrido e carrossel — merecem uma tela própria, mais imersiva e sem o cabeçalho/hero do hinário.
3. **Player de áudio dessincronizado da leitura** — usuário toca o hino 5, clica em "Abrir hinário" e a tela abre no hino 1. Quando o player avança para o próximo, a tela não acompanha. Faltam pontes entre os estados de "ouvir" e "ler".

Outcome esperado:
- Card editorial: avatar circular do dono à esquerda + nome do hinário e dono à direita, igual com e sem foto. Sem "Est. 2026". Em mobile, layout horizontal compacto (lista densa).
- Detalhe do hinário enxuto: hero + stats + 2 botões "Tocar hinário" / "Abrir hinário" + sumário (ex-modo "índice"). Sem barra de modo, sem badge "Publicado".
- Nova rota `/hinarios/<slug>/ler/?modo=corrido|carrossel` com breadcrumb mínimo, toggle discreto corrido/carrossel, panes reaproveitados.
- Tela de leitura sincronizada com o player: deep-link via `?hino=N`, abertura automática no hino que está tocando, scroll/snap automático quando o player avança, e isolamento entre hinários distintos.

---

## Decisões de design alinhadas

| Decisão | Escolha confirmada |
|---|---|
| Card com imagem | **Foto pequena lateral (avatar)** — mesmo layout com/sem foto. Sem "EST. {year}". |
| Card mobile | **Horizontal compacto** (foto 80–96px à esquerda + texto à direita, largura total). |
| Hierarquia botões | **"Tocar" = primário gold sólido** (como hoje); **"Abrir hinário" = outline gold** ao lado. |
| Toggle corrido/carrossel | 2 anchors discretos com underline no ativo (não pílulas com caixa). |
| Breadcrumb da `/ler/` | Estático no topo (não sticky), `font-sans text-sm` com seta `←`. |
| Tratamento de share links `?mode=corrido\|carrossel` | Redirect 302 da rota de detalhe para `/ler/?modo=...`. `?mode=indice` vira no-op. |

---

## Mudanças por arquivo

### 1. Card de hinário — `templates/_partials/_hymnbook_card.html`

Estrutura única para os dois estados (com/sem foto). Layout horizontal em mobile, vertical em `sm+`:

- Container `<a>` mantém `display_accent` como gradient de fundo.
- Em mobile (`<sm`): `flex` horizontal — avatar à esquerda (96×96, `rounded-full`), texto à direita ocupando o resto, alinhado verticalmente.
- Em desktop (`sm+`): empilhado vertical — avatar pequeno (80×80) no topo + nome do hinário grande embaixo + dono.
- **Sem foto**: avatar vira círculo com a letra inicial do hinário em `font-display` cream/20 (mesma estética do placeholder atual, porém em formato circular pequeno).
- **Com foto**: `<img src="{{ hb.cover_image.url }}" class="rounded-full object-cover">` no avatar.
- Remover `EST. {{ hb.created_at|date:"Y" }}` em ambos os ramos.
- Manter badge `RASCUNHO` quando `not hb.is_published`, posicionado no canto.

Tipografia: `font-display text-xl sm:text-2xl` para o nome do hinário; `label-mono text-cream/80` para o nome do dono.

### 2. String do footer — `templates/_partials/_footer.html:4`

Troca direta: `"Hinários para ler, ouvir, cantar e guardar com firmeza."` → `"Hinários para ouvir, estudar e cantar com firmeza."`

### 3. Detalhe do hinário — `templates/hymns/hymnbook_detail.html`

Remoções:
- Linha 23: `<p class="label-mono">Hinário publicado/rascunho</p>`.
- Linhas 33–37: span "● Publicado / ● Rascunho".
- Linhas 58–81: `<section>` inteira "Modo de leitura" com os 3 toggles.
- Linhas 119–173: panes `data-mode-pane="corrido"` e `data-mode-pane="carrossel"`. Estes migram para a nova tela `/ler/`.
- Atributo `{% if mode != 'indice' %} hidden{% endif %}` do pane `indice` — vira sempre visível, pode remover o `data-mode-pane="indice"` também (não há mais alternância).

Adição:
- Botão `"Abrir hinário"` ao lado de `"Tocar hinário"` (depois do `</button>` da linha 45). Outline gold:
  ```
  <a href="{% url 'hymns:hymnbook_read' hymnbook.slug %}"
     class="inline-flex items-center gap-2 rounded-full border border-gold-soft text-gold-soft hover:bg-gold-soft hover:text-night px-4 py-1.5 text-sm font-medium transition">
    <svg ...book icon.../> Abrir hinário
  </a>
  ```
  Ícone livro aberto (SVG ~14px, mesmo padrão do triângulo play).

### 4. Nova tela de leitura — `templates/hymns/hymnbook_read.html` (criar)

Estrutura mínima:
```
{% extends 'base.html' %}
{% block content %}
<section class="max-w-3xl mx-auto px-4 sm:px-6 py-4"
         data-reading-page
         data-book-slug="{{ hymnbook.slug }}"
         data-initial-hymn="{{ initial_hymn }}">
  <a href="{% url 'hymns:hymnbook_detail' hymnbook.slug %}"
     class="inline-flex items-center gap-2 text-sm hover:text-rust">
    <svg .../> {{ hymnbook.name }}
  </a>
  <nav class="mt-3 flex gap-6 label-mono" role="tablist">
    <a href="?modo=corrido"   class="reading-toggle{% if modo == 'corrido' %} reading-toggle--active{% endif %}">Corrido</a>
    <a href="?modo=carrossel" class="reading-toggle{% if modo == 'carrossel' %} reading-toggle--active{% endif %}">Carrossel</a>
  </nav>
</section>

{% if modo == 'corrido' %}
  {# pane corrido — copy literal das linhas 119-131 do detail atual #}
{% else %}
  {# pane carrossel — copy literal das linhas 133-173 do detail atual #}
{% endif %}
{% endblock %}
```

Atributos `data-reading-page`, `data-book-slug`, `data-initial-hymn` viram a API para o JS de sincronização.

### 5. View nova — `apps/hymns/views.py`

Adicionar `HymnBookReadView` reaproveitando o queryset/visibility:
```python
class HymnBookReadView(DetailView):
    model = HymnBook
    template_name = "hymns/hymnbook_read.html"
    context_object_name = "hymnbook"
    slug_field = "slug"
    slug_url_kwarg = "slug"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        hymns = list(self.object.hymns.all().prefetch_related("audios").order_by("number"))
        hymns_with_audio = {h.number for h in hymns if any(a.is_approved for a in h.audios.all())}
        modo = self.request.GET.get("modo", "corrido")
        if modo not in {"corrido", "carrossel"}:
            modo = "corrido"
        # ?hino=N tem prioridade; senão JS decide via localStorage.
        try:
            initial_hymn = int(self.request.GET.get("hino", "")) or None
        except ValueError:
            initial_hymn = None
        context.update({
            "hymns": hymns,
            "hymns_with_audio": hymns_with_audio,
            "audios_count": len(hymns_with_audio),
            "modo": modo,
            "initial_hymn": initial_hymn or "",
        })
        return context
```

Ajuste no `HymnBookDetailView.get_context_data`:
- Manter parse do `mode`, mas se `mode in {"corrido", "carrossel"}` retornar `HttpResponseRedirect` (302) para `hymnbook_read` com `?modo=<mode>`. Implementar via override de `get()` (DetailView pattern).
- `?mode=indice` ou ausente → render normal sem `mode` no contexto (template já não usa).

### 6. URL pattern — `apps/hymns/urls.py`

Inserir **antes** da linha 52 (catch-all `<slug:slug>/`):
```python
path("hinarios/<slug:slug>/ler/", views.HymnBookReadView.as_view(), name="hymnbook_read"),
```

### 7. CSS — `static/css/components.css`

Adicionar:
```css
.reading-toggle {
  color: var(--color-ink-soft);
  padding-bottom: 4px;
  border-bottom: 2px solid transparent;
  transition: color 120ms, border-color 120ms;
}
.reading-toggle:hover { color: var(--color-ink); }
.reading-toggle--active {
  color: var(--color-ink);
  border-bottom-color: var(--color-rust);
}
```

Classes `.mode-toggle-*` antigas podem ficar (sem uso) ou ser removidas — recomendo deixar e marcar como deprecated em comentário no arquivo.

### 8. JS — sincronização player ↔ leitura

**`static/js/player.js`** — adicionar dispatch de evento quando muda track:
- Localizar onde `state.currentIdx` muda (próximo/anterior, ended → next). Após cada mudança, antes/depois do `render()`:
  ```js
  window.dispatchEvent(new CustomEvent('hinaria-player:track', {
    detail: { slug: state.book && state.book.slug, n: t && t.n }
  }));
  ```
- Manter o evento idempotente (não disparar se slug+n não mudou).

**`static/js/hymn-carousel.js:136`** — comportamento do Esc no carrossel da `/ler/`:
- Trocar `window.location.search = '?mode=indice'` por: ler `data-book-slug` do `[data-reading-page]` e fazer `window.location.href = '/hinarios/' + slug + '/'`. Fallback: `window.history.back()` se o elemento não existir.

**Novo arquivo `static/js/hymn-read-sync.js`** (ou bloco no fim do template) — só roda na `/ler/`:
```js
(function () {
  const page = document.querySelector('[data-reading-page]');
  if (!page) return;
  const slug = page.dataset.bookSlug;
  const initial = parseInt(page.dataset.initialHymn, 10) || null;

  function readPlayerState() {
    try { return JSON.parse(localStorage.getItem('hinaria-player') || '{}'); }
    catch (e) { return {}; }
  }
  function targetHymnNumber() {
    // Prioridade: ?hino=N > player tocando ESTE hinário > hino 1
    if (initial) return initial;
    const ps = readPlayerState();
    if (ps && ps.book && ps.book.slug === slug && ps.queue && ps.queue[ps.currentIdx]) {
      return ps.queue[ps.currentIdx].n;
    }
    return null;
  }
  function scrollToHymn(n, smooth) {
    if (!n) return;
    const carousel = document.querySelector('[data-carousel]');
    if (carousel) {
      const slide = document.getElementById('hymn-slide-' + n);
      if (slide) {
        const idx = Array.from(carousel.children).indexOf(slide);
        if (idx >= 0) carousel.scrollTo({ left: idx * carousel.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
      }
    } else {
      const anchor = document.getElementById('hymn-' + n);
      if (anchor) anchor.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    }
  }

  // Carga inicial (sem smooth, evitar animação no load).
  window.addEventListener('load', function () { scrollToHymn(targetHymnNumber(), false); });

  // Sincronia em runtime quando o player avança.
  window.addEventListener('hinaria-player:track', function (ev) {
    if (!ev.detail || ev.detail.slug !== slug) return;
    scrollToHymn(ev.detail.n, true);
  });
})();
```

Incluir esse JS em `hymnbook_read.html` (via `{% block extra_js %}` ou `<script src="{% static 'js/hymn-read-sync.js' %}">`).

### 9. Detalhe do hino — `templates/hymns/hymn_detail.html`

Substituir o bloco `<section class="card-soft p-5">…Modo de leitura…</section>` (linhas 105–112) por um único botão:
```
<section class="card-soft p-5">
  <a href="{% url 'hymns:hymnbook_read' hymn.hymn_book.slug %}?hino={{ hymn.number }}"
     class="block text-center py-2.5 rounded-full bg-firmament text-cream hover:bg-firmament-2 text-sm font-medium">
    📖 Abrir no hinário
  </a>
</section>
```
(Ícone via SVG inline em vez de emoji; mesmo padrão do `book icon` do botão "Abrir hinário" no detail.)

---

## Fluxos sincronizados (validação)

| Cenário | Comportamento esperado |
|---|---|
| User dá play no hino 5 no detail → clica "Abrir hinário" | `/ler/` abre, JS lê localStorage, scroll para `#hymn-5` (corrido) ou snap pro slide 5 (carrossel). |
| Player avança 5 → 6 enquanto `/ler/` aberta | `hinaria-player:track` dispara, JS faz scroll smooth para `#hymn-6`. |
| User tocando hinário X, navega para hinário Y, abre `/ler/` de Y | `localStorage.book.slug !== Y.slug`, scroll fica em hino 1. |
| User clica "Abrir no hinário" na tela do hino 12 | `/ler/?hino=12` — `initial_hymn=12` no contexto, JS prioriza `?hino` sobre localStorage. |
| User com `/ler/?modo=carrossel` aperta Esc | Volta para `/hinarios/<slug>/` (detail) via `data-book-slug`. |
| Share link antigo `/hinarios/x/?mode=corrido` | Redirect 302 para `/hinarios/x/ler/?modo=corrido`. |

---

## Arquivos a editar/criar

**Editar:**
- `/Users/nitai/dev/hyms-platform/hymns-plat/templates/_partials/_hymnbook_card.html`
- `/Users/nitai/dev/hyms-platform/hymns-plat/templates/_partials/_footer.html`
- `/Users/nitai/dev/hyms-platform/hymns-plat/templates/hymns/hymnbook_detail.html`
- `/Users/nitai/dev/hyms-platform/hymns-plat/templates/hymns/hymn_detail.html`
- `/Users/nitai/dev/hyms-platform/hymns-plat/apps/hymns/views.py` (`HymnBookDetailView.get()` para redirect + nova `HymnBookReadView`)
- `/Users/nitai/dev/hyms-platform/hymns-plat/apps/hymns/urls.py` (rota `hymnbook_read`)
- `/Users/nitai/dev/hyms-platform/hymns-plat/static/css/components.css` (`.reading-toggle`)
- `/Users/nitai/dev/hyms-platform/hymns-plat/static/js/hymn-carousel.js:136` (Esc volta para detail)
- `/Users/nitai/dev/hyms-platform/hymns-plat/static/js/player.js` (dispatch `hinaria-player:track`)

**Criar:**
- `/Users/nitai/dev/hyms-platform/hymns-plat/templates/hymns/hymnbook_read.html`
- `/Users/nitai/dev/hyms-platform/hymns-plat/static/js/hymn-read-sync.js`

---

## Testes que precisam atenção

Inevitáveis ajustes (referenciar como TODO no PR):

- `tests/unit/test_hymnbook_modes.py` — todos os testes que casam `?mode=corrido|carrossel` no detail viram redirect 302; reescrever para `/ler/?modo=...` ou para a tela nova.
- `tests/unit/test_mode_bar_design.py` — obsoleto (barra removida do detail). Substituir por `test_reading_toggle_design.py` validando `.reading-toggle` na `/ler/`.
- `tests/unit/test_typography_setup.py:102-106` — `test_carousel_hymn_title_uses_display_face` conta `font-display` em `hymnbook_detail.html`. Após remover panes corrido/carrossel, contagem cai. Adicionar asserção paralela em `hymnbook_read.html` e relaxar o threshold do detail.
- `tests/unit/test_cover_image_rendering.py` — manter alt `Capa de {nome}` no `<img>` do novo card para não quebrar `test_card_renders_img_when_cover_set`.
- `tests/unit/test_hymnbook_play_button.py` — segue válido; só garantir que "Abrir hinário" não conflite no selector.
- `tests/e2e/test_navigation.py` — selectors são genéricos, não devem quebrar; smoke valida.

---

## Verificação manual

```bash
DJANGO_SETTINGS_MODULE=config.settings.local uv run python manage.py runserver
```

1. `/` — footer com nova string; cards "Em destaque" no novo formato (avatar + texto).
2. `/hinarios/` — desktop: cards verticais com avatar pequeno. Resize <640px: lista horizontal densa.
3. `/hinarios/a-alvorada/` — sem header "Hinário publicado", sem badge, sem barra de modo. Dois botões: "Tocar hinário" (gold sólido) + "Abrir hinário" (gold outline). Sumário (ex-índice) abaixo.
4. `/hinarios/a-alvorada/ler/` — breadcrumb topo, toggle Corrido/Carrossel, modo corrido default.
5. `/hinarios/a-alvorada/ler/?modo=carrossel` — carrossel; Esc volta para `/a-alvorada/`.
6. `/hinarios/a-alvorada/?mode=corrido` — redirect 302 → `/a-alvorada/ler/?modo=corrido`.
7. `/hinos/<uuid>/` (qualquer hino) — sem bloco "Modo de leitura", botão "Abrir no hinário" no aside.
8. **Sincronia player ↔ leitura**:
   - Tocar hino 5 em `/hinarios/a-alvorada/`, clicar "Abrir hinário" → leitura abre com scroll em #hymn-5.
   - Aguardar áudio terminar e player ir pro 6 → tela faz scroll smooth para #hymn-6.
   - Em outra aba, tocar hinário X; navegar para `/hinarios/Y/ler/` → abre no hino 1 de Y.
   - Em `/hinos/<uuid-do-hino-12>/`, clicar "Abrir no hinário" → `/ler/?hino=12` abre no hino 12.

---

## Trade-offs aceitos

1. **Esc no carrossel sempre volta para detail** (não `history.back()`) — comportamento previsível independente do referrer; share links com `?modo=carrossel` voltam para o detail, não saem do site.
2. **Redirect 302** (não 301) dos `?mode=` legados — reversível. Pode-se promover para 301 depois.
3. **Scroll sync na carga é não-smooth** — evita animação inicial chamativa; só transições durante reprodução usam smooth.
4. **`hymnbook_read.html` duplica markup do corrido/carrossel** — escolha de simplicidade sobre DRY. Os blocos são grandes mas isolados; cogitar `{% include %}` para os panes se a duplicação incomodar depois.
5. **Mobile horizontal usa avatar quadrado/circular sem aspect ratio das fotos originais** — fotos retangulares serão cropadas; aceitável para densidade da lista.

---

## Notas operacionais

- Após aprovação deste plano, copiar para o repo em `_plan/plano-hinaria-card-detalhe-leitura.md` (padrão do projeto, ref CLAUDE.md "Plans live in `_plan/`").
- Mudanças não tocam em settings, deploy, migrações, ou pipeline OCR/audio — escopo puramente frontend + view/url.
