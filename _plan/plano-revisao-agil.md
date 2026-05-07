# Plano: Revisão ágil + ajustes no fluxo editorial (Fase 2)

## Contexto

O Claude Design v2 deste handoff (`https://api.anthropic.com/v1/design/h/9aIjUZw2OnGEuwPzqe18Qg`, transcrições em `_design/fase2-bundle/chats/chat2.md` quando reimportado) introduz mudanças no fluxo editorial:

1. **Tela nova `07c · Revisão ágil · Estilo & Repetições`** — versão simplificada da tela "Revisar Hino" focada apenas nos **dois parâmetros objetivos**: `style` e `repetitions`. Tem prévia do hino à esquerda (com barrinhas de repetição vivas), 3 tiles grandes para Estilo (**Marcha · Valsa · Mazurca**), 4 tiles grandes para Repetições (cada um com mini-diagrama SVG das barras + atalho de teclado), input manual abaixo dos presets, hint *"Esta tela não conclui a revisão"* e 3 botões de navegação (Anterior · Próximo · **Salvar e ir para o próximo**). Atalhos: `M`/`V`/`Z`, `1`/`2`/`3`/`4`, `←`/`→`, `⏎`. Importante: **não toca em `review_status`** — a marcação como revisado ainda exige a revisão completa.

2. **Botões "⚡ Revisão ágil"** em duas telas existentes apontando para a nova tela:
   - `06 · Fila de Revisão` (`/editor/hinarios/`) — um botão por linha de hinário.
   - `07b · Hinário em revisão` (`/editor/hinarios/<slug>/`) — um botão no header (lado direito do "Revisar próximo →").

3. **Linha-toda-clicável na fila** (`/editor/hinarios/`) — hoje cada `<li>` da lista não é clicável; envolver no link para `editor_hymnbook_detail` e parar a propagação no botão "Revisar próximo →"/"Publicar hinário". Hover sutil de affordance.

4. **Renderização correta de barras de repetição sobrepostas** — quando `reps` tem ranges que se sobrepõem (ex.: `1-2,3-4,1-4` ou `3-4,1-4`), as barras devem aparecer em **colunas separadas, com a coluna externa (range mais longo) à ESQUERDA**. Hoje o renderizador (em `static/js/editor-preview.js` e templates de hino — corrido/carrossel/hymn_detail) empilha tudo na mesma coluna, com sobreposição visual. Algoritmo: greedy column-packing por overlap; renderiza com `colFromRight = (totalCols - 1) - col`.

Resultado intencional: revisar `style`+`repetitions` de um hinário inteiro vira um **fluxo de teclado**, dramaticamente mais rápido que abrir a tela de revisão completa hino-a-hino, sem alterar o estado de "revisado completo".

## Arquivos a modificar/criar

### Backend (Django)

| Arquivo | Mudança |
|---|---|
| `apps/hymns/urls.py` | Nova URL: `path("editor/hinarios/<slug:slug>/agil/", editor_quick_review, name="editor_quick_review")`. Aceita `?h=<int:number>` opcional (default = primeiro hino do hinário). |
| `apps/hymns/editor_views.py` | Nova view `editor_quick_review(request, slug)`. GET: monta lista ordenada de hinos do hinário, usa `?h=` para selecionar o atual (default 1), serializa `style`/`repetitions` correntes, calcula `prev_url`/`next_url` (mesma URL com `?h=N±1`). POST: `QuickReviewForm` valida + `form.save()` (signal de `HymnRevision` em `apps/hymns/signals.py` cria audit trail automaticamente). Redireciona para `?h=<próximo>` ou volta a `editor_hymnbook_detail` se for o último. **Nunca seta `review_status` nem `last_reviewed_*`.** Reaproveita `_has_editor_access(request)` e `_editor_visible_books(user)` para gating de permissão. |
| `apps/hymns/forms.py` | Nova `QuickReviewForm(forms.ModelForm)` com `Meta.fields = ["style", "repetitions"]` — restrição na própria form garante que nenhum outro campo seja modificável (defesa-em-profundidade contra POST inflado). Widgets: `TextInput` simples (UI dos tiles é client-side, escrevem no input). |

### Templates

| Arquivo | Mudança |
|---|---|
| `templates/hymns/editor/quick_review.html` | **Novo**. Topbar slim (← Hinário · "Revisão ágil · Estilo & Repetições" · "06 DE 16" · link "Ir para revisão completa →" pra `editor_revise_hymn`). Strip de progresso. Grid 2 colunas: esquerda = preview do hino via `{% include "hymns/_hymn_body_centered.html" %}` (criar/extrair partial se ainda não existir); direita = section "Estilo" com 3 tiles + section "Repetições" com 4 tiles (cada com mini-SVG das barras) + input manual. Footer com 3 botões: Anterior · Próximo · "Salvar e ir para o próximo". Markup dos tiles em pares `data-style="Marcha"` / `data-reps="1-2,3-4"` + `data-shortcut="M"` para o JS pegar. Form único POSTa via botão primário; Anterior/Próximo são `<a>` com `?h=...` (não submetem o form, perdem alterações pendentes — comportamento confirmado pelo design). Hint visível: *"Esta tela não conclui a revisão. Para marcar o hino como revisado, passe pela revisão completa (texto + áudio)."* |
| `templates/hymns/editor/hymnbook_list.html` | (a) Envolver cada `<li class="card-soft ...">` em `<a href="{% url 'hymns:editor_hymnbook_detail' hb.slug %}" class="card-soft ... block">` (ou converter o `<li>` num `<a>` com display flex). Botões internos ("Revisar próximo", "Publicar") ganham `onclick="event.stopPropagation()"` e seu `<form>` aninhado já bloqueia naturalmente. (b) Adicionar botão "⚡ Revisão ágil" entre "Revisar próximo" e o fim da linha, linkando para `{% url 'hymns:editor_quick_review' hb.slug %}`. Estilo: `border border-gold text-gold rounded-full px-3 py-1.5 text-xs font-mono uppercase tracking-widest`. |
| `templates/hymns/editor/hymnbook_detail.html` | No header, após o botão "Revisar próximo →", adicionar segundo botão `<a href="{% url 'hymns:editor_quick_review' hymnbook.slug %}" class="border border-gold text-gold rounded-full px-5 py-2.5 text-sm">⚡ Revisão ágil · Estilo & Repetições</a>`. |

### Static (CSS/JS)

| Arquivo | Mudança |
|---|---|
| `static/js/quick-review.js` | **Novo**. (1) Atalhos globais `keydown`: `M`/`V`/`Z` setam `style` (atualizam input + tile ativo + flash 350ms). `1`/`2`/`3`/`4` setam `repetitions` (idem). `←`/`→` clicam botões Anterior/Próximo. `⏎` submete form. (2) **Pausa atalhos** quando `document.activeElement === document.querySelector('input[name="repetitions"]')` (evita roubar dígitos quando user digita manualmente). (3) Ao trocar `repetitions` (via tile, atalho ou input), re-renderiza barrinhas no preview à esquerda chamando `window.renderRepetitionBars(...)`. (4) Só registra listener se `[data-quick-review]` existir no DOM. |
| `static/js/repetition-bars.js` | **Novo** (extração compartilhada). Função `window.renderRepetitionBars(container, reps, opts)`: lê `data-line-count` do container, parseia `reps` em `[{start, end}]`, faz **column-packing greedy** (cada range vai pra 1ª coluna sem overlap), renderiza `<div class="repetition-bar">` por range com `style="left: {COL_GAP * colFromRight}px; top: {(start-1)*lineH+offset}px; height: {(end-start+1)*lineH-offset*2}px"`. **`colFromRight = (totalCols-1) - col`** ⇒ coluna externa (range mais longo) fica à ESQUERDA. |
| `static/js/editor-preview.js` | Substituir o renderizador atual de barras pela chamada a `renderRepetitionBars(...)`. Passa a tratar overlapping corretamente na prévia da tela `revise_hymn`. |
| Templates/JS de leitura pública (carrossel · corrido · hymn_detail) | Atualizar JS de runtime que pinta barras (provavelmente em `static/js/hymn-carousel.js` ou inline em `hymnbook_detail.html`/`hymn_detail.html`) para usar `renderRepetitionBars(...)` — mesmo algoritmo, mesma fonte de verdade. |
| `static/css/components.css` | Adicionar `.quick-tile` (botão padding 14×16, radius 10, `[data-active="true"]` flip pra `bg-ink text-paper`), `.quick-tile-flash` (transform scale 0.97 350ms), `.kbd-mark` (mono 10px badge no canto superior direito do tile). Manter no estilo de `.btn-pill` já existente. |

### Tests (TDD)

| Arquivo | Cobertura |
|---|---|
| `tests/unit/test_editor_quick_review.py` | **Novo**. (a) GET `/editor/hinarios/<slug>/agil/` → 200, contexto tem `current_hymn`, `prev_hymn`, `next_hymn`, `position`, `total`. (b) GET com `?h=N` seleciona o hino certo. (c) POST com `style="Valsa"` e `repetitions="1-4"` atualiza só esses campos; `review_status`/`last_reviewed_at`/`last_reviewed_by` permanecem inalterados. (d) POST cria `HymnRevision` com `field_diff` contendo só `style`/`repetitions` (signal já existente). (e) POST redireciona para `?h=<próximo>`; no último hino redireciona para `editor_hymnbook_detail`. (f) Não-editor (anônimo ou usuário comum) → 403/redirect (mesmo gating das outras views editoriais). (g) Hinário inexistente → 404. Hinário sem hinos → empty state ou 404 (decidir na implementação). (h) POST tentando alterar `text` ou `review_status` no payload → form ignora (não está em `Meta.fields`); banco mantém valores antigos. |
| `tests/unit/test_editor_navigation.py` | **Novo**. (a) `editor_hymnbook_detail` template renderiza link "⚡ Revisão ágil" com URL correta. (b) `editor_hymnbook_list` template envolve cada item num link para `editor_hymnbook_detail`. (c) Botão "⚡ Revisão ágil" aparece em cada linha da fila. |
| `tests/e2e/test_quick_review.py` | **Novo** (Playwright). Cenários: (a) Atalho `V` muda tile ativo de Estilo. (b) Atalho `2` muda tile ativo de Repetições. (c) `→` navega para o próximo sem salvar (style do hino atual permanece como estava no banco). (d) Botão primário POSTa, banco atualizado, redireciona pro próximo. (e) Atalhos pausam quando input manual de repetições tem foco. (f) Mini-diagrama SVG/divs de `1-2,3-4,1-4` renderiza 2 colunas com `1-4` à ESQUERDA (assertion via `getBoundingClientRect`). |
| `tests/e2e/test_repetition_bars_overlap.py` | **Novo**. Abre `/hinarios/<slug>/?mode=carrossel` em hino com `repetitions="3-4,1-4"`. Assert: 2 elementos `.repetition-bar`; o que cobre 4 linhas tem `left` menor (mais à esquerda) que o que cobre 2 linhas. Mesmo teste para `?mode=corrido` e página `hymn_detail`. Garante que a regra "outer column to LEFT" foi aplicada em todas as superfícies. |

### Documentação

| Arquivo | Mudança |
|---|---|
| `_plan/plano-revisao-agil.md` | **Novo**. Cópia desta seção do plano para ficar versionada no repo (consistência com `plano-fluxo-editorial.md`). |
| `_design/fase2-bundle/` | Reimportar do bundle exportado em `/tmp/design-fase2/hymns-platform/` (chats/, project/screens/quick-review.jsx, etc) ANTES de iniciar a implementação — convenção do CLAUDE.md de manter design rastreável. |

## Ordem TDD

1. **Reimport do bundle** — copiar `/tmp/design-fase2/hymns-platform/{chats,project}` para `_design/fase2-bundle/` (substitui o que estiver lá hoje). Commit isolado pra deixar a evolução do design rastreável. Salvar também `_plan/plano-revisao-agil.md`.

2. **`renderRepetitionBars` + correção visual** (RED → GREEN). Esse é o building block compartilhado.
   - RED: `tests/e2e/test_repetition_bars_overlap.py` cobrindo carrossel/corrido/hymn_detail (3 telas existentes).
   - GREEN: extrair `renderRepetitionBars` para `static/js/repetition-bars.js`; substituir uso em `editor-preview.js` e nos templates de leitura pública. Remove duplicação do algoritmo.
   - Commit + PR + auto-merge.

3. **View + URL + Form do quick review** (RED → GREEN).
   - RED: `tests/unit/test_editor_quick_review.py` (a)-(h).
   - GREEN: `editor_quick_review` view + URL + `QuickReviewForm`. Criar template stub mínimo só pra GET retornar 200.
   - Commit (sem PR ainda — depende do template/JS).

4. **Template `quick_review.html`** (GREEN). Markup completo, inclui partial de preview e tiles.

5. **CSS/JS** (`quick-review.js` + `quick-tile`/`kbd-mark` em `components.css`) — atalhos, flash, sincronização de barrinhas com `renderRepetitionBars`.

6. **E2E quick review** (RED → GREEN).
   - RED: `tests/e2e/test_quick_review.py` (a)-(f).
   - GREEN: integração final do JS + template até passar.
   - Commit + PR + auto-merge.

7. **Botões "⚡ Revisão ágil"** + linha clicável na fila (RED → GREEN).
   - RED: `tests/unit/test_editor_navigation.py` (a)-(c).
   - GREEN: edits em `hymnbook_detail.html` + `hymnbook_list.html`.
   - Commit + PR + auto-merge.

## Considerações de implementação

- **Reaproveitar o markup da prévia** — em vez de duplicar o card do carrossel dentro de `quick_review.html`, **inlinar o body via `{% include "hymns/_hymn_body_centered.html" with hymn=current_hymn show_repetition_bars=True %}`** (criar/extrair partial se ainda não existe). Isso garante que melhorias visuais futuras se propagam para a tela ágil sem trabalho extra.
- **Sem `review_status` change na quick review** — explicitar no docstring da view *"This view never modifies `review_status`, `last_reviewed_at`, or `last_reviewed_by`."*. O signal de `HymnRevision` em `apps/hymns/signals.py` ainda capturará a mudança de `style`/`repetitions` (campo `field_diff` terá só esses dois) — desejado, é audit trail.
- **Permissão** — `_has_editor_access(request)` (já existe em `editor_views.py`) gateia. Hinários em `_editor_visible_books(user)` (já existe).
- **Anterior/Próximo perdem changes não salvas** — comportamento explícito do design (pílula/atalho de teclado já edita o input visualmente, mas só o botão "Salvar e ir" submete o form). Vale documentar com um `<small class="text-ink-mute">Pressione ⏎ ou clique em "Salvar e ir" para gravar.</small>` perto do hint, pra usuário não pensar que vai autosalvar.
- **Atalhos de teclado vs. iframe/admin** — `static/js/quick-review.js` deve só registrar o listener se o elemento `[data-quick-review]` existir no DOM (evita interferir no Wagtail admin se algum dia esse template for embeded em iframe).
- **Mobile** — não há design mobile específico para `07c`; usar grid `md:grid-cols-2` collapsing pra `grid-cols-1` em mobile (preview em cima, controles embaixo). Atalhos de teclado não fazem sentido em mobile, mas os tiles são touch-friendly por design.
- **Linha-toda-clicável + botões internos** — risco de clique no botão também navegar pra detail. Mitigação: o `<form>` aninhado de "Publicar hinário" já bloqueia naturalmente; o `<a>` "Revisar próximo →" e o novo "⚡ Revisão ágil" precisam de `onclick="event.stopPropagation()"` (ou usar `<button type="button">` com handler explícito em outro elemento).
- **Branch protection** — segue CLAUDE.md: feature branch → PR → CI green → squash merge. Nunca push direto em `main`. Memória "Sempre usar auto-merge nos PRs" → após `gh pr create`, rodar `gh pr merge --auto --squash`.

## Verificação ponta-a-ponta

```bash
cd /Users/nitai/dev/hyms-platform/hymns-plat

# 1. Lint + unit
DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest tests/unit/test_editor_quick_review.py tests/unit/test_editor_navigation.py -v
uv run black --check . && uv run isort --check-only . && uv run ruff check .

# 2. E2E (precisa de servidor :9000)
DJANGO_SETTINGS_MODULE=config.settings.test uv run python manage.py runserver 9000 &
sleep 3
uv run pytest tests/e2e/test_quick_review.py tests/e2e/test_repetition_bars_overlap.py -v

# 3. Smoke local manual
uv run python manage.py runserver 8000
# - http://localhost:8000/editor/hinarios/o-justiceiro/agil/ → testar M/V/Z, 1/2/3/4, ←/→, ⏎
# - confirmar que "Salvar e ir" altera Hymn.style/Hymn.repetitions sem mexer em review_status
# - confirmar que ?h=42 navega direto pro hino 42
# - http://localhost:8000/editor/hinarios/ → clicar em qualquer parte de uma linha (não só botões) deve abrir detail page

# 4. Round-trip prod (depois do auto-merge + deploy automático Railway)
curl -sSf https://hinaria.com.br/editor/hinarios/o-justiceiro/agil/?h=1
# espera: 200 (logado como editor) ou redirect pra login (anônimo)
```

## Riscos e mitigações

- **Quebra dos modos de leitura públicos ao mexer em barras de repetição** — mitigação: o passo 2 começa pelos E2E em `?mode=carrossel`, `?mode=corrido` e hymn_detail; só seguir adiante quando os 3 estiverem verdes.
- **Conflito de atalhos com browser** — `M`/`V`/`Z` não conflitam com nenhum atalho padrão do Chrome/Firefox. `1`/`2`/`3`/`4` também não (os de tab são `⌘+1..9`, com modificador). `←`/`→` são default scroll horizontal — `e.preventDefault()` resolve.
- **`HymnRevision` ruidosa** — toda mudança via quick review cria 1 revisão com 2 campos. Aceitável (é audit trail); se virar problema, agrupar revisões por janela temporal num PR futuro.
- **Permissão** — vista `editor_quick_review` precisa do mesmo gating das outras (`_has_editor_access`). Sem isso, qualquer logado poderia mudar `style`/`reps` em prod. Coberto pelo teste (f).
- **Migration não necessária** — não há mudança de schema; `Hymn.style` e `Hymn.repetitions` já existem.

## Arquivos novos (resumo)

| Path | Propósito |
|---|---|
| `apps/hymns/forms.py` (edição) | `QuickReviewForm` |
| `apps/hymns/editor_views.py` (edição) | `editor_quick_review` view |
| `apps/hymns/urls.py` (edição) | URL `editor_quick_review` |
| `templates/hymns/editor/quick_review.html` | Template da nova tela |
| `templates/hymns/_hymn_body_centered.html` (se ainda não existir) | Partial reaproveitável de preview com barras |
| `static/js/quick-review.js` | Atalhos + flash + sync de barras |
| `static/js/repetition-bars.js` | Helper compartilhado (column-packing) |
| `static/css/components.css` (edição) | `.quick-tile`, `.kbd-mark`, `.quick-tile-flash` |
| `tests/unit/test_editor_quick_review.py` | Cobertura backend |
| `tests/unit/test_editor_navigation.py` | Cobertura dos botões/links novos |
| `tests/e2e/test_quick_review.py` | Cobertura E2E (atalhos, save, navegação) |
| `tests/e2e/test_repetition_bars_overlap.py` | Cobertura E2E da regra de colunas |
| `_plan/plano-revisao-agil.md` | Cópia versionada do plano |
| `_design/fase2-bundle/` | Reimport do bundle do Claude Design |
