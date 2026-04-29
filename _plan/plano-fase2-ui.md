# Plan: Fase 2 — UI editorial completa + ajustes finos de backend

## Contexto

O design completo da Fase 2 foi entregue pelo Claude Design como PDF de 11 páginas (`/Users/nitai/Downloads/Hymns Platform · Fase 2 · UI Editorial · Print.pdf`). Quero pegar esse design, **trazer os arquivos para dentro do repo**, fazer pequenos ajustes de backend que faltam para suportar o que foi desenhado, e implementar a UI completa em substituição da atual (vanilla CSS embutido em ~200 linhas no `base.html`).

A Fase 1 (backend de fluxo editorial — papel `editor`, publicação, revisão por hino, `HymnRevision`, workspace `/editor/`) já está mergeada no commit `e7d9b7a` com 442 testes verdes. Os contratos de URL e modelo daquela fase são estáveis e referenciados aqui.

Decisões tomadas com você antes de redigir o plano:
- **Stack de CSS**: Tailwind via Play CDN (`<script src="https://cdn.tailwindcss.com">`) — zero build no momento. Compilação para produção fica como passo opcional no deploy.
- **Confiança OCR**: só média por hino agora; per-line fica para v3 (exigiria mudança no `hymn-ocr`, que hoje não emite confiança por linha — verificado).
- **Dark mode**: toggle global por usuário, persiste em `localStorage`. Caso de uso principal é leitura à noite durante trabalho.
- **TDD**: aplicar onde fizer sentido (model, manager, view, endpoint). Para CSS/HTML estático, testes de view focados em "rota renderiza 200 com selector X presente" + smoke visual manual.

---

## Telas mapeadas no PDF (11)

1. **Home** — hero serifado, stats inline, "Em destaque" com cards coloridos (cada hinário ganha uma cor temática).
2. **Detalhe de Hinário** — header navy com cover-card sobreposto, toggle "Modo de leitura: Índice / Corrido / Carrossel", lista em duas colunas com pontilhado tipo livro.
3. **Detalhe de Hino** — breadcrumb, anterior/próximo, card central serifado com barras de repetição refinadas e Estrela de Davi de fechamento, sidebar com áudio (waveform), Favoritado pill, ações, Detalhes (incluindo Origem e Última revisão), e toggle de modo no próprio sidebar.
4. **Editor / Fila de revisão** — sticky "Continuar revisão · você parou no hino 42 'Sol da Manhã'", ordenação (menos/mais/recém), cards com badge OCR/MANUAL + barra de progresso + pílula de estado + CTA contextual ("Revisar próximo →" / "Publicar hinário ✓").
5. **Revisar Hino** — layout 2 colunas: esquerda mostra fonte original com toggle OCR / PDF página / Diff (com diff inline tipo git), barra de "Confiança OCR · por linha" (heatmap colorido); direita é o form de revisão com Status (toggle Não revisado / Em revisão / Revisado), Resumo da mudança, autosave "há 3s", e atalhos visíveis ("Esc" e "⏎").
6. **Modal Publicar** — checklist com 4 critérios (todos os hinos revisados, capa+descrição preenchidas, dono identificado, auditoria registrada · N revisores) + barra de progresso + "Publicar agora".
7. **Wizard OCR (Conferir)** — stepper de 4 etapas, página do PDF preview à esquerda, painel "Será criado como rascunho" + tabela de hinos detectados com confiança média à direita.
8. **Busca** — input grande, tabs (TUDO / EM HINOS / EM HINÁRIOS) com contador, chips de filtro removíveis, cards de resultado com snippet com headline highlighted.
9. **Mobile / Carrossel** — variantes Dia (cream) e Noite (navy escuro), modo carrossel com indicadores de slide, áudio fixo no rodapé.
10. **Perfil de usuário** — avatar circular grande, bio em itálico, stats (revisados/hinários/seguidores), heatmap "Trabalho editorial" (último ano, estilo GitHub contributions) usando `HymnRevision`, painel de notificações inline, cards de revisões recentes.
11. **Histórico de revisões (drawer)** — drawer lateral com timeline de eventos (incluindo "Sistema · criado via OCR") + diff por mudança usando `field_diff` do `HymnRevision`.

---

## Pré-trabalho — importar o design

1. Criar `/Users/nitai/dev/hyms-platform/hymns-plat/_design/` (versionado no git, separado do código).
2. Mover `/Users/nitai/Downloads/Hymns Platform · Fase 2 · UI Editorial · Print.pdf` para `_design/fase2-print.pdf`.
3. Quando o zip com os HTMLs originais chegar, extrair em `_design/fase2-html/` para referência durante a implementação (cores exatas, espaçamentos, marcações).
4. `_design/` entra no `.gitignore` ou versiona? **Versiona**: serve de referência permanente para futuras evoluções (~3-5 MB).

---

## Fase 2.0 — Ajustes de backend (TDD-first)

Sequência de marcos pequenos. Cada um: teste falhando → implementação mínima → verde → próximo.

### Marco 2.0.1 — Preservar texto original do OCR + média de confiança

**Por quê**: a tela "Revisar Hino" tem um diff visual entre OCR original e versão atual. Hoje o texto OCR é descartado depois que o `Hymn` é criado.

**Mudanças**:
- `Hymn.ocr_text: TextField(blank=True)` — texto cru do OCR.
- `Hymn.ocr_avg_confidence: FloatField(null=True, blank=True)` — 0..100, média entre palavras.
- `apps/users/views.py:upload_preview_view` ao criar `Hymn` via OCR: passa `ocr_text=hymn_data.get("text")` (o resultado do hymn-ocr é o "OCR cru" antes da revisão) e `ocr_avg_confidence` derivada do `OCRTask.result_data` (somar/promediar a confiança que o hymn-ocr expõe — investigar; se não houver, deixar `null`).
- Migration `0011_hymn_ocr_metadata.py`.

**Testes** em `tests/unit/test_ocr_metadata.py`:
- `test_hymn_ocr_text_default_blank`
- `test_ocr_flow_persists_ocr_text_and_confidence`
- `test_manual_hymn_has_no_ocr_text`

**Endpoint que se beneficia (já em 2.0.3)**: `/api/hinos/<pk>/diff/` retornará `{ocr_text, current_text, avg_confidence}` em JSON.

### Marco 2.0.2 — Registrar criação inicial como `HymnRevision`

**Por quê**: o drawer de histórico (tela 11) mostra "Sistema · criado via OCR" como primeiro evento. Hoje o sinal só registra UPDATEs.

**Mudanças** em `apps/hymns/signals.py`:
- Quando `created=True` e `instance.source != Hymn.Source.MANUAL`: criar `HymnRevision(hymn=..., revised_by=None, previous_status="", new_status=instance.review_status, change_summary=f"Criado via {instance.get_source_display()}", field_diff={})`.
- Continua pulando `raw=True` (loaddata).

**Testes** em `tests/unit/test_review.py` (estender):
- `test_initial_revision_recorded_for_ocr_source`
- `test_initial_revision_recorded_for_yaml_source`
- `test_no_initial_revision_for_manual_source` (preserva comportamento atual)

### Marco 2.0.3 — Endpoints derivados para a UI

**Por quê**: a UI da Fase 2 precisa de dados que hoje não estão expostos como JSON.

**Novos endpoints** em `apps/hymns/api_views.py` (novo módulo) + `apps/users/api_views.py`:

| Endpoint | Retorno |
|---|---|
| `GET /api/stats/global/` | `{hymnbooks, hymns, audios, active_reviewers}` — para a home. `active_reviewers` = usuários com pelo menos 1 `HymnRevision` nos últimos 30 dias. |
| `GET /api/editor/resume/` | `{hymnbook_slug, hymn_pk, hymn_number, hymn_title}` ou `null`. Deriva: último `HymnRevision` do user atual cujo `hymn.review_status != REVIEWED`. |
| `GET /api/users/<username>/heatmap/` | `[{date, count}]` últimos 365 dias, contagem por dia de `HymnRevision.revised_by=user`. |
| `GET /api/hymns/<pk>/history/` | Lista de `HymnRevision` com `revised_by`, `revised_at`, `change_summary`, `field_diff`, `previous_status`, `new_status`. |
| `GET /api/hymns/<pk>/diff/` | `{ocr_text, current_text, avg_confidence}` — para o painel de diff no revisor. |
| `GET /api/notifications/unread-count/` | já existe, manter. |

**Padrão**: todos retornam `JsonResponse`, exigem `@login_required` exceto `/stats/global/` (público), e checam permissões equivalentes às views de leitura existentes.

**Testes** em `tests/unit/test_api_endpoints.py`:
- 1 happy path por endpoint + 1 caso de não-autorizado + 1 caso de "vazio".

### Marco 2.0.4 — Busca expandida (hinos + hinários, com headline)

**Por quê**: tela 8 mostra abas (TUDO / EM HINOS 18 / EM HINÁRIOS 5) e snippets com termo highlighted.

**Mudanças** em `apps/hymns/views.py:search_view`:
- Querystring nova: `?type=all|hymns|books`, default `all`.
- Filtro adicional: `?in_hymnbook=<slug>` (chip removível).
- Resultados como lista heterogênea de `{type: "hymn"|"book", obj, headline, rank}`.
- Usar `SearchHeadline` do PostgreSQL para gerar snippet com `<mark>` em volta do termo.
- Manter o limite de 50 e os filtros de visibilidade existentes (`HymnBook.objects.visible_to(user)`).

**Testes** em `tests/unit/test_search_view.py` (estender):
- `test_search_returns_books_when_type_books`
- `test_search_includes_headline_with_mark`
- `test_search_filtered_by_hymnbook_slug`
- `test_tab_counters_in_context` (`results_count_all`, `results_count_hymns`, `results_count_books`)

### Marco 2.0.5 — Pré-condições de publicação enriquecidas

**Por quê**: o modal Publicar (tela 6) verifica 4 critérios, não só "todos os hinos revisados".

**Mudanças**:
- `apps/hymns/services/review.py` (novo): função `publish_readiness(hymnbook) -> dict` retornando:
  ```python
  {
    "checks": [
      {"label": "Todos os 64 hinos revisados", "ok": True},
      {"label": "Capa e descrição preenchidas", "ok": True/False},
      {"label": "Dono do hinário identificado", "ok": True/False},
      {"label": "Auditoria registrada · 4 revisores", "ok": True/False},
    ],
    "can_publish": all([...]),
    "review_progress": {...},
    "reviewer_count": int,
  }
  ```
- `hymnbook_publish_view` chama essa função em vez do `is_fully_reviewed` direto.
- Endpoint `GET /hinarios/<slug>/publish-check/` retorna o JSON do `publish_readiness` para o modal renderizar.

**Testes** em `tests/unit/test_publish_readiness.py` (novo):
- 1 teste por critério individual + happy path "todos ok" + "publish bloqueia se algum falha".

### Marco 2.0.6 — Cor temática por hinário

**Por quê**: cards "Em destaque" (tela 1) e cover-card (tela 2) ganham cor própria.

**Mudanças**:
- `HymnBook.accent_color: CharField(max_length=7, blank=True)` — hex code opcional.
- Property `display_accent`: retorna `accent_color` se preenchido, senão escolhe determinística entre uma paleta de 8 cores (verde-musgo, vermelho-tijolo, navy, oliva, mostarda, púrpura, ciano, marrom) por hash do `slug`.
- Migration `0012_hymnbook_accent_color.py`.

**Testes** em `tests/unit/test_hymnbook_theme.py`:
- `test_display_accent_uses_explicit_when_set`
- `test_display_accent_is_deterministic_per_slug`
- `test_display_accent_distributes_palette` (sanity: 8 slugs distintos cobrem ≥6 cores).

---

## Fase 2.1 — UI completa (Tailwind CDN, dark mode, mobile-first)

### Setup base (Marco 2.1.0)

**Arquivos novos**:
- `static/css/design-tokens.css` — variáveis CSS para light + dark.
- `static/css/components.css` — `.btn-primary`, `.btn-pill`, `.card`, `.label-mono`, `.dot-leader`, refinamento da `.hymn-grid`.
- `static/js/dark-mode.js` — toggle persistido em `localStorage` (Alpine ou vanilla).
- `static/js/keyboard-shortcuts.js` — `⌘K` abre busca, `j/k` navegam hinos no detalhe.

**Tokens** (extraídos do PDF):
```
Light mode:
  --color-bg: #F5EDDC      /* cream */
  --color-bg-deep: #EDE3CD
  --color-ink: #14213A     /* navy */
  --color-ink-soft: #3F4A5F
  --color-accent: #B58D3E  /* gold */
  --color-accent-soft: #E8D5A8
  --color-success: #6E8C3A /* moss */
  --color-rust: #8C3A2E
  --color-shadow: rgba(20,33,58,0.08)

Dark mode:
  --color-bg: #0E1320
  --color-bg-deep: #1A2030
  --color-ink: #EDE3CD
  ...
```

**Tipografia** (via Google Fonts no `<head>` do `base.html`):
- Cormorant Garamond (400, 500, 600 + italic) — títulos, lyrics
- Inter (400, 500, 600) — body
- JetBrains Mono (400) — labels uppercase tracked, números técnicos

**Reescrita do `templates/base.html`**:
- Tailwind Play CDN com `tailwind.config = {...}` inline expondo design tokens como cores nomeadas (`bg-cream`, `text-ink`, etc.) e fontes (`font-serif: 'Cormorant Garamond'`, `font-sans: 'Inter'`, `font-mono: 'JetBrains Mono'`).
- Header global: logo "✶ Hinários" (svg inline), nav (Início/Hinários/Buscar/Editor/Contribuir), input de busca + atalho ⌘K, sino com badge de não-lidas, avatar com iniciais.
- Toggle de dark mode no canto.
- Footer minimalista.

**Partials novos** em `templates/_partials/`:
- `_header.html`, `_footer.html`, `_search_bar.html`, `_avatar.html`, `_dark_toggle.html`, `_label_mono.html`, `_dot_leader_row.html`.

**Testes** em `tests/unit/test_layout.py` (novo):
- `test_base_loads_tailwind_cdn`
- `test_base_loads_three_font_families`
- `test_header_renders_full_nav_when_authenticated`
- `test_header_shows_unread_badge_when_count_gt_0`
- `test_dark_mode_toggle_present`

### Marco 2.1.1 — Home (`hymns:home`)

Template: `templates/hymns/home.html`
- Hero: tagline serif "Hinários para ler, ouvir e *guardar com cuidado*."
- Big search bar (POST → `/busca/`).
- Stats inline (consome `/api/stats/global/`).
- "Em destaque": grid responsiva (3 cols desktop, 1 mobile) com cards coloridos baseados em `display_accent`. Cada card mostra letra grande do nome (primeira inicial em serif gigante) + "EST. 19xx" + nome + dono.

**Testes** (estender `test_layout.py`):
- `test_home_includes_global_stats_block`
- `test_home_featured_cards_use_accent_color`

### Marco 2.1.2 — Lista e detalhe de Hinários

Templates:
- `templates/hymns/hymnbook_list.html` — grid de cards (mesmo componente do "Em destaque").
- `templates/hymns/hymnbook_detail.html` — header navy com cover-card flutuando, três modos:
  - **Índice** (default): 2 colunas com `dot-leader`, cada linha "01 Lua Branca .... Valsa 🎵 (icon de áudio se houver)".
  - **Corrido**: hinos um abaixo do outro com separador de Estrela de Davi entre eles, lyrics renderizadas inline. Implementa via `?modo=corrido` (server-side render) para SEO/print.
  - **Carrossel**: snap-scroll horizontal, indicadores de slide, tap esquerda/direita.
- Toggle persiste em `localStorage` (chave `hymnbook-mode-{slug}`).

**Testes**:
- `test_hymnbook_detail_renders_three_modes`
- `test_hymnbook_detail_hides_unpublished_pill_for_published`
- `test_corrido_mode_renders_all_hymns_inline`

### Marco 2.1.3 — Detalhe de Hino

Template: `templates/hymns/hymn_detail.html`
- Breadcrumb topo: `Hinários / O Cruzeiro / HINO 07`.
- Botões anterior/próximo no canto direito ("← Anterior · 06" / "08 · Próximo →").
- Card central com letra:
  - Título serif grande, filete horizontal abaixo (igual PDF).
  - Lyrics em Cormorant Garamond, leading 1.6.
  - Barras de repetição existentes refinadas (refinamento do CSS que já temos em `repetitions.py`).
  - Estrela de Davi (✡) ou Sol/Lua/Estrela (☀ ☾ ★) no rodapé.
- Sidebar:
  - Áudio com waveform — usar `wavesurfer.js` (CDN, ~30KB) — `<audio>` ainda como fallback.
  - Pill "Favoritado" (já existe a action toggle).
  - Botões: Adicionar áudio, Imprimir, Compartilhar.
  - Detalhes (Estilo, Recebido em, Oferecido a, Origem, Última revisão).
  - Modo de leitura (toggle Único/Corrido/Carrossel — mesma chave do detail).
- `@media print` — esconde sidebar e nav, mostra só o card central, fonte preta sobre branco.

**Testes**:
- `test_hymn_detail_shows_origin_label` (verifica que `Origem: Manual/OCR/YAML` aparece).
- `test_hymn_detail_shows_last_review_when_reviewed`
- `test_hymn_detail_renders_audio_waveform_when_audio_exists`

### Marco 2.1.4 — Busca

Template: `templates/hymns/search.html`
- Input grande no topo.
- Tabs com contadores: TUDO (N) / EM HINOS (M) / EM HINÁRIOS (K).
- Chips de filtro: "filtrado por: O Cruzeiro ×".
- Cards de resultado com `headline` highlighted (preserva `<mark>` server-side).

**Testes**:
- `test_search_renders_three_tabs`
- `test_search_renders_chip_when_filtered`
- `test_search_marks_term_in_snippet`

### Marco 2.1.5 — Workspace do editor

Reescreve `templates/hymns/editor/`:

**`hymnbook_list.html` (Fila de revisão)**:
- Header "WORKSPACE EDITORIAL" + título.
- Stats inline (4 hinários / 173 hinos pendentes / 89 revisados · 7 dias) — derivar.
- Sticky "Continuar revisão" (consome `/api/editor/resume/`).
- Toggle ordenação (3 pílulas).
- Cards com badge OCR/MANUAL (deriva: `HymnBook.predominant_source` property — mais comum entre os hinos), barra de progresso, "X em revisão", pílula de estado, CTA contextual.

**`hymnbook_detail.html`** — versão refinada do que já existe.

**`revise_hymn.html`** (a tela mais densa):
- Header simples: "← Hinos do Sol" / "Revisar hino · 42 de 64 · 23 restantes" / "EM REVISÃO · fonte · OCR".
- Layout 2 colunas:
  - **Esquerda — Fonte original**: toggle 3 pílulas (OCR / PDF página / Diff). Conteúdo:
    - OCR: `<pre>` com texto cru de `Hymn.ocr_text`.
    - PDF página: `<img>` com a página renderizada (será gerada como subproduto do hymn-ocr — se ainda não tem, simplifica para "indisponível" e habilita só OCR/Diff).
    - Diff: server-side via `difflib.unified_diff` ou client-side via `diff-match-patch.js` (CDN). Cor verde para adicionado, rosa para removido, igual ao PDF.
    - Bloco "Confiança OCR · por linha" — heatmap simplificado: barras horizontais de altura única, cor por bucket de confiança da palavra (≥90 verde, 70-89 amarelo, <70 vermelho). Implementação simples: agrupa palavras por linha do texto OCR e usa a média.
  - **Direita — Versão revisada**: form com:
    - Inputs `number`, `title`, `text` (textarea grande), `repetitions`, `style`, `received_at`, `offered_to`.
    - Status (3 pílulas Não revisado / Em revisão / Revisado).
    - "Resumo da mudança · opcional" (textarea curta).
    - **Autosave**: debounced (1.5s) via HTMX `hx-post` + atributo `hx-trigger="input changed delay:1.5s"`. Status "Salvo automaticamente · há 3s" atualiza via JS pequeno.
    - Atalhos: `⏎` (Enter) = "Marcar revisado e avançar"; `Esc` = "Pular sem salvar"; `⌘S` = "Salvar rascunho".

**Modal Publicar** (`_partials/_publish_modal.html`):
- Lançado pelo botão "Publicar hinário" do detalhe.
- HTMX carrega o modal com `publish_readiness` renderizado (4 checkpoints com ✓ verde ou ✗ vermelho).
- Barra de progresso de revisão.
- Botão "Publicar agora" desabilitado se `can_publish=False`.

**Testes**:
- `test_revise_hymn_renders_diff_when_ocr_text_present`
- `test_revise_hymn_hides_diff_toggle_when_no_ocr_text` (graceful degrade)
- `test_revise_hymn_autosave_endpoint_returns_200`
- `test_publish_modal_lists_failed_checks`
- `test_continuar_revisao_endpoint_returns_last_unreviewed_hymn_for_user`

### Marco 2.1.6 — Wizard de upload

Reescreve `templates/users/upload*.html`:
- Stepper visual (`UPLOAD → PROCESSANDO → CONFERIR → CONFIRMAR`).
- Página "Conferir" (`upload_preview.html`):
  - Esquerda: PDF preview (img da primeira página com paginação `← →`).
  - Direita: alerta "Será criado como rascunho · não publicado · cada hino como não revisado", tabela de hinos detectados com confiança média.
- Página "Confirmar" (`upload_confirm.html`): visual minimalista para "adicionar como versão de hinário existente".

**Testes**:
- `test_upload_preview_shows_stepper_at_step_3`
- `test_upload_preview_shows_avg_confidence_per_hymn` (depende do Marco 2.0.1)

### Marco 2.1.7 — Perfil + notificações

Templates:
- `users/profile.html` — avatar grande circular, bio em itálico (Cormorant Garamond italic), stats, heatmap (consome `/api/users/<username>/heatmap/`), painel de notificações inline para o próprio usuário, cards de revisões recentes.
- `users/notifications.html` — lista paginada com tipos de evento.

Heatmap: SVG inline gerado server-side a partir do JSON do endpoint, ~52 colunas × 7 linhas, cor mais intensa = mais revisões naquele dia.

**Testes**:
- `test_profile_renders_heatmap`
- `test_profile_shows_recent_revisions_block`

### Marco 2.1.8 — Histórico de revisões (drawer)

- Botão "Histórico" no sidebar do detalhe de hino → abre drawer lateral via HTMX (`/hinos/<pk>/historico/`).
- Lista de eventos cronológicos (timeline com bullets coloridos por tipo).
- Painel direito mostra mudanças do evento selecionado (Title / Text · linha N / etc.) com diff visual de campos do `HymnRevision.field_diff`.

Template: `templates/hymns/_partials/_history_drawer.html`

**Testes**:
- `test_history_drawer_lists_all_revisions`
- `test_history_drawer_renders_field_diff_with_old_new`
- `test_history_drawer_includes_creation_event_for_ocr_hymns` (depende do Marco 2.0.2)

---

## Sequência de execução

1. **Pré-trabalho**: criar `_design/`, mover o PDF, registrar no git.
2. **Fase 2.0**: Marcos 2.0.1 → 2.0.6 sequenciais. Cada um termina com `pytest -m "not e2e"` verde.
3. **Fase 2.1**: Marcos 2.1.0 → 2.1.8 sequenciais. Marco 2.1.0 é pré-requisito de todos os outros (tokens + base.html). Após 2.1.0, posso paralelizar 2.1.1 e 2.1.2 se necessário.
4. **Verificação final**:
   - Smoke manual de todas as 11 telas, light + dark, desktop + mobile.
   - `pytest -m "not e2e"` (esperado: ~500 testes verdes).
   - Visualmente comparar com o PDF — variação de paleta/tipografia ok, layout deve casar.

### Plug `/frontend-design:frontend-design`

Disponível no setup (skill `frontend-design:frontend-design`). Posso usá-lo nos marcos **2.1.0** (setup base, decidir tokens finos) e **2.1.5** (revise_hymn — a tela mais densa) — ele dá prompts mais calibrados para evitar "AI generic look". Nos demais marcos, replica o estilo já consolidado.

---

## Arquivos críticos

**Backend** (Fase 2.0):
- `apps/hymns/models.py` — adicionar `Hymn.ocr_text`, `Hymn.ocr_avg_confidence`, `HymnBook.accent_color`.
- `apps/hymns/signals.py` — registrar criação inicial como revision para `source != MANUAL`.
- `apps/hymns/api_views.py` (novo) — endpoints JSON.
- `apps/users/api_views.py` (novo) — heatmap.
- `apps/hymns/services/review.py` (novo) — `publish_readiness`.
- `apps/hymns/views.py` — `search_view` expandida; `hymnbook_publish_view` consome `publish_readiness`.
- `apps/hymns/urls.py` — registrar novas rotas.
- Migrations: `0011_hymn_ocr_metadata.py`, `0012_hymnbook_accent_color.py`.

**Frontend** (Fase 2.1):
- `templates/base.html` — reescrito.
- `templates/_partials/*` — novos componentes reutilizáveis.
- `templates/hymns/{home,hymnbook_list,hymnbook_detail,hymn_detail,search}.html` — reescritos.
- `templates/hymns/editor/{hymnbook_list,hymnbook_detail,revise_hymn}.html` — reescritos sobre os provisórios da Fase 1.
- `templates/users/{profile,upload*,notifications}.html` — reescritos.
- `static/css/design-tokens.css`, `static/css/components.css` — novos.
- `static/js/dark-mode.js`, `static/js/keyboard-shortcuts.js` — novos.

---

## Riscos & mitigações

- **Tailwind via CDN em produção**: warning oficial do Tailwind diz "use compiled". *Mitigação*: para staging/local fica como está; antes de deploy gerar `static/css/tailwind.min.css` via `npx tailwindcss -i ... -o ...` (passo opcional, fora do escopo da Fase 2).
- **`Hymn.ocr_text` vazio em hinos antigos**: hinos pré-Fase 2 não têm OCR text guardado. *Mitigação*: a tela de revisão esconde o toggle Diff/PDF e mostra só "OCR" desabilitado quando `ocr_text == ""`. Aceito perder o diff visual nesses 167 hinos legados.
- **Heatmap pode ficar pesado**: query agregada por `TruncDate` em `HymnRevision`. *Mitigação*: cap de 365 dias e cache de 5min por usuário.
- **wavesurfer.js só funciona com áudio acessível por URL**: nossos áudios já estão. Se houver CORS issue local, fallback para `<audio controls>` puro.
- **Diff client-side com `diff-match-patch`** pode ser lento para hinos grandes (>500 linhas). *Mitigação*: textos são curtos (<50 linhas em geral). Server-side `difflib.unified_diff` como alternativa se necessário.

---

## Critérios de aceite

- 11 telas do PDF renderizadas no projeto, light e dark.
- Toggle de dark mode persiste entre sessões.
- Workspace do editor com diff visual funcionando para hinos com `ocr_text`.
- Modal de publicação mostra os 4 critérios e bloqueia publicação se algum falhar.
- Drawer de histórico mostra evento "criado via OCR" para hinos OCR.
- `pytest -m "not e2e"` verde, com cobertura ≥ atual (442 → ~500+ testes).
- Lighthouse mobile (página inicial e detalhe de hino): performance ≥ 85, acessibilidade ≥ 95.

---

## Verificação end-to-end

1. `poetry run pytest -m "not e2e"` — toda a suíte verde.
2. `poetry run python manage.py migrate` em DB local — migrations aplicam sem erro.
3. `poetry run python manage.py runserver` — abrir cada uma das 11 rotas:
   - http://localhost:8000/ (home)
   - http://localhost:8000/hinarios/
   - http://localhost:8000/hinarios/o-cruzeiro/
   - http://localhost:8000/hinos/`<uuid>`/
   - http://localhost:8000/busca/?q=lua
   - http://localhost:8000/editor/hinarios/
   - http://localhost:8000/editor/hinarios/o-cruzeiro/
   - http://localhost:8000/editor/hinos/`<uuid>`/revisar/
   - http://localhost:8000/contribuir/
   - http://localhost:8000/perfil/nitai/
   - Drawer de histórico (HTMX, abre na tela de hino)
4. Toggle dark mode em cada tela — confirmar contraste e legibilidade.
5. Mobile (DevTools 375×812) — confirmar carrossel funciona com tap esquerda/direita.
6. Subir um PDF novo via `/contribuir/` — confirmar wizard com stepper visual + confiança média na conferência.
7. Como editor: revisar 1 hino com Diff visível → marcar Revisado e Avançar (atalho ⏎) → o "Continuar revisão" no topo da fila deve refletir o último não-revisado.
8. Tentar publicar um hinário antes de cumprir os 4 critérios → modal mostra X vermelho e botão desabilitado.
