# Plano: Header de hino "papel" + Audio Player Spotify-style (TDD)

## Contexto

Duas mudanças de design vindas do bundle Fase 2:

1. **Header de hino estilo "página do hinário em papel"** — refinamento tipográfico do
   cabeçalho `HINO N · LIVRO / Título / régua`. Hoje a régua é `w-32` (128px) com
   `border-ink/30`; o design tem `.title-rule` com **70% de largura** e cor
   `--color-rule` (paper-warm). Título oversized hoje (`text-3xl sm:text-4xl
   md:text-5xl` ≈ 30-48px) vs **28px** no design — objetivo é cantador impresso, não
   landing page.
2. **Audio player persistente Spotify-style** — spec completa em `_design/PLAYER_DESIGN.md`.
   Quatro superfícies (PlayerBar / PlayerExpanded / QueueDrawer / WorkModeOverlay),
   estado global de playback, filtro automático de hinos sem áudio, controles via
   teclado/mediaSession. Crítico: o player precisa **sobreviver à navegação**
   (Spotify-feel), o que num MPA Django exige uma escolha técnica.

**Decisões arquiteturais** (já confirmadas em diálogo):
- **Persistência**: HTMX 1.x via CDN com `hx-boost="true"`. Conteúdo num `<main>`
  boostável; player no `base.html` fora do target — áudio toca ininterruptamente.
- **Faseamento**: 3 PRs sequenciais (header, player MVP, surfaces extras).
- **Karaokê**: deferido. PlayerExpanded mostra `hymn.text` estático; modelo
  `HymnLyricLine{line,t}` + UX de timestamping fica para fase futura.
- **Workflow**: TDD por PR — vermelho → verde → refator → suíte completa.

## Arquivos do projeto que conhecemos (read-only context)

- `templates/hymns/hymn_detail.html` (linhas 26-46) — header + body + footer atual; já
  tem footer com `received_at/style/offered_to` em Tailwind, mas não com classes do
  design.
- `templates/hymns/hymnbook_detail.html` (corrido linhas 80-88, carrossel 110-117) —
  mesma estrutura de header com `font-display text-3xl` + `<hr w-24 border-rule>`.
- `apps/hymns/models.py:139-200` — `Hymn` tem `received_at`, `offered_to`, `style`,
  `extra_instructions`. Suficiente para `.hymn-meta-row`.
- `apps/hymns/models.py:282-341` — `HymnAudio` com `audio_file`, `duration`,
  `is_approved`, `waveform_peaks`. **Sem `is_primary`** — para MVP, primeira
  aprovada por `created_at`.
- `static/css/components.css` (linhas 154-162) — já tem `.hymn-page` (bg/border/radius/
  shadow). Falta a tipografia interna (`.hymn-num`, `.hymn-title`, `.title-rule`,
  `.hymn-end`, `.hymn-meta-row`).
- `static/css/design-tokens.css` — paleta, `--color-rule`, `--color-rule-soft`,
  `--shadow-1/2`, `--radius-lg` já calibrados.
- `templates/base.html` — Tailwind CDN, scripts soltos no fim do `<body>`. Aqui vai
  HTMX + `<audio>` global + markup do PlayerBar/Expanded.
- `tests/unit/test_hymnbook_modes.py` + `tests/unit/test_typography_setup.py` —
  padrões de teste: `pytest.mark.django_db` + `client.get` + `resp.content.decode()`
  + `assert "marker" in body`. Para CSS: `Path.read_text` + substring.

## Referências do design (read-only)

| Arquivo | Para quê |
|---|---|
| `_design/PLAYER_DESIGN.md` | Spec completa do player |
| `_design/fase2-bundle/project/screens/hymn-detail.jsx:29-49` | Markup paper hymn |
| `_design/fase2-bundle/project/styles/components.css:188-249` | CSS de `.hymn-page` family |

## Workflow TDD por PR

Para cada PR, ciclo estrito:

1. Escrever testes falhando que descrevem o estado-alvo
2. `pytest -k <novo>` → **vermelho**
3. Implementar mínimo para passar
4. `pytest -k <novo>` → **verde**
5. Lint + format (`black`, `isort`, `ruff`)
6. Suíte completa `pytest tests/unit/ -q` + smoke manual
7. Commit + push + PR + CI verde + squash merge → deploy automático

---

## PR 1 — Header de hino "papel" (TDD)

**Objetivo**: aproximar o header das 3 telas (hymn_detail, corrido, carrossel) ao
markup `hymn-detail.jsx:29-49`.

### Step 1.1 — Testes (vermelhos)

**`tests/unit/test_hymn_paper_header.py`** (NOVO):

```python
"""Header 'página do hinário em papel': 3 telas devem usar as mesmas classes
.hymn-num / .hymn-title / .title-rule do design (_design/fase2-bundle/.../
hymn-detail.jsx). Régua warm de 70% no lugar do <hr w-32 border-ink/30>.
"""
import pytest
from pathlib import Path
from django.urls import reverse

PROJECT_ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.django_db
class TestHymnDetailPaperHeader:
    def test_uses_paper_header_classes(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="X", is_published=True)
        h = hymn_factory(hymn_book=hb, number=7, title="Estrela Brilhante")
        resp = client.get(reverse("hymns:hymn_detail", kwargs={"pk": h.pk}))
        body = resp.content.decode()
        assert 'class="hymn-num"' in body
        assert 'class="hymn-title"' in body
        assert 'class="title-rule"' in body

    def test_does_not_use_old_hr(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="X", is_published=True)
        h = hymn_factory(hymn_book=hb, number=7)
        resp = client.get(reverse("hymns:hymn_detail", kwargs={"pk": h.pk}))
        assert 'border-ink/30' not in resp.content.decode()
        assert 'w-32 mx-auto' not in resp.content.decode()

    def test_meta_row_with_fields(self, client, hymn_book_factory, hymn_factory):
        from datetime import date
        hb = hymn_book_factory(name="X", is_published=True)
        h = hymn_factory(
            hymn_book=hb, number=1, style="Mazurca",
            received_at=date(1934, 5, 12), offered_to="N. Sra. Conceição",
        )
        resp = client.get(reverse("hymns:hymn_detail", kwargs={"pk": h.pk}))
        body = resp.content.decode()
        assert 'class="hymn-meta-row"' in body
        assert "Mazurca" in body
        assert "Conceição" in body

    def test_meta_row_omitted_when_empty(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="X", is_published=True)
        h = hymn_factory(hymn_book=hb, number=1, style="", offered_to="")
        # received_at é None por default
        resp = client.get(reverse("hymns:hymn_detail", kwargs={"pk": h.pk}))
        assert 'class="hymn-meta-row"' not in resp.content.decode()


@pytest.mark.django_db
class TestHymnbookCorridoPaperHeader:
    def test_uses_paper_header_classes(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="X", is_published=True)
        hymn_factory(hymn_book=hb, number=1)
        resp = client.get(
            reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}) + "?mode=corrido"
        )
        body = resp.content.decode()
        # Procurar dentro do pane corrido
        idx = body.find('data-mode-pane="corrido"')
        section = body[idx : idx + 8000]
        assert 'class="hymn-num"' in section
        assert 'class="hymn-title"' in section
        assert 'class="title-rule"' in section
        # Régua antiga não deve estar
        assert 'w-24 mx-auto border-rule' not in section


@pytest.mark.django_db
class TestHymnbookCarrosselPaperHeader:
    def test_uses_paper_header_classes(self, client, hymn_book_factory, hymn_factory):
        hb = hymn_book_factory(name="X", is_published=True)
        hymn_factory(hymn_book=hb, number=1)
        resp = client.get(
            reverse("hymns:hymnbook_detail", kwargs={"slug": hb.slug}) + "?mode=carrossel"
        )
        body = resp.content.decode()
        idx = body.find('data-mode-pane="carrossel"')
        section = body[idx : idx + 8000]
        assert 'class="hymn-num"' in section
        assert 'class="hymn-title"' in section
        assert 'class="title-rule"' in section


class TestComponentsCssDefinesPaperHeader:
    def test_classes_present(self):
        css = (PROJECT_ROOT / "static/css/components.css").read_text(encoding="utf-8")
        for cls in (".hymn-page .hymn-num", ".hymn-page .hymn-title",
                    ".hymn-page .title-rule", ".hymn-page .hymn-meta-row"):
            assert cls in css, f"missing CSS rule for {cls}"

    def test_title_rule_is_70pct_wide(self):
        css = (PROJECT_ROOT / "static/css/components.css").read_text(encoding="utf-8")
        idx = css.index(".hymn-page .title-rule")
        block = css[idx : idx + 300]
        assert "width: 70%" in block

    def test_hymn_title_28px(self):
        css = (PROJECT_ROOT / "static/css/components.css").read_text(encoding="utf-8")
        idx = css.index(".hymn-page .hymn-title")
        block = css[idx : idx + 400]
        assert "font-size: 28px" in block
```

### Step 1.2 — Implementação (verde)

**`static/css/components.css`** — adicionar bloco depois de `.hymn-page-deep`:

```css
.hymn-page .hymn-num {
  text-align: center;
  font-family: var(--font-mono);
  font-size: 11px; letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--color-ink-mute);
  margin: 0 0 14px;
}
.hymn-page .hymn-title {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: 28px;
  text-align: center;
  letter-spacing: 0.005em;
  color: var(--color-ink);
  margin: 0 0 6px;
  line-height: 1.15;
}
@media (min-width: 640px) { .hymn-page .hymn-title { font-size: 32px; } }
.hymn-page .title-rule {
  height: 1px; background: var(--color-rule);
  width: 70%; margin: 0 auto 28px;
  border: 0;
}
.hymn-page .hymn-end {
  text-align: center; margin-top: 28px;
  font-size: 18px; color: var(--color-gold);
  letter-spacing: 0.4em;
}
.hymn-page .hymn-meta-row {
  display: flex; justify-content: space-between; gap: 24px;
  margin-top: 24px; padding-top: 16px;
  border-top: 1px solid var(--color-rule-soft);
  font-family: var(--font-mono);
  font-size: 11px; letter-spacing: 0.1em;
  color: var(--color-ink-mute);
  text-transform: uppercase;
  flex-wrap: wrap;
}
```

**`templates/hymns/hymn_detail.html`** — substituir linhas 26-46:
- Trocar wrapper `<article class="card-soft p-5 ...">` para `<article class="hymn-page p-6 sm:p-12 md:p-14 ...">` (ou manter `card-soft hymn-page` combinado).
- Trocar `<p class="label-mono ...">` por `<div class="hymn-num">`.
- Trocar `<h1 class="font-display text-3xl ...">` por `<h1 class="hymn-title">`.
- Trocar `<hr class="w-32 ...">` por `<div class="title-rule"></div>`.
- Trocar `<footer class="mt-10 pt-6 ...">` por `<div class="hymn-meta-row">`, com mesma
  lógica condicional dos campos.
- Wrapping de body permanece (`hymn-body-centered`); ornamento `☀ ☾ ★ / ✡` permanece.

**`templates/hymns/hymnbook_detail.html`** — corrido (linhas 80-88) e carrossel
(110-117): substituir os 3 elementos do header pelo trio `.hymn-num` / `.hymn-title` /
`.title-rule`. Manter `<h2>` (não `<h1>`) por semântica, mas a classe `.hymn-title`
funciona em qualquer tag.

### Step 1.3 — Refator + lint

```bash
poetry run black tests/unit/test_hymn_paper_header.py
poetry run isort tests/unit/test_hymn_paper_header.py
poetry run ruff check static/css templates tests
```

### Step 1.4 — Suíte

```bash
DJANGO_SETTINGS_MODULE=config.settings.test poetry run pytest tests/unit/ -q
poetry run python manage.py runserver
# manual smoke nas 3 telas
```

### Step 1.5 — Commit + PR

Branch `feature/hymn-paper-header`, PR squash → CI verde → merge → deploy auto.

---

## PR 2 — Player MVP (TDD)

**Objetivo**: PlayerBar persistente via HTMX boost + PlayerExpanded estático
(sem karaokê) + endpoint de queue + botão "Tocar hinário" no header do hinário.

### Step 2.1 — Testes (vermelhos)

**`tests/unit/test_player_endpoint.py`** (NOVO):

```python
@pytest.mark.django_db
class TestHymnbookQueueEndpoint:
    def test_returns_200_for_published_book(...): ...
    def test_returns_404_for_unpublished_anonymous(...): ...
    def test_filters_only_approved_audios(...): ...
    def test_queue_ordered_by_number(...): ...
    def test_response_shape(...):  # {book: {slug,name,owner}, queue: [{n,title,hasAudio,audioUrl,duration,style}]}
```

**`tests/unit/test_player_global_widget.py`** (NOVO):

```python
class TestBaseHasHtmxAndPlayer:
    def test_base_loads_htmx(self):
        # base.html includes script tag for htmx CDN
    def test_base_uses_hx_boost(self):
        # body has hx-boost="true"
    def test_main_has_hx_target(self):
        # <main id="page-main" hx-target="#page-main" hx-select="#page-main">
    def test_base_includes_player_partial(self):
        # base.html includes "hymns/_player_global.html"

class TestPlayerGlobalPartial:
    def test_has_audio_element(self): ...
    def test_has_player_bar_with_three_columns(self): ...
    def test_has_expanded_overlay(self): ...
    def test_has_play_pause_prev_next_buttons(self): ...
    def test_has_progress_input_range(self): ...
```

**`tests/unit/test_hymnbook_play_button.py`** (NOVO):

```python
@pytest.mark.django_db
class TestHymnbookHeaderPlayButton:
    def test_play_button_present_when_book_has_audio(...): ...
    def test_play_button_disabled_when_no_audio(...): ...
    def test_play_button_carries_slug_data_attr(...): ...
```

**`tests/unit/test_player_static_assets.py`** (NOVO):

```python
class TestPlayerJsExists:
    def test_player_js_file_present(self): ...
    def test_player_js_initializes_state(self): ...     # contém "localStorage" + "queue"
    def test_player_js_handles_play_pause(self): ...    # contém "audio.play()" / "audio.pause()"

class TestPlayerCssExists:
    def test_player_css_file_present(self): ...
    def test_player_bar_dark_chrome(self): ...           # contém "rgba(20, 18, 26"
```

### Step 2.2 — Implementação (verde)

Ordem:

1. **`apps/hymns/views.py`** + **`apps/hymns/urls.py`** — view
   `hymnbook_queue_json(slug)` e rota `/api/hinarios/<slug>/queue/`. Usa
   `HymnBook.objects.visible_to(request.user)`, prefetch `audios`, devolve JSON.
2. **`templates/base.html`** — adicionar `<script src="https://unpkg.com/htmx.org@1.9.12" defer></script>` no `<head>`. Adicionar `hx-boost="true"` no `<body>`. Envolver
   `{% block content %}` em `<main id="page-main" hx-target="#page-main" hx-select="#page-main" hx-swap="outerHTML">`. Antes de `</body>`, incluir
   `{% include "hymns/_player_global.html" %}`.
3. **`templates/hymns/_player_global.html`** (NOVO) — markup do PlayerBar (76px,
   3 colunas) + PlayerExpanded (overlay full-screen) + `<audio>` element.
   Hidden por default; JS controla visibilidade.
4. **`static/css/player.css`** (NOVO) — chrome escuro (`rgba(20,18,26,0.96)` +
   blur), capa gradient firmament→gold, play branco 40px, controles secundários sem
   fundo, expanded gradient `#1a1620 → #14121a`. Lincado em `base.html` antes do
   close de `</head>`.
5. **`static/js/player.js`** (NOVO) — IIFE com state + localStorage persist + DOM
   handlers (play/pause/prev/next/expand/collapse/seek) + hookup com
   `<audio>`. Iniciado com `playing:false` (autoplay policy).
6. **`templates/hymns/hymnbook_detail.html`** — adicionar botão "Tocar hinário" no
   header com `data-player-start="{{ slug }}"`, atributo `disabled` se 0 áudios.
7. **`templates/hymns/hymnbook_detail.html`** modo índice — em cada linha do
   ol/li, adicionar ícone ▶ (clicável) ou ⊘ (sem áudio) à esquerda.

### Step 2.3 — Suíte + e2e

`tests/e2e/test_player_persistence.py` — Playwright:
- Click "Tocar hinário" → bar visível
- Navegar para `/` → bar persiste, `<audio>` continua
- Click expand → expanded overlay abre
- Refresh → bar reaparece com mesmo hino, pausada

---

## PR 3 — Surfaces (TDD)

QueueDrawer + WorkModeOverlay + Sleep timer + MediaSession. Plano detalhado depois
do PR 2 mesclado.

---

## Sequência de execução

1. **PR 1 (header)**: branch `feature/hymn-paper-header` → CI verde → merge → deploy.
2. **PR 2 (player MVP)**: branch `feature/player-mvp` → CI verde → merge → deploy →
   smoke prod.
3. **PR 3 (surfaces)**: planejar separadamente após PR 2 em produção.

## Fora de escopo (intencional)

- **Karaokê com timestamps** — fase própria.
- **`HymnAudio.is_primary`** — para MVP, primeira aprovada por `created_at`.
- **Migrar `_audio_player.html` inline para usar o player global** — inline fica
  como "preview rápido" na página individual; player global é separado.
- **Equalizador / velocidade / download offline / fila editável / histórico** —
  fora da spec atual (PLAYER_DESIGN.md §8).
