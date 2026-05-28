# Plano: revisões de UX e priorização editorial do Hinaria

## Contexto

Nova rodada de melhorias no `hinaria.com.br` cobrindo home, Workspace Editorial e Revisão Ágil. Quatro problemas reais hoje:

1. **Header**: o item "Editor" não comunica que aquele é o módulo central de revisão.
2. **Home — área "Em destaque"**: hoje mostra os 6 hinários mais recentemente criados (`order_by("-created_at")[:6]`). Sem curadoria, fica desinteressante e estático. Quero (a) marcar hinários como "em destaque" e (b) sortear deterministicamente 6 a cada hora, completando com não-destaques se houver menos de 6 marcados.
3. **Workspace Editorial**: a única métrica por hinário é o `% revisado` da revisão completa (`Hymn.review_status=REVIEWED`). A revisão ágil — que altera `style` e `repetitions` — não conta. Quero três métricas extras (estilo, repetições, áudios), mais um campo de **prioridade P1/P2/P3** e filtros multidimensionais (prioridade × ordenação).
4. **Revisão Ágil**: (a) não tem input livre para estilo fora dos 3 presets (Marcha/Valsa/Mazurca); (b) **bug**: atalhos 1/2/3/4 são interceptados mesmo quando o cursor está dentro de qualquer input que não seja `data-quick-reps`.

Outcome esperado:
- Header com label "Fila de revisão".
- Home com seção "Em destaque" curada e rotativa por hora.
- Cards do Workspace mostrando 4 métricas (revisão / estilo / repetições / áudios) + badge de prioridade. Nova ordenação "menos áudios"; novo filtro por prioridade.
- Painel administrativo no `hymnbook_detail` (visível só pra staff) para marcar destaque e prioridade.
- Revisão ágil com input livre de estilo (clicar preset preenche o input) e atalhos desabilitados dentro de qualquer `<input>`/`<textarea>`.

Parte deste plano será **executado por um agente Claude Code separado** (handoff). A seção `## Handoff Claude Code` no fim lista o subconjunto exato.

---

## Decisões confirmadas

| Decisão | Escolha |
|---|---|
| Label do header (substitui "Editor") | **"Fila de revisão"** |
| Quem edita `priority` e `is_featured` | **Django admin + painel staff dentro do `hymnbook_detail`** |
| Definição de "completude de áudios" | **% hinos com ≥1 áudio aprovado** |
| Estilo livre na revisão ágil | **Botões preenchem o input; input é source of truth** |
| Aleatoriedade da home | **Determinística por hora** (mesma seleção em toda a hora) |
| Estética dos cards do workspace | **4 micro-barras horizontais com `label-mono` (REV / EST / REP / AUD)**, badge de prioridade `P1/P2/P3` no canto superior direito |

---

## Visão de design — card do Workspace Editorial

Mantém estrutura `<a>` clicável, gradiente accent, número sequencial. Mudanças:

- **Badge de prioridade** (canto sup. direito):
  - `P1`: pill `bg-rust text-cream` (urgência) — `label-mono`
  - `P2`: pill `bg-gold text-night` (atenção)
  - `P3`: pill `border border-cream/25 text-cream/75 bg-transparent` (baixa — quase invisível)
- **Bloco de métricas** (substitui a barra única atual): 4 micro-barras horizontais com label-mono:
  ```
  REV   ▰▰▰▱▱▱▱▱▱▱   60%
  EST   ▰▰▰▰▰▰▰▰▱▱   80%
  REP   ▰▰▱▱▱▱▱▱▱▱   20%
  AUD   ▰▰▰▰▰▰▰▱▱▱   70%
  ```
  Adicionar `.metric-bar` em `components.css` (track `bg-cream/15`, fill `bg-gold`, altura 6px).
- **Botões de ação** mantidos: "Revisar próximo →" + "⚡ Revisão ágil".
- **Ordem visual**: nome/dono no topo, métricas no meio, botões na base.

---

## Mudanças por bloco

### Bloco 1 — Rename "Editor" → "Fila de revisão"

**Arquivo:** `templates/_partials/_header.html`
- Linha 17 (nav desktop): `Editor` → `Fila de revisão`
- Linha 84 (menu mobile): `Editor` → `Fila de revisão`

**Não alterar** o nome da URL (`hymns:editor_hymnbook_list`), nem o path `/editor/...` — só o label visível. Evita migração de URLs públicas.

**Testes a atualizar:** qualquer asserção textual no header que case `"Editor"` exato. Buscar em `tests/unit/` e `tests/e2e/`.

---

### Bloco 2 — Home featured determinístico

**Migration nova** — `apps/hymns/migrations/0016_hymnbook_priority_featured.py`:
- Adiciona `is_featured = BooleanField(default=False)`
- Adiciona `priority = CharField(max_length=2, choices=[("P1","P1"),("P2","P2"),("P3","P3")], default="P3")`

Ambos os campos servem aos Blocos 2 e 3.

**`apps/hymns/views.py` — `home_view`** (substitui a linha `order_by("-created_at")[:6]`):

```python
import random
from django.utils import timezone

def _hourly_featured(visible_qs, n=6):
    """Sample determinístico por hora: featured primeiro, completa com restantes."""
    now = timezone.now()
    seed = int(now.replace(minute=0, second=0, microsecond=0).timestamp())
    rng = random.Random(seed)

    featured_ids = list(visible_qs.filter(is_featured=True).values_list("id", flat=True))
    rng.shuffle(featured_ids)
    selected = featured_ids[:n]

    if len(selected) < n:
        rest_ids = list(visible_qs.exclude(id__in=selected).values_list("id", flat=True))
        rng.shuffle(rest_ids)
        selected.extend(rest_ids[: n - len(selected)])

    order = {pk: i for i, pk in enumerate(selected)}
    books = list(_annotate_card_counts(visible_qs.filter(id__in=selected)))
    books.sort(key=lambda b: order[b.id])
    return books

# ... dentro de home_view():
recent_hymnbooks = _hourly_featured(HymnBook.objects.visible_to(request.user), n=6)
```

Notas:
- Seed por hora cheia (`replace(minute=0, second=0, microsecond=0)`): muda automaticamente a cada hora.
- Caso `<6` hinários totais visíveis, retorna o que tiver (sem erro).
- Não renomear `recent_hymnbooks` no template ainda para evitar churn — uma melhoria futura é renomear pra `featured_books`.

**Teste novo** — `tests/unit/test_home_featured.py`:
- 8 hinários, 3 com `is_featured=True` → primeiros 3 vêm do conjunto featured (em ordem embaralhada deterministicamente), próximos 3 dos demais.
- Mock `timezone.now()` em dois momentos da mesma hora → mesma seleção.
- Mock em hora diferente → seleção diferente (na maioria dos casos; usar fixtures que garantam).

---

### Bloco 3 — `priority` e `is_featured` no admin + painel staff no `hymnbook_detail`

**`apps/hymns/admin.py`** — `HymnBookAdmin`:
- Adicionar `is_featured` e `priority` em `list_display`, `list_filter`, `list_editable`.

**`apps/hymns/forms.py`** — novo `HymnBookEditorialForm`:
```python
class HymnBookEditorialForm(forms.ModelForm):
    class Meta:
        model = HymnBook
        fields = ["priority", "is_featured"]
        widgets = {
            "priority": forms.RadioSelect(choices=[("P1","P1"),("P2","P2"),("P3","P3")]),
            "is_featured": forms.CheckboxInput(),
        }
```

**View nova** — `apps/hymns/views.py`:
- `HymnBookDetailView` injeta `editorial_form = HymnBookEditorialForm(instance=hymnbook)` no contexto **apenas se** `request.user.is_staff`.
- Nova URL POST `hymns:hymnbook_editorial_update` (`/hinarios/<slug>/editorial/`) — staff-only (decorator `@user_passes_test(lambda u: u.is_staff)`), salva o form e redireciona pro detail.

**`templates/hymns/hymnbook_detail.html`**:
- Bloco condicional `{% if request.user.is_staff %}` com card `card-soft` "Curadoria editorial" — radio 3 estados de prioridade + checkbox de destaque + botão "Salvar".
- Posicionar abaixo dos botões principais (Tocar/Abrir hinário), antes do sumário.

**Testes** — `tests/unit/test_hymnbook_editorial_panel.py`:
- Anon: painel não aparece.
- Staff: painel aparece e POST salva.
- Não-staff autenticado: 403/404 no POST.

---

### Bloco 4 — Métricas granulares no Workspace + filtros [HANDOFF]

**`apps/hymns/managers.py` — `HymnBookQuerySet.with_review_progress`**:

Estender para anotar 3 métricas extras (mantendo cuidado com cross-product entre JOINs — usar `Subquery`/`Coalesce` no estilo do `_annotate_card_counts`):

```python
def with_review_progress(self):
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
        reviewed_hymns=Count("hymns", filter=Q(hymns__review_status=Hymn.ReviewStatus.REVIEWED), distinct=True),
        style_hymns=Coalesce(Subquery(style_subq, output_field=IntegerField()), 0),
        reps_hymns=Coalesce(Subquery(reps_subq, output_field=IntegerField()), 0),
        audio_hymns=Coalesce(Subquery(audio_subq, output_field=IntegerField()), 0),
    ).annotate(
        review_pct=_pct("reviewed_hymns", "total_hymns"),
        style_pct=_pct("style_hymns", "total_hymns"),
        reps_pct=_pct("reps_hymns", "total_hymns"),
        audio_pct=_pct("audio_hymns", "total_hymns"),
    )
```

Onde `_pct(num, den)` é helper que retorna `Case(When(...=0, then=0), default=F(num)*100/F(den))`.

**`apps/hymns/editor_views.py` — `editor_hymnbook_list`**:
- Aceitar dois params independentes (combináveis):
  - `?sort=least_reviewed|most_reviewed|recent|least_audios` (default `least_reviewed`)
  - `?priority=all|P1|P2|P3` (default `all`)
- Mapping de `sort`:
  - `least_reviewed` → `order_by("review_pct", "name")`
  - `most_reviewed` → `order_by("-review_pct", "name")`
  - `recent` → `order_by("-created_at")`
  - `least_audios` (novo) → `order_by("audio_pct", "name")`
- Filtro de prioridade: `if priority in {"P1","P2","P3"}: qs = qs.filter(priority=priority)`.
- Manter compat: chamadas legadas sem `priority` ou com `?sort=` default seguem funcionando.

**`templates/hymns/editor/hymnbook_list.html`**:
- Barra de filtros: chips de ordenação + chips de prioridade (All/P1/P2/P3), renderizadas como links que preservam o outro param via query string.
- Card (linhas ~54-87) reescrito conforme "Visão de design" acima — 4 micro-barras + badge de prioridade.

**`static/css/components.css`** — adicionar:
```css
.metric-bar { height: 6px; border-radius: 3px; background: rgba(246, 239, 226, 0.15); overflow: hidden; }
.metric-bar > span { display: block; height: 100%; background: var(--color-gold); transition: width 200ms; }
.priority-pill--p1 { background: var(--color-rust); color: var(--color-cream); }
.priority-pill--p2 { background: var(--color-gold); color: var(--color-night); }
.priority-pill--p3 { background: transparent; color: rgba(246, 239, 226, 0.75); border: 1px solid rgba(246, 239, 226, 0.25); }
```

**Testes** — `tests/unit/test_workspace_metrics.py`:
- Hinário com 5 hinos, 3 com style preenchido → `style_pct=60`.
- 2 com áudio aprovado → `audio_pct=40`.
- `?sort=least_audios` ordena por `audio_pct` asc.
- `?priority=P1` filtra só hinários P1.
- Card no template contém as 4 barras + badge de prioridade.

---

### Bloco 5 — Revisão ágil: input livre de estilo + sync com presets [HANDOFF]

**`templates/hymns/editor/quick_review.html`** (após linha ~64, depois dos 3 botões de estilo):
```html
<input type="text" name="style" value="{{ current_hymn.style }}"
       data-quick-style placeholder="Ou digite um estilo (ex: Hino, Mestre)"
       class="w-full rounded-md border border-rule px-3 py-2 ...">
```
Mesmo padrão visual do input de repetições já existente.

**Atenção**: o template tem hoje um `<input type="hidden" name="style">` (ou similar) populado pelos botões M/V/Z. Trocar para `type="text"` visível e renomear o handler JS para escrever no input ao invés de em hidden field.

**`static/js/quick-review.js`**:
- Refatorar `setStyle()` para escrever no input `[data-quick-style]` ao invés de apenas um state interno; o input passa a ser source of truth.
- Atalhos M/V/Z preenchem o input com "Marcha"/"Valsa"/"Mazurca".
- No submit, form envia o valor literal do input (já funciona porque `name="style"`).
- Visual: botão preset fica "ativo" (`data-active=true`) se o valor do input coincide com o preset; deixa de ficar ativo se o usuário digita qualquer outro texto.

**`apps/hymns/forms.py` — `QuickReviewForm`**:
- Sem mudanças se já é `forms.ModelForm` com `fields = ["style", "repetitions"]` — ambos campos aceitam texto livre.

**Testes** — `tests/unit/test_quick_review_custom_style.py`:
- POST com `style="Hino"` custom salva no model.
- Template tem `data-quick-style` input.

---

### Bloco 6 — Bug atalhos de teclado em qualquer input

**`static/js/quick-review.js:172`** — substituir:
```javascript
// Antes (muito restritivo):
if (document.activeElement === repsInput) return;

// Depois (genérico):
var ae = document.activeElement;
if (ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) return;
if (ae && ae.isContentEditable) return;
```

**Outros JS com `keydown` global** (já têm guard correto per exploração — confirmar em revisão):
- `static/js/keyboard-shortcuts.js` ✓
- `static/js/hymn-carousel.js` ✓
- `static/js/player.js` ✓

**Teste E2E** — `tests/e2e/test_quick_review_input_typing.py`:
- Abrir `/editor/hinarios/<slug>/agil/`.
- Click no input `[data-quick-style]`.
- Digitar "12 Marcha" — esperar valor literal no input (não disparar atalho `1`).
- Click no input `[data-quick-reps]` — digitar "1-2,3-4" idem.

---

## Migrações

Uma única migration cobrindo Blocos 2+3:

```
apps/hymns/migrations/0016_hymnbook_priority_featured.py
  - AddField HymnBook.is_featured (BooleanField, default=False)
  - AddField HymnBook.priority (CharField, choices=P1/P2/P3, default=P3)
```

Sem data migration: defaults garantem comportamento atual (nenhum hinário featured, todos P3 = baixa). Curadoria começa em zero.

---

## Arquivos a editar/criar

**Editar:**
- `templates/_partials/_header.html` (Bloco 1)
- `apps/hymns/models.py` (Bloco 2/3 — campos)
- `apps/hymns/views.py` (Bloco 2 home_view + Bloco 3 detail + update view)
- `apps/hymns/admin.py` (Bloco 3)
- `apps/hymns/forms.py` (Bloco 3 — HymnBookEditorialForm)
- `apps/hymns/urls.py` (Bloco 3 — editorial_update route)
- `apps/hymns/managers.py` (Bloco 4 — `with_review_progress` + helper `_pct`)
- `apps/hymns/editor_views.py` (Bloco 4 — filtros)
- `templates/hymns/hymnbook_detail.html` (Bloco 3)
- `templates/hymns/editor/hymnbook_list.html` (Bloco 4 — filtros + card)
- `templates/hymns/editor/quick_review.html` (Bloco 5 — input estilo)
- `static/css/components.css` (Bloco 4 — `.metric-bar`, `.priority-pill--*`)
- `static/js/quick-review.js` (Blocos 5 + 6)

**Criar:**
- `apps/hymns/migrations/0016_hymnbook_priority_featured.py`
- `tests/unit/test_home_featured.py` (Bloco 2)
- `tests/unit/test_hymnbook_editorial_panel.py` (Bloco 3)
- `tests/unit/test_workspace_metrics.py` (Bloco 4)
- `tests/unit/test_quick_review_custom_style.py` (Bloco 5)
- `tests/e2e/test_quick_review_input_typing.py` (Bloco 6)

---

## Testes existentes a atualizar (TODOs no PR)

- `tests/unit/test_header*.py` (se existir) e qualquer E2E que case `"Editor"` exato no nav.
- `tests/unit/test_editor_*.py` — possivelmente regressar com novo shape da query string (`?priority=`).
- `tests/e2e/test_navigation.py` — verificar selector do header.

---

## Verificação manual

```bash
DJANGO_SETTINGS_MODULE=config.settings.local uv run python manage.py runserver 9000
```

1. **Header** — `/` mostra "Fila de revisão" no nav (desktop + mobile menu).
2. **Home featured** — `/` mostra 6 cards; abrir `python manage.py shell` e marcar 2 hinários `is_featured=True` → recarregar e ver esses 2 nos primeiros slots. Mockar `timezone.now()` para hora seguinte → ordem dos 6 muda.
3. **Detail painel staff** — login como staff → `/hinarios/a-alvorada/` mostra "Curadoria editorial" com radio P1/P2/P3 + checkbox destaque. Logout → painel some.
4. **Workspace** — `/editor/hinarios/`:
   - Cards mostram 4 barras (REV/EST/REP/AUD) + badge de prioridade colorida.
   - Filtro "P1" filtra; combinar com "Menos áudios" mantém ambos.
   - `?sort=least_audios` ordena hinários pelos com menor `audio_pct` primeiro.
5. **Revisão ágil** — `/editor/hinarios/<slug>/agil/`:
   - Input `data-quick-style` aparece abaixo dos 3 botões.
   - Click em "Marcha" preenche "Marcha" no input; submit salva.
   - Digitar "Hino do Mestre" no input e submit salva literal.
6. **Bug atalhos** — na mesma tela:
   - Click no input de repetições, digitar "1-2,3-4" — valor literal aparece.
   - Click no input de estilo, digitar "Marcha 12" — valor literal aparece (sem disparar atalho `1`/`2`).
   - Click fora dos inputs (em algum botão), apertar `M` → ativa Marcha.

---

## Trade-offs aceitos

1. **Seed por hora `timezone.now()`** — respeita `TIME_ZONE` do projeto; muda a cada hora cheia automaticamente.
2. **`is_featured` BooleanField simples** (não `featured_priority` int) — UI fica mais clara (toggle), perde-se ordenação manual entre featured. Suficiente porque ordem é randômica.
3. **Painel staff inline no detail** (não inline no workspace) — menos código, menos endpoints, mas exige um clique a mais para mudar prioridade vs. dropdown na lista. Aceitável no MVP.
4. **Métricas EST/REP medem "preenchido ≠ vazio"** — não distinguem "preenchido errado" vs. "preenchido certo". Reflete completude, não qualidade. É o que a revisão ágil rastreia hoje.
5. **Filtros usam query string simples** (não session) — share links funcionam direto, sem state oculto.
6. **Card do workspace fica mais denso** (4 barras + badge) — risco de poluição visual; mitigado pelo `label-mono` discreto e barras finas (`height: 6px`).
7. **Default `priority=P3` para todos** — workspace inicial "todos P3" parece sem prioridade. Tradeoff: explícito > implícito; staff decide quem sobe.

---

## Notas operacionais

- Após aprovação, copiar este plano para `_plan/plano-revisoes-ux-priorizacao-editorial.md` (padrão do projeto).
- Mudanças não tocam em deploy, settings críticos, ou pipeline OCR/audio.
- Migration 0016 é additive — seguro em produção sem downtime.
- Auto-merge habilitado nos PRs (per memory).

---

## Handoff Claude Code

Esta seção delimita o subconjunto do plano a ser executado por uma instância separada de Claude Code, conforme solicitado.

**Escopo do handoff** — Blocos 4 (Workspace métricas + filtros) e 5 (input livre estilo na revisão ágil) — porque são os blocos mais densos em backend (manager queries com Subquery) + frontend (redesign do card + filtros) e se beneficiam de um agente dedicado.

**Blocos retidos nesta sessão** (executar localmente, requerem menos coordenação):
- Bloco 1 — rename header (2 strings)
- Bloco 2 — home featured (1 view function + migration)
- Bloco 3 — admin + painel staff no detail (1 form + 1 view + 1 template block)
- Bloco 6 — bug atalhos (1 linha JS) — pode ir junto com o Bloco 5 no handoff, ou neste, conforme conveniência

**Para o agente Claude Code (Blocos 4+5+6):**
- **Pré-requisito**: migration 0016 (criada nos Blocos 2+3 desta sessão) já aplicada. Agente deve `git pull` e rodar `manage.py migrate` antes.
- Não criar nova migration; usar campos `priority`/`is_featured` já existentes.
- Reaproveitar padrão de Subquery do `_annotate_card_counts` em `apps/hymns/views.py` para evitar cross-product nos `Count(distinct=True)` empilhados.
- Manter compatibilidade com chamadas legadas do `editor_hymnbook_list` (sem `?priority=`).
- Atualizar `tests/unit/test_editor_*.py` existentes se quebrarem com nova query string.
- Branch sugerido: `feature/workspace-metrics-filtros`. PR com auto-merge squash.
- Verificação manual: ver seção "Verificação manual" itens 4, 5, 6.
