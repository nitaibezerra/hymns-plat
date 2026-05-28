# Handoff Claude Code — Fase 2.x · Revisões UX & Priorização Editorial

> **Copiar este arquivo para `hymns-plat/_plan/handoff-claude-code-fase2x.md` antes de iniciar a execução.**
>
> Este handoff complementa o plano original `_plan/plano-revisoes-ux-priorizacao-editorial.md`. Lê esse plano primeiro — ele tem o backend/queries/migrations. Este doc cobre apenas o **alvo visual final** (após rodada de design) e os **deltas em aberto** que não foram cobertos no plano original.

---

## TL;DR

| Bloco | Status | Ação |
|---|---|---|
| B1 — header "Fila de revisão" | ✅ implementado | Mover para CTA ao lado do avatar (não no nav central) — ver §4 |
| B2 — home featured determinístico | ✅ implementado | nada |
| B3 — painel staff em hymnbook_detail | ✅ implementado | **Redesign visual: strip horizontal compacta** — ver §3 |
| B4 — workspace cards + métricas + filtros | ❌ **a fazer** | Implementar do zero — ver §1 |
| B5 — input livre de estilo | ✅ implementado | nada |
| B6 — bug atalhos | ✅ implementado | nada |

**Mudanças escopo-extra (não estavam no plano original):**
- Remover `OCR/Diff vs OCR` toggle do `revise_hymn` (manter só "Escrever") — §5
- Remover `Origem` do `hymn_detail` (se existir) — §6
- Remover pill `OCR/Manual` (origem) do card do workspace — §1 (já no design)

---

## Onde está o design

Tudo está no projeto de design (separado deste repo). Os artefatos relevantes:

```
Hymns Platform Fase 2.html        # canvas raiz
screens/
  ├── _shared.jsx                 # AppBar (B1 + CTA header) + dados mock QUEUE
  ├── editor-queue.jsx            # B4 — workspace cards (visão de design completa)
  ├── hymnbook-detail.jsx         # B3 strip compacta + CTAs Tocar/Abrir
  ├── quick-review.jsx            # B5 (já implementado, mas confere visual)
  ├── revise-hymn.jsx             # estado pós-remoção do OCR/diff toggle
  └── hymn-detail.jsx             # estado pós-remoção do "Origem"
styles/
  ├── tokens.css                  # cores, tipografia, sombras
  └── components.css              # primitives: .pill, .btn, .progress, .editor-cta etc
```

Cores referenciadas abaixo via tokens CSS:
- `--vermilion` = `#b13e2e` (P1, alertas)
- `--gold` = `#b8893a`, `--gold-soft` = `#d9b06a` (P2, destaques)
- `--firmament` = `#1d3b6a` (links/CTAs primários)
- `--ink-mute` = `#6b6f85` (texto secundário, P3)
- `--rule` = `#c8bda1` (bordas)
- `--paper-soft` = `#efe6d2` (cards)

---

## §1 — Bloco 4: Workspace cards (`editor/hymnbook_list.html`)

### Visão atual (atual `templates/hymns/editor/hymnbook_list.html`)
- Linha horizontal com 5 colunas
- Barra única de progresso (`review_pct`)
- Sem badge de prioridade
- Sem filtro de prioridade
- Sort: só `least_reviewed | most_reviewed | recent`

### Visão alvo

**Layout**: Grid **vertical de 2 colunas** (`grid-cols-1 md:grid-cols-2 gap-5`), cards quadrados-altos.

**Anatomia de cada card** (de cima pra baixo):

1. **Header row** (`grid: auto 1fr auto`):
   - Badge numérico `01`, `02`, etc. — 48px, `rounded-lg`, gold quando idx=0
   - Nome do hinário (display 22px) + glifo "em destaque" (★ 8-pontas, gold, 18px) ao lado se `is_featured`
   - **Pill de prioridade** no canto direito (ver §1.1)
   - Linha 2 (sob o nome): `{owner_name} · subido {timesince} atrás` (serif italic mute, 13px)

2. **Bloco de 4 micro-barras** (gap 8px entre barras):
   ```
   REV   ▰▰▰▰▰▰▱▱▱▱   64%
   EST   ▰▰▰▰▰▰▰▰▱▱   78%
   REP   ▰▰▰▱▱▱▱▱▱▱   33%
   AUD   ▰▰▱▱▱▱▱▱▱▱   19%
   ```
   Grid `[32px 1fr 36px]` por linha. Track `bg-rule/50`, fill `bg-gold` (REV pode usar `bg-firmament` para distinguir como métrica primária). Label `font-mono text-[10px] tracking-[.12em] text-ink-mute`. Altura da barra: 6px, `rounded-[3px]`.

3. **Última atividade** (separador `border-t border-rule-soft pt-3.5`):
   ```
   ▰▰▱▰▰▱▰   Joana M. revisou 12 hinos    hoje, 14:22
   ```
   - **Sparkline mock** 56×16px à esquerda: 7 barras gold (atividade dos últimos 7 dias)
   - Texto: mono 11px, `text-ink-mute`, `who` em peso 500/`text-ink-soft`
   - Se `last_activity` é null: mostrar `Sem atividade ainda` em italic
   - **Para backend**: derivar de `Hymn.objects.filter(hymn_book=hb).order_by('-reviewed_at').first()` ou similar. Conta `n_hymns` revisados nos últimos 7 dias por essa pessoa.

4. **Botões de ação** (`grid: 1fr auto`):
   - Primary `Revisar próximo →` (firmament) OU `Publicar hinário ✓` (gold) se 100%
   - Secundário `⚡ Revisão ágil` (outline gold)
   - **Importante**: `event.stopPropagation()` no click — o card inteiro é `<a>` clicável

### §1.1 — Pill de prioridade

3 variantes:

| Level | Label visível | bg | text | border | Notas |
|---|---|---|---|---|---|
| P1 | `P1 Urgente` | `var(--vermilion)` | `var(--paper)` `#f6efe2` | mesmo | font-weight 600 |
| P2 | `P2 Atenção` | `var(--gold)` `#b8893a` | `#1a1d2e` (night) | mesmo | font-weight 600 |
| P3 | `P3` (só código) | transparent | `var(--ink-mute)` | `var(--rule)` | font-weight 400, baixo contraste |

CSS:
```css
.priority-pill {
  display: inline-flex; align-items: center;
  padding: 4px 10px; border-radius: 999px;
  font-family: var(--font-mono);
  font-size: 10px; letter-spacing: 0.12em;
  text-transform: uppercase; white-space: nowrap;
}
.priority-pill--p1 { background: var(--vermilion); color: var(--paper); border: 1px solid var(--vermilion); font-weight: 600; }
.priority-pill--p2 { background: var(--gold); color: #1a1d2e; border: 1px solid var(--gold); font-weight: 600; }
.priority-pill--p3 { background: transparent; color: var(--ink-mute); border: 1px solid var(--rule); }
```

Card com `priority=P1` ganha borda colorida sutil: `border-color: color-mix(in oklab, var(--vermilion) 25%, var(--rule))`.

### §1.2 — Filtros (acima da grid)

Duas dimensões **independentes e combináveis**, em duas linhas:

**Linha 1 — Ordenar** (chips):
- Menos revisados → `?sort=least_reviewed` (default)
- Mais revisados → `?sort=most_reviewed`
- **Menos áudios** → `?sort=least_audios` (novo)
- Recém adicionados → `?sort=recent`

**Linha 2 — Prioridade** (chips):
- Todas → `?priority=all` (default)
- P1 Urgente → `?priority=P1` (chip com dot vermilion quando inativo)
- P2 Atenção → `?priority=P2` (chip com dot gold quando inativo)
- P3 → `?priority=P3`

Os filtros se combinam. Ex.: `?sort=least_audios&priority=P1` lista hinários P1 ordenados por menos áudios.

Estado de chip ativo: `bg-ink text-paper border-ink`; inativo: `bg-paper text-ink-soft border-rule`.

### §1.3 — Métricas no manager

Estender `HymnBookQuerySet.with_review_progress()` para retornar `style_pct`, `reps_pct`, `audio_pct` além do `review_pct` atual. Usar **Subquery** (não Count com filter empilhado) para evitar cross-product entre JOINs — referência: padrão `_annotate_card_counts` em `apps/hymns/views.py`.

```python
def with_review_progress(self):
    from .models import Hymn

    style_subq = (
        Hymn.objects.filter(hymn_book=OuterRef("pk"))
        .exclude(style="")
        .values("hymn_book").annotate(c=Count("*")).values("c")
    )
    reps_subq = (
        Hymn.objects.filter(hymn_book=OuterRef("pk"))
        .exclude(repetitions="")
        .values("hymn_book").annotate(c=Count("*")).values("c")
    )
    audio_subq = (
        Hymn.objects.filter(
            hymn_book=OuterRef("pk"),
            audios__is_approved=True,
        ).values("hymn_book").annotate(c=Count("pk", distinct=True)).values("c")
    )
    return self.annotate(
        total_hymns=Count("hymns", distinct=True),
        reviewed_hymns=Count("hymns",
            filter=Q(hymns__review_status=Hymn.ReviewStatus.REVIEWED), distinct=True),
        in_review_hymns=Count("hymns",
            filter=Q(hymns__review_status=Hymn.ReviewStatus.IN_REVIEW), distinct=True),
        style_hymns=Coalesce(Subquery(style_subq, output_field=IntegerField()), 0),
        reps_hymns=Coalesce(Subquery(reps_subq, output_field=IntegerField()), 0),
        audio_hymns=Coalesce(Subquery(audio_subq, output_field=IntegerField()), 0),
    ).annotate(
        review_pct=_pct("reviewed_hymns", "total_hymns"),
        style_pct=_pct("style_hymns", "total_hymns"),
        reps_pct=_pct("reps_hymns", "total_hymns"),
        audio_pct=_pct("audio_hymns", "total_hymns"),
    )

def _pct(num, den):
    return Case(
        When(**{den: 0}, then=Value(0)),
        default=(F(num) * 100) / Coalesce(F(den), 1),
        output_field=IntegerField(),
    )
```

### §1.4 — View

Em `apps/hymns/editor_views.py::editor_hymnbook_list`:
- Ler `sort` e `priority` da query string (defaults: `least_reviewed`, `all`)
- Filtrar por priority se `priority in {"P1","P2","P3"}`
- Mapping de sort (adicionar `least_audios → order_by("audio_pct", "name")`)
- Adicionar `last_activity` por hinário no contexto (`{who, n, when}`) — ver §1 item 3

### §1.5 — KPI header

Adicionar um 4º KPI no header **"P1 URGENTE"** (count de hinários P1 visíveis), cor `var(--vermilion)`. Ordem sugerida: `P1 URGENTE · HINÁRIOS · PENDENTES · REVISADOS·7d`.

---

## §2 — Mudança no header (B1 visual)

**Atual**: "Fila de revisão" vive como item de nav central, lado a lado com "Início / Hinários / Buscar / Contribuir". Inintuitivo — é ferramenta de revisor, não nav público.

**Alvo**: "Fila de revisão" sai do nav e vira **CTA pill ao lado das ações da conta** (entre o search e o sino).

**Markup** (`templates/_partials/_header.html`):
```html
<nav>
  <a href="...">Início</a>
  <a href="...">Hinários</a>
  <a href="...">Buscar</a>
  <a href="...">Contribuir</a>
  {# Fila de revisão removida daqui #}
</nav>
<div class="search-mini">...</div>

{# CTA do revisor — só renderiza se o user tem permissão? Decidir. #}
<a href="{% url 'hymns:editor_hymnbook_list' %}"
   class="editor-cta {% if '/editor/' in request.path %}is-active{% endif %}">
  <svg>...</svg>  {# ícone de lista/fila #}
  <span>Fila de revisão</span>
  <span class="editor-cta-count">{{ editor_pending_count }}</span>
</a>

<button class="icon-btn">...</button>  {# notificações #}
<div class="avatar">...</div>
```

**Styles** (já estão em `styles/components.css` do design; portar para `static/css`):
```css
.editor-cta {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 7px 12px; border-radius: 999px;
  border: 1px solid color-mix(in oklab, var(--gold) 45%, var(--rule));
  background: color-mix(in oklab, var(--gold) 8%, var(--paper));
  color: color-mix(in oklab, var(--gold) 85%, var(--ink));
  font-size: 13px; font-weight: 500; white-space: nowrap; text-decoration: none;
  transition: background .15s, border-color .15s, color .15s;
}
.editor-cta:hover { background: color-mix(in oklab, var(--gold) 18%, var(--paper)); border-color: var(--gold); color: var(--ink); }
.editor-cta.is-active { background: var(--ink); border-color: var(--ink); color: var(--paper); }
.editor-cta-count {
  display: inline-grid; place-items: center;
  min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px;
  background: var(--gold); color: #1a1d2e;
  font-family: var(--font-mono); font-size: 10px; font-weight: 600; line-height: 1;
}
.editor-cta.is-active .editor-cta-count { background: var(--paper); color: var(--ink); }
```

**Contador**: usar `len(hymnbooks_with_pending_review)` ou similar. Se não houver pendentes, opcional esconder o badge.

**Visibilidade**: provavelmente só renderizar pra users com permissão de editor (`request.user.has_perm("hymns.can_review_any_hymnbook")` ou similar). Confirmar com a regra atual do `editor_hymnbook_list`.

---

## §3 — Painel staff em hymnbook_detail (B3 visual)

**Atual** (`templates/hymns/hymnbook_detail.html`, linhas 57-90): card-soft com form em coluna, label "Curadoria editorial · staff" + radios em linha + checkbox + botão "Salvar curadoria" cheio.

**Alvo**: **strip horizontal compacta** (uma linha só), sem card grande, sem textos explicativos.

Layout:
```
STAFF | Prioridade [P1 P2 P3 (segmented)] | ☐ Em destaque na home  ............  [Salvar]
```

Specs:
- Strip ocupa largura total do container, padding `12px 64px` (ou `py-3 px-6 max-w-6xl mx-auto`)
- Background `bg-paper-soft` + `border-b border-rule`
- Eyebrow `STAFF` (mono uppercase 11px tracking-wider)
- **Prioridade como segmented control inline** (não radios separados):
  - Container `inline-flex p-0.5 bg-paper border border-rule rounded-full`
  - Cada botão: ativo = `bg-{prio-color} text-{contrast}`; inativo = transparent + dot colorido pequeno (`6px circle`) à esquerda do label
  - Cores: P1 vermilion+cream, P2 gold+night, P3 ink-mute outline
- Checkbox "Em destaque na home" inline, `accent-gold`, label mono 11px
- Botão Salvar: ghost discreto (não primary), `text-xs px-3.5 py-1.5`

Sem descrições longas tipo "sobe à frente da fila e ganha destaque visual" — a label já comunica.

---

## §4 — Remover toggle Escrever/OCR cru/Diff vs OCR (`revise_hymn.html`)

**Atual** (linhas ~30-40 de `templates/hymns/editor/revise_hymn.html`):
```html
<section data-editor-pane data-active-view="write">
  <header>
    <p class="eyebrow">Editor · texto</p>
    <div class="flex gap-1" data-view-toggle role="tablist">
      <button data-view="write">Escrever</button>
      <button data-view="ocr">OCR cru</button>
      <button data-view="diff">Diff vs OCR</button>
    </div>
  </header>
  ...
```

**Ação**:
1. Remover o `<div data-view-toggle>` inteiro e todos os 3 botões
2. Remover os panes `data-view="ocr"` e `data-view="diff"` (se existirem como markup separado)
3. Remover do `static/js/editor-preview.js` (e similares) o código que troca o `data-active-view` — sempre `write`
4. Simplificar o header — só `<p class="eyebrow">Editor · texto</p>`

**Razão**: simplificação solicitada pelo time. OCR raw e diff não estavam sendo usados; manter só a edição direta.

---

## §5 — Remover "Origem" do hymn_detail (se aplicável)

**Verificar**: `templates/hymns/hymn_detail.html` tem alguma linha tipo:
```html
<div>Origem: {{ hymn.source }}</div>
```
ou um campo no card de metadata.

**Ação**: remover essa linha. O campo no model pode ficar (ainda útil em admin/relatórios), mas não aparece mais na UI pública.

Idem para o pill `OCR`/`Manual` no card do workspace (§1) — não renderizar mais.

---

## §6 — Estrutura hymnbook_detail/read (já implementada, só confirmar)

Já implementado em hymns-plat ✅:
- `hymnbook_detail.html` tem "Tocar hinário" (gold solid) + "Abrir hinário" (gold outline) no cover
- Não tem mais tabs "Modo de leitura" no detail
- `hymnbook_read.html` tem só `CORRIDO / CARROSSEL` (sem Índice)
- "Abrir hinário" leva pra `hymnbook_read?modo=corrido` (default)

Manter como está. Só confirma visualmente contra `screens/hymnbook-detail.jsx::HymnbookDetailScreen` e `HymnbookReadScreen`.

---

## §7 — Quick review e bug atalhos (já implementados)

Conferidos no código:
- `templates/hymns/editor/quick_review.html:65` tem `data-quick-style` input livre ✅
- `static/js/quick-review.js:181-184` ignora `INPUT|TEXTAREA|SELECT` e `isContentEditable` ✅

Nenhuma ação necessária.

---

## Ordem sugerida de implementação

1. **§3 painel staff** (rápido, isolado, valida que entendeu o vocabulário visual)
2. **§5 + §4** (remoções — limpa o terreno)
3. **§2 header CTA** (toca em todas as páginas, faça antes do B4 pra revisar nav junto)
4. **§1 B4 workspace** (o grande — manager queries + view + template + CSS)
5. **§1.5 KPI P1 URGENTE** (last)

## Arquivos a editar/criar (consolidado)

**Editar:**
- `templates/_partials/_header.html` — §2 (mover Fila de revisão para CTA)
- `templates/hymns/hymnbook_detail.html` — §3 (strip compacta)
- `templates/hymns/editor/hymnbook_list.html` — §1 (redesign completo)
- `templates/hymns/editor/revise_hymn.html` — §4 (remover toggle)
- `templates/hymns/hymn_detail.html` — §5 (remover Origem se existir)
- `apps/hymns/managers.py` — §1.3 (extend with_review_progress)
- `apps/hymns/editor_views.py` — §1.4 (filtro priority + sort least_audios + last_activity ctx)
- `apps/hymns/views.py` — §2 (talvez injetar `editor_pending_count` em context processor)
- `static/css/components.css` — adicionar `.editor-cta`, `.metric-bar`, `.priority-pill--*`, `.priority-chip`
- `static/js/editor-preview.js` — §4 (remover view toggle)

**Criar (testes):**
- `tests/unit/test_workspace_metrics.py` — anotações style_pct/reps_pct/audio_pct
- `tests/unit/test_workspace_filters.py` — sort=least_audios, priority=P1
- `tests/unit/test_header_cta.py` — link Fila de revisão fora do nav central

**NÃO criar:**
- Nova migration (0016 já existe)

---

## Notas finais

- **Auto-merge** habilitado nos PRs (per memory).
- Branch sugerido: `feature/workspace-cards-redesign` (ou um por bloco).
- Verificação manual: ver "Verificação manual" do plano original §4 (itens 4 e 5).
- **Não tocar** no pipeline OCR/audio, no player ou em settings críticos.
