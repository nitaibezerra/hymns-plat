# Plano: Refinamento do card do Workspace + revisão "básica" por completude

## Contexto

A primeira passada do Workspace Editorial (Fase 2.x, mergeada em PRs #47/#48) entregou cards 2-col com 4 micro-barras (REV/EST/REP/AUD), badge de prioridade, filtros e strip STAFF. Após uso real, três problemas concretos apareceram:

1. **Card visualmente ruidoso e desequilibrado.** O bloco "última atividade" (sparkline + "teste2e revisou 1 hino · 19h atrás") rouba atenção sem agregar à decisão "qual revisar?". Os dois CTAs estão desbalanceados — "Revisar próximo" usa firmament sólido full-width, "Revisão ágil" usa ghost gold compacto, criando uma hierarquia visual que **não corresponde à realidade do fluxo** (os dois caminhos têm valor equivalente, dependendo do contexto). E as 4 barras de métricas usam abreviações de 3 letras (`REV`, `EST`, `REP`, `AUD`) — só são decifráveis depois que alguém te explica.

2. **REV está semanticamente errado ao lado de EST/REP/AUD.** REV mede a flag `Hymn.review_status=REVIEWED` — um estado deliberado, marcado por humano após revisão formal. EST/REP/AUD medem **completude de preenchimento** — se o campo existe ou está vazio. Um hino pode estar `REVIEWED` sem áudio nenhum, ou ter os 3 campos preenchidos sem estar formalmente `REVIEWED`. Tratá-los como 4 barras paralelas borra essa distinção e leva o editor a interpretações erradas (ex: "mas se EST=60% por que REV=0%?").

3. **Não há rota dedicada para "revisão básica" (só preencher estilo/reps).** Hoje o botão "⚡ Revisão ágil" leva ao `editor_quick_review` que sempre começa no hino 1 e avança sequencialmente — inclusive em hinos que já têm estilo + repetições preenchidos. O usuário quer um caminho rápido que pule direto para hinos **com pelo menos um campo (estilo OU reps) faltando**, tanto no clique inicial quanto no save+next.

Outcome: card mais limpo, métricas legíveis e semanticamente honestas, dois caminhos de revisão (completa vs. básica) com peso visual equivalente e navegação otimizada para cada um.

---

## Decisões de design (aplicando princípios do frontend-design)

| Decisão | Escolha | Por quê |
|---|---|---|
| Bloco "última atividade" | **Remover totalmente** | Não influencia decisão "qual revisar"; ocupa ~14% da altura do card |
| Hierarquia entre os dois CTAs | **Pares — ambos firmament outline; cor de fundo só no hover** | Os dois fluxos têm valor equivalente; deixar o usuário escolher pelo contexto, não pelo destaque visual |
| Labels dos CTAs | **"Revisão completa"** (era "Revisar próximo") e **"Revisão básica"** (era "Revisão ágil") | "Completa" comunica que marca `review_status`; "básica" comunica que toca só os 2 campos de form |
| Layout dos botões | **Grid `1fr 1fr` com gap** (era `1fr auto`) | Pareamento visual real, não só nominal |
| Métrica REV | **Linha de destaque acima, com label palavra + contagem absoluta** ("Revisados · 12 de 30") | Separa visualmente da completude; pesa mais que cada uma das 3 abaixo |
| Métricas EST/REP/AUD | **Barras com labels-palavras** ("Estilo", "Repetições", "Áudios"), agrupadas sob um eyebrow "Completude" | Palavras > siglas; agrupamento sob eyebrow comunica que medem a mesma coisa (preenchimento) |
| Cor da barra REV | **firmament (atual)** — não muda | Já distinta de gold; reforça que é meta-flag |
| Cor das barras de completude | **gold (atual)** — não muda | Continuidade visual; só a apresentação muda |

### Esboço do card pós-refinamento

```
┌──────────────────────────────────────────────────────────────────┐
│ ┌──┐  E2E Test Book                                       ┌────┐ │
│ │OI│  E2E · subido 3 semanas atrás                        │ P3 │ │
│ └──┘                                                      └────┘ │
│                                                                  │
│  REVISÃO FORMAL ─────────────────                                │
│  Revisados · 0 de 30                  ▰▱▱▱▱▱▱▱▱▱   0%            │
│                                                                  │
│  COMPLETUDE DE CONTEÚDO ─────────                                │
│  Estilo                               ▰▱▱▱▱▱▱▱▱▱   0%            │
│  Repetições                           ▰▰▰▱▱▱▱▱▱▱  33%            │
│  Áudios                               ▰▱▱▱▱▱▱▱▱▱   0%            │
│                                                                  │
│  ┌──────────────────────┐  ┌────────────────────────┐            │
│  │  Revisão completa →  │  │  ⚡ Revisão básica →    │            │
│  └──────────────────────┘  └────────────────────────┘            │
└──────────────────────────────────────────────────────────────────┘
```

Eyebrows em `label-mono` (JetBrains Mono uppercase tracked) servem como "voz" organizacional. Hairlines sutis. Economia de tinta editorial — cada linha justifica sua existência.

---

## Mudanças por bloco

### Bloco 1 — Card: remover atividade, equilibrar botões, renomear

**`templates/hymns/editor/hymnbook_list.html`** (linhas 104–143):

1. **Remover** o bloco `<div class="queue-card-activity">…</div>` (linhas 113–126) inteiro — desde o `{# Última atividade …` até `{% endif %}`.

2. **Renomear** o botão primário (linha 138):
   - `Revisar próximo →` → `Revisão completa →`

3. **Renomear** o botão secundário (linha 142):
   - `⚡ Revisão ágil` → `⚡ Revisão básica`

4. **Mudar a URL** do botão secundário (linha 141) de `editor_quick_review` para `editor_next_incomplete` (nova rota — ver Bloco 3):
   - de `{% url 'hymns:editor_quick_review' hb.slug %}`
   - para `{% url 'hymns:editor_next_incomplete' hb.slug %}`

5. **Trocar classe do botão secundário** de `btn-ghost-gold` para uma nova classe `btn-outline-firmament` (alinhada visualmente com a primária) — ver CSS abaixo.

**`apps/hymns/editor_views.py`** (`editor_hymnbook_list`, linhas 154–166):

Remover a computação de `last_activity_by_book` e o anexo `hb.last_activity = …` no loop. Já não é usada no template após o Bloco 1.

**`static/css/components.css`**:

- `.queue-card-actions` (linhas 1088–1122): mudar `grid-template-columns: 1fr auto` para `grid-template-columns: 1fr 1fr`. Ambos os botões agora ocupam metade.
- Adicionar `.btn-outline-firmament` espelhando `.btn-primary-firmament` mas com `background: transparent; border: 1px solid var(--color-firmament); color: var(--color-firmament);` e `:hover { background: var(--color-firmament); color: var(--color-cream); }`. Mesmo `padding`, `border-radius`, `font-size`, `font-weight` da primária — peso visual equivalente.
- Remover (ou marcar como obsoletas) as classes `.queue-card-activity`, `.queue-card-spark`, `.queue-card-activity-text`, `.queue-card-activity-when`, `.queue-card-activity-empty` (linhas 1036–1085). A classe `.btn-ghost-gold` (linhas 1102–1122) continua viva — outros lugares podem usar — mas o card do workspace deixa de aplicar.

---

### Bloco 2 — Card: métricas redesenhadas (REV separado, completude com palavras)

**`templates/hymns/editor/hymnbook_list.html`** (linhas 104–110, bloco das 4 barras):

Substituir o `<div class="queue-card-metrics">` (uma seção plana com 4 `.metric-bar`) por **duas seções claramente delimitadas**:

```html
<div class="queue-card-metrics" data-queue-metrics>
  {# Revisão formal — flag de review_status, hierarquia maior #}
  <section class="metric-section metric-section--review">
    <header class="metric-section-eyebrow">Revisão formal</header>
    <div class="metric-bar metric-bar--rev" data-metric="rev">
      <span class="metric-bar-label">Revisados</span>
      <span class="metric-bar-count">{{ hb.reviewed_hymns|default:0 }} de {{ hb.total_hymns|default:0 }}</span>
      <span class="metric-bar-track"><span class="metric-bar-fill" style="width: {{ rev }}%;"></span></span>
      <span class="metric-bar-pct">{{ rev }}%</span>
    </div>
  </section>

  {# Completude de conteúdo — 3 campos preenchidos #}
  <section class="metric-section metric-section--completude">
    <header class="metric-section-eyebrow">Completude de conteúdo</header>
    <div class="metric-bar" data-metric="est"><span class="metric-bar-label">Estilo</span><span class="metric-bar-track"><span class="metric-bar-fill" style="width: {{ sty }}%;"></span></span><span class="metric-bar-pct">{{ sty }}%</span></div>
    <div class="metric-bar" data-metric="rep"><span class="metric-bar-label">Repetições</span><span class="metric-bar-track"><span class="metric-bar-fill" style="width: {{ rep }}%;"></span></span><span class="metric-bar-pct">{{ rep }}%</span></div>
    <div class="metric-bar" data-metric="aud"><span class="metric-bar-label">Áudios</span><span class="metric-bar-track"><span class="metric-bar-fill" style="width: {{ aud }}%;"></span></span><span class="metric-bar-pct">{{ aud }}%</span></div>
  </section>
</div>
```

**`static/css/components.css`** (próximo à zona das `.metric-bar`):

- **Novo grid de `.metric-bar`**: a barra REV ganha 4 colunas (`label | count | track | pct`) — `grid-template-columns: 110px auto 1fr 36px`. As de completude ficam com 3 (`label | track | pct`) mas com **label mais largo** porque agora cabe palavra (`grid-template-columns: 110px 1fr 36px` em vez do atual `32px 1fr 36px`).
- `.metric-section-eyebrow`: `label-mono`, `color: var(--color-ink-mute)`, `padding-bottom: 6px`, `border-bottom: 1px solid var(--color-rule-soft)`, `margin-bottom: 10px`.
- `.metric-section--review`: `margin-bottom: 16px` (separação clara da próxima seção).
- `.metric-bar--rev .metric-bar-label`: peso 500, font-family `font-sans`, font-size ~14px (mais ênfase que as outras).
- `.metric-bar--rev .metric-bar-count`: `label-mono`, `font-variant-numeric: tabular-nums`, `color: var(--color-ink-soft)`, font-size ~12px.
- Demais `.metric-bar-label` (Estilo/Repetições/Áudios): font-family `font-sans` (Inter Tight), font-size ~13px, color `var(--color-ink)`.

**Nota**: a label deixa de ser `label-mono` em letras maiúsculas (`REV`/`EST`/`REP`/`AUD`) para se tornar palavra real em sentence case (`Revisados`, `Estilo`, `Repetições`, `Áudios`). O eyebrow assume o papel de "voz monoespaçada" que organiza a seção.

**Testes a atualizar** — `tests/unit/test_workspace_metrics.py`:
- Asserções que casam string `REV`/`EST`/`REP`/`AUD` mudam para `Revisados`/`Estilo`/`Repetições`/`Áudios` (ou para o hook estável `data-metric=`).
- Adicionar asserção que `data-metric="rev"` aparece em `.metric-section--review` (não em `.metric-section--completude`).

---

### Bloco 3 — Nova rota "Revisão básica" → primeiro hino sem estilo OU sem reps

**`apps/hymns/editor_views.py`** — adicionar função `editor_next_incomplete` (copiar guard `@user_passes_test` ou decorator equivalente usado em `editor_next_hymn`):

```python
def editor_next_incomplete(request, slug):
    """Pula para o primeiro hino do hinário sem `style` OU sem `repetitions`,
    abrindo o quick_review já apontado para ele. Se todos têm os dois preenchidos,
    redireciona ao hymnbook_detail com mensagem flash."""
    hymnbook = get_object_or_404(HymnBook, slug=slug)
    incomplete = (
        hymnbook.hymns
        .filter(Q(style="") | Q(repetitions=""))
        .order_by("number")
        .first()
    )
    if incomplete is None:
        messages.info(request, "Todos os hinos deste hinário já têm estilo e repetições preenchidos.")
        return redirect("hymns:editor_hymnbook_detail", slug=hymnbook.slug)
    url = reverse("hymns:editor_quick_review", kwargs={"slug": hymnbook.slug})
    return redirect(f"{url}?h={incomplete.number}")
```

**`apps/hymns/urls.py`** — adicionar rota antes de `editor_quick_review`:

```python
path(
    "editor/hinarios/<slug:slug>/proximo-basico/",
    editor_views.editor_next_incomplete,
    name="editor_next_incomplete",
),
```

**Notas**:
- "Sem estilo OU sem reps" = `Q(style="") | Q(repetitions="")` — basta um faltar para o hino entrar na fila (literal do que o usuário pediu).
- Reaproveita o template `quick_review.html` existente — não precisa view nova; só uma porta de entrada com query corrigida.
- Replicar o decorator/guard usado em `editor_next_hymn` (`editor_views.py:323`).

**Testes** — `tests/unit/test_editor_next_incomplete.py` (novo):
- Hinário com 5 hinos: h1 (style+reps preenchidos), h2 (style vazio), h3 (reps vazio), h4 (ambos preenchidos), h5 (ambos vazios) → rota redireciona para `?h=2`.
- Hinário com todos completos → redireciona para `hymnbook_detail` com mensagem.
- Anon → 302 para login (já garantido pelo decorator, mas teste cobre).

---

### Bloco 4 — Quick review: save+next pula para próximo incompleto

**`apps/hymns/editor_views.py:286–297`** (POST do `editor_quick_review`):

Mudar a lógica de "próximo" de índice sequencial (atual: `hymns[idx+1]`) para "próximo hino incompleto, partindo do `current`":

```python
if request.method == "POST":
    form = QuickReviewForm(request.POST, instance=current)
    if form.is_valid():
        form.save()
    incomplete_qs = hymnbook.hymns.filter(
        Q(style="") | Q(repetitions="")
    ).exclude(pk=current.pk)
    next_h = (
        incomplete_qs.filter(number__gt=current.number).order_by("number").first()
        or incomplete_qs.order_by("number").first()
    )
    if next_h is None:
        messages.info(request, "Você completou estilo e repetições de todos os hinos deste hinário.")
        return redirect("hymns:editor_hymnbook_detail", slug=hymnbook.slug)
    url = reverse("hymns:editor_quick_review", kwargs={"slug": hymnbook.slug})
    return redirect(f"{url}?h={next_h.number}")
```

**Notas**:
- Wrap-around (procura `number__gt=current.number` primeiro, depois global) replica padrão do `_next_pending_hymn` (`editor_views.py:237`). Mantém UX consistente: o editor não cai numa tela morta se o restante do hinário está completo mas o início ainda tem buracos.
- Critério "incompleto" sempre = `Q(style="") | Q(repetitions="")`. Não inclui `audios` porque o quick_review só edita texto, não áudios.
- Form continua salvando independentemente — mesmo que o hino atual deixe de ser "incompleto" após o save, ele já foi consumido.

**Testes a atualizar** — `tests/unit/test_quick_review_*.py`:
- Existem testes que casam o redirect sequencial atual; precisam ser atualizados para o novo contrato (próximo incompleto, com wrap).
- Adicionar caso: começa no h3 incompleto, h4/h5 já completos, h1 incompleto → redireciona para `?h=1`.
- Adicionar caso: todos os hinos do hinário completos após o save → redireciona para `hymnbook_detail` com mensagem flash.

---

## Arquivos a editar/criar

**Editar:**
- `templates/hymns/editor/hymnbook_list.html` (Blocos 1 + 2)
- `apps/hymns/editor_views.py` (Bloco 1 cleanup, Bloco 3 nova view, Bloco 4 redirect novo)
- `apps/hymns/urls.py` (Bloco 3 — nova rota)
- `static/css/components.css` (Blocos 1 + 2 — `.queue-card-actions`, `.btn-outline-firmament`, `.metric-section*`, ajustes em `.metric-bar*`)

**Criar:**
- `tests/unit/test_editor_next_incomplete.py` (Bloco 3)

**Atualizar testes existentes:**
- `tests/unit/test_workspace_metrics.py` (Bloco 2 — strings novas, estrutura `data-completude`)
- `tests/unit/test_workspace_filters.py` (Bloco 1 — se algum teste casa "Revisar próximo" como string literal)
- `tests/unit/test_quick_review_*.py` (Bloco 4 — redirect agora alvo incompleto, não sequencial)
- `tests/e2e/test_workspace_fase2x.py` (Blocos 1 + 2 — possíveis quebras em selectors do bloco atividade que removemos, e nos labels REV/EST/REP/AUD)
- `tests/e2e/screenshots_fase2x.py` (script auxiliar — reusar para conferir o card pós-refinamento)

---

## Verificação manual

```bash
DJANGO_SETTINGS_MODULE=config.settings.local uv run python manage.py runserver 8000
```

1. **Card limpo** — `http://localhost:8000/editor/hinarios/`:
   - Card NÃO mostra mais "teste2e revisou 1 hino · 19h atrás".
   - Métricas estão em duas seções com eyebrows ("Revisão formal" / "Completude de conteúdo").
   - Label "Revisados" tem contagem absoluta ("X de Y") ao lado da palavra.
   - Labels de completude são palavras: Estilo, Repetições, Áudios.
   - Os dois botões têm tamanho e peso visual equivalente ("Revisão completa" / "⚡ Revisão básica").

2. **Revisão completa** — clique em "Revisão completa →": leva ao primeiro hino não-revisado (comportamento atual mantido — só o label mudou).

3. **Revisão básica** — clique em "⚡ Revisão básica →":
   - Se o hinário tem hinos com estilo OU reps vazios: abre `quick_review` no primeiro deles.
   - Se todos têm os 2 preenchidos: redireciona para o detail do hinário com flash "Todos os hinos…".

4. **Save+next no quick review**:
   - Abrir um hino incompleto, preencher um campo, salvar → pula para próximo hino com algum campo faltando (não o seguinte por número).
   - Quando esgotar (todos completos), redireciona para o detail do hinário com flash.

5. **Filtros e KPIs continuam funcionando** — `?priority=P1&sort=least_audios` mantém comportamento prévio (Fase 2.x).

---

## Trade-offs aceitos

1. **Remover atividade é definitivo** — perde-se sinal social ("alguém está trabalhando aqui"), mas o ganho de clareza compensa. Se reaparecer demanda, pode voltar como tooltip no badge de prioridade ou no detail do hinário.
2. **Wrap-around no quick_review save+next** — pode confundir o editor se ele acha que está avançando linearmente. Mitigação: o flash final ("você completou todos") é o sinal de fim.
3. **"Revisão básica" usa `style="" OR repetitions=""`** — basta um campo vazio para considerar incompleto. Hinos com 1 dos 2 preenchidos ainda aparecem. Outra interpretação razoável seria `AND` (mostrar só quem está totalmente vazio), mas o usuário pediu literalmente "OR".
4. **Labels deixam de ser monoespaçadas** — diminui um pouco o "DNA editorial" do card, mas legibilidade > flavor. O eyebrow recupera a voz mono na hierarquia acima.
5. **Sem nova URL no header / sem mudança no `editor_next_hymn`** — só renomeio visual e nova rota paralela. Linkagem externa não quebra.

---

## Notas operacionais

- Sem migration nova — campos `style`, `repetitions`, `review_status` já existem.
- Branch sugerido: `feature/workspace-card-refinement`.
- Auto-merge habilitado nos PRs (per memory).
- Após aprovação do plano, este arquivo deve ser copiado para `_plan/plano-workspace-card-refinement.md` (padrão do projeto).
