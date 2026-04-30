# Plano: Fechar gaps do design (Phase 2 fidelity)

## Contexto

Auditoria contra `_design/fase2-print.pdf` (11 páginas, capturado em `/tmp/audit-shots/` em desktop+mobile) encontrou **30 issues**: 5 críticas (bug funcional ou tela quebrada), 13 importantes (diverge do design mas funciona), 12 polish. Implementar tudo em três marcos, validando visualmente com Playwright a cada um. As capturas atuais ficam como baseline para comparar antes/depois.

**Achados-chave da exploração** (que mudam o esforço estimado):

- **Mode toggle (#2.1)** — TODOS os 3 modos (índice/corrido/carrossel) JÁ ESTÃO 100% implementados em `templates/hymns/hymnbook_detail.html:59-104` como `<section data-mode-pane>`. A diferença é só ler `request.GET.mode` na view (~20 min, não dia inteiro).
- **History drawer com diff panel (#11.1)** — JÁ ESTÁ implementado em `_history_drawer.html`; o screenshot do audit mostrou só o estado vazio porque os hinos do `O Justiceiro` foram importados via YAML (sem revisões editoriais ainda). Validar com hino que tenha revisões reais.
- **Recent revisions no profile (#10.2)** — view já passa `recent_revisions`; precisa só de template.
- **Notifications model (#10.1)** — modelo existe (`apps/users/models.py:48-102`), mas a view do profile não passa pro context. View+template work.
- **Mobile menu (#9.2/M.1)** — não existe nada hoje. Reusar padrão de drawer já usado em `hymn_detail.html` (translate-x-full).

**Skill `/frontend-design:frontend-design`** será invocada nos pontos onde o design original é insuficiente: animação do hamburger drawer (Marco 1.3), mini-player mobile fixo (Marco 3.2), microinterações do stepper (Marco 3.1).

## Decisões fixas

- **Sem novos models/migrations** — todos os dados (HymnRevision, Notification, HymnBook fields) já existem.
- **localStorage continua valendo no JS** — só o estado inicial passa a vir do server. JS+localStorage seguem funcionando para toggle pós-load.
- **Cover overlay duplicado (#2.2)**: esconder overlay quando `cover_image` está setada (confia no design da imagem). Não tentar mascarar.
- **Cada Marco = 1 PR**, mergeável independente. Marco 1 deve ir pra produção rápido (são bugs).
- **TDD onde aplicável** — testes de template (presença/ausência de string), testes de view (context). Visual com `tests/e2e/validate_fase2.py` atualizado.

## Marco 1 — 5 bugs críticos (~2h)

### 1.1 Comentário Django renderizando como texto (#7.1)

**Arquivos**: `templates/users/upload.html` (procurar a string `Stepper visual do wizard`)

`{# ...\n... #}` em várias linhas → Django renderiza literal. Trocar por `{% comment %}...{% endcomment %}` (multi-line OK) **ou** compactar em uma linha.

**Teste**: `tests/unit/test_upload_template.py::test_no_literal_template_comment` — GET `/contribuir/` autenticado, `assert b"{#" not in response.content`.

### 1.2 Mode toggle via URL (#2.1)

**Arquivos**:
- `apps/hymns/views.py:33-46` — em `HymnBookDetailView.get_context_data`, adicionar:
  ```python
  mode = self.request.GET.get("mode", "indice")
  if mode not in {"indice", "corrido", "carrossel"}:
      mode = "indice"
  context["mode"] = mode
  ```
- `templates/hymns/hymnbook_detail.html` — em cada `<section data-mode-pane="...">`, mudar a class inicial para condicional:
  ```django
  class="...{% if mode != 'indice' %} hidden{% endif %}"
  ```
- O `<script>` IIFE de linhas 106-127 já usa localStorage; deixar como está, mas o `localStorage.getItem(key) || initial` deve ler o initial do contexto. Adicionar `data-initial-mode="{{ mode }}"` em `[data-mode-toggle]` e usar no JS.

**Testes** (`tests/unit/test_hymnbook_modes.py`):
- `test_default_mode_is_indice`
- `test_mode_corrido_via_url_renders_corrido_pane_visible`
- `test_invalid_mode_falls_back_to_indice`

### 1.3 Mobile hamburger menu (#9.2 / M.1)

**Arquivos**:
- `templates/_partials/_header.html` — adicionar botão `<button data-mobile-menu-toggle class="md:hidden ...">` (SVG hamburger, igual aos outros ícones de header) e drawer off-canvas (`<aside data-mobile-menu class="fixed inset-y-0 right-0 w-72 bg-cream translate-x-full transition-transform">` com os links da nav + busca).
- `static/js/mobile-menu.js` (novo) — toggle de classe `translate-x-full`, click fora fecha, ESC fecha, focus trap.
- `templates/base.html` — incluir o script.

**Skill `/frontend-design:frontend-design`** com input específico: "Refine the mobile drawer menu in `_header.html` data-mobile-menu — animation easing, backdrop fade, focus trap, prefers-reduced-motion. Match the cream/ink palette."

**Testes**:
- e2e Playwright em viewport 390x844: hamburger visível, click → drawer aparece, links funcionam, ESC fecha.
- Adicionar ao `validate_fase2.py`.

### 1.4 Título do hino corta em mobile (#9.1)

**Arquivo**: `templates/hymns/hymn_detail.html`

H1 atual `text-4xl md:text-5xl`. Em 390px com "Eu Vivo Neste Mundo" em Cormorant Garamond, ainda overflow porque a coluna pai tem padding apertado. Fix:
- Adicionar `break-words` e `text-balance` ao H1.
- Reduzir um nível: `text-3xl sm:text-4xl md:text-5xl`.

### 1.5 Header do Revise hymn quebra em mobile (#5.4)

**Arquivo**: `templates/hymns/editor/revise_hymn.html` (linha 7, `grid grid-cols-3 items-center`)

Trocar por:
```django
<div class="flex flex-wrap items-center gap-3 md:grid md:grid-cols-3">
```

Badges (`NÃO REVISADO`, `FONTE · YAML`) ficam em segunda linha em mobile.

## Marco 2 — 13 issues importantes (~3-4h)

### 2.1 Profile: lista de notificações (#10.1)

- `apps/users/views.py::profile_view()` — adicionar `context["notifications"] = user.notifications.order_by("-created_at")[:10]`.
- `templates/users/profile.html` — substituir placeholder por `{% include "users/_partials/_notification_item.html" %}` em loop.
- Criar `templates/users/_partials/_notification_item.html` — avatar circle (initial do `notification.sender.username` ou ícone "S" para Sistema), `<strong>{{ n.sender.username }}</strong> {{ n.message }} · <em>{{ n.link_label }}</em>`, `<time>{{ n.created_at|naturaltime }}</time>`. Badge `● 3 NOVAS` no header da seção quando `is_read=False` count > 0.

### 2.2 Profile: cards de revisões recentes (#10.2)

`templates/users/profile.html` — adicionar seção "Revisões recentes" abaixo do heatmap, `grid grid-cols-1 md:grid-cols-3 gap-3`. Cada card: HINO N (mono), título (serif), hinário (italic), badge derivada de `revision.field_diff.keys()` (ex: "4 typos OCR" se text mudou; "metadata" se outros campos), `revised_at|naturaltime`.

### 2.3 Cover overlay duplicado (#2.2)

`templates/_partials/_hymnbook_card.html` + `templates/hymns/hymnbook_detail.html`:
- Quando `hb.cover_image`: imagem full-bleed, sem overlay de texto. Apenas RASCUNHO badge se `not is_published`.
- Quando sem cover: comportamento atual (placeholder com letra grande + título overlay).

### 2.4 Hymn detail: modo de leitura na sidebar (#3.1)

`templates/hymns/hymn_detail.html` — adicionar bloco depois de DETALHES:
```django
<div class="card-soft p-4">
  <p class="label-mono">MODO DE LEITURA</p>
  <div class="flex gap-2 mt-2">
    <a href="{% url 'hymns:hymnbook_detail' hymn.hymn_book.slug %}?mode=indice#hino-{{ hymn.number }}" class="btn-pill">Único</a>
    <a href="?mode=corrido" class="btn-pill">Corrido</a>
    <a href="?mode=carrossel" class="btn-pill">Carrossel</a>
  </div>
</div>
```

### 2.5 Hymn detail: campos extras em DETALHES (#3.2)

Mesmo arquivo. Adicionar `Estilo`, `Recebido em` (formatado), `Oferecido a`, `Última revisão` (com `last_reviewed_by.username` + `naturaltime`). Cada um condicional: só renderiza se preenchido.

### 2.6 Editor workspace: banner "Continuar revisão" (#4.1)

`apps/hymns/editor_views.py::HymnbookListView` (ou função equivalente) — passar `last_in_review_hymn` (último `HymnRevision` do user com `new_status=IN_REVIEW` ou último `Hymn` com `last_reviewed_by=user, review_status=IN_REVIEW`).

`templates/hymns/editor/hymnbook_list.html` — renderizar banner topo quando existir, com link "Retomar →".

### 2.7 Editor workspace: stats inline (#4.2)

Mesmo template. Trocar layout vertical (label sobre número) por horizontal `flex gap-8` com number-then-label.

### 2.8 Editor workspace: botão "Publicar hinário" (#4.4)

Mesmo template. No card de cada hymnbook: se `progress.pct == 100`, mostrar `<a class="bg-gold text-night ...">Publicar hinário ✓</a>` em vez de "Revisar próximo".

### 2.9 Repetition `2×` na margem (#3.4)

`apps/hymns/templatetags/hymn_extras.py` — onde a estrofe é renderizada com `repetitions > 1`, embrulhar com:
```html
<div class="relative">
  <span class="absolute -left-6 top-0 text-xs label-mono text-gold">{{ count }}×</span>
  ...
</div>
```

### 2.10 Search highlight color (#8.1)

`static/css/components.css` — adicionar:
```css
mark { background: rgb(232 213 168 / 0.55); color: var(--color-ink); padding: 0.05em 0.25em; border-radius: 3px; box-decoration-break: clone; }
```

### 2.11 Validar history drawer com revisões reais

Já implementado. Criar 1-2 revisões editoriais em `O Justiceiro` (rodando `revise` de algum hino) e capturar drawer pra confirmar visualmente.

### 2.12 Padronizar H1 mobile (M.3)

8 arquivos com `text-4xl`/`text-5xl` sem fallback: `users/upload.html`, `upload_preview.html`, `upload_processing.html`, `profile.html`, `hymns/hymnbook_list.html`, `account/login.html`, `signup.html`, `logout.html`. Trocar por `text-3xl md:text-4xl` (ou `text-3xl sm:text-4xl md:text-5xl` quando o design pede grande).

### 2.13 Confirmar tagline do footer

Grep `templates/_partials/_footer.html`. Já é "Hinários para ler, ouvir, cantar e guardar com firmeza." Verificar que está em todos os layouts.

## Marco 3 — 12 issues polish (~2h)

### 3.1 Decorações & glifos

- Glifo ✿/sun entre estrofes (`hymn_detail.html`) (#3.5)
- Watermark monograma "O" atrás do título do hinário hero (`hymnbook_detail.html`) (#2.4)
- Badge OCR/MANUAL nos cards do editor (`editor/hymnbook_list.html`) (#4.3)

### 3.2 Mini-player mobile fixo no rodapé (#9.3)

Quando há áudio aprovado e viewport < md, transformar `_audio_player.html` em mini-player `fixed bottom-0`. Variant condicional (CSS-only via media query ou JS).

**Skill `/frontend-design:frontend-design`** com input: "Mobile mini-player variant of `_audio_player.html` — fixed bottom, condensed layout, swipe-up to expand. Smooth transitions."

### 3.3 Validar modal de publicação (#6.1)

`apps/hymns/services/review.py::publish_readiness` já retorna 4 checks. Capturar modal abrindo com hino completo + comparar com page-06 do PDF. Ajustar styling se divergir.

### 3.4 Search refinements (#8.2, #8.3)

Tabs com contagem por tipo (atual mostra `(0)`/`(2)`); padronizar tipografia + spacing pra bater com design.

### 3.5 Profile heatmap legend posicionamento (#10.3)

`templates/users/profile.html` heatmap — labels "menos / mais" alinhadas embaixo nas extremidades, com tipografia label-mono.

### 3.6 Stepper microinterações (#7.x)

`_upload_stepper.html` — checkmark animado quando step completa, transição suave entre steps. Skill design para refinar.

## Sequência de execução

1. **Marco 1 → PR → CI verde → merge → `railway up`**. Esses são bugs em produção, devem ir rápido.
2. **Marco 2 → 2 PRs lógicos**:
   - PR-A: Profile (2.1, 2.2, 2.12) — toca `users/`
   - PR-B: Editor + Hymn detail (2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.11) — toca `hymns/`
   - PR-C: Visual cleanup (2.3, 2.10, 2.13) — pequeno, pode ir junto com B
3. **Marco 3 → 1 PR único** — polish acumulado.

A cada PR:
- `pytest tests/unit/` verde com testes novos
- `tests/e2e/validate_fase2.py` atualizado e verde
- Re-rodar `/tmp/audit_screens.py` em produção e comparar shots novos vs `/tmp/design-pages/`

## Arquivos críticos

- `templates/_partials/_header.html` (1.3, mobile menu)
- `templates/users/upload.html` (1.1, 7.x)
- `templates/hymns/hymnbook_detail.html` (1.2, 2.3, 3.1)
- `templates/hymns/hymn_detail.html` (1.4, 2.4, 2.5, 2.9)
- `templates/hymns/editor/revise_hymn.html` (1.5)
- `templates/hymns/editor/hymnbook_list.html` (2.6, 2.7, 2.8, 3.1)
- `templates/users/profile.html` + `templates/users/_partials/_notification_item.html` (novo) (2.1, 2.2, 2.12, 3.5)
- `templates/_partials/_hymnbook_card.html` (2.3)
- `apps/hymns/views.py::HymnBookDetailView` (1.2)
- `apps/users/views.py::profile_view` (2.1)
- `apps/hymns/editor_views.py` (2.6)
- `apps/hymns/templatetags/hymn_extras.py` (2.9)
- `static/css/components.css` (2.10)
- `static/js/mobile-menu.js` (novo) (1.3)
- `tests/unit/test_*.py` (todos os marcos)
- `tests/e2e/validate_fase2.py` (atualizar com mobile)

## Verificação end-to-end

Após Marco 1:
1. `https://hinaria.com.br/contribuir/` → sem `{# ... #}` literal
2. `https://hinaria.com.br/hinarios/o-justiceiro/?mode=corrido` → renderiza modo corrido sem JS
3. Mobile (DevTools 390px): hamburger funcional, hymn detail title não corta, revise hymn header readable
4. `pytest tests/unit/` 525+N verde

Após Marco 2:
5. Profile: notifications + recent revisions populados
6. Editor: banner Continuar revisão, stats inline, publish button
7. Hymn detail: sidebar com modo + DETALHES completos + repetições visíveis
8. Search highlight cor adequada

Após Marco 3:
9. Visual side-by-side com `_design/fase2-print.pdf` para 11 páginas, sem divergências significativas
10. Mobile mini-player funciona, modal de publicação valida 4 checks
