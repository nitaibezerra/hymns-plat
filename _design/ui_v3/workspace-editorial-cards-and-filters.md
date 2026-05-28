# Handoff · Workspace Editorial · cards de hinário, métricas e filtros multidimensionais

> Documento autocontido para implementação. Você tem acesso ao diretório
> `/Users/nitai/dev/hyms-platform/hymns-plat/` inteiro como artefato — não
> assume git nem PR. O que você produzir será revisado e mergeado pelo
> humano que te chamou.

---

## 0. Visão completa desta evolução

Esta tarefa é o **bloco final** de um batch de melhorias UX no Hinaria, fechado em um plano único: **`_plan/plano-revisoes-ux-priorizacao-editorial.md`** (leitura recomendada pra ver o arco completo).

### O problema raiz

O Workspace Editorial é o módulo mais usado e mais importante do Hinaria — é onde editores escolhem qual hinário trabalhar, qual fluxo de revisão usar, e quanto trabalho falta. Mas ele tinha 4 limitações sentidas no uso:

1. **Visibilidade tacanha**: existem dois fluxos reais de revisão (a "revisão completa" — que toca texto, áudio, status final; e a "revisão ágil" — que toca só `style` e `repetitions`). O card do workspace mostrava só o progresso da completa. A ágil — uma quantidade significativa de trabalho — era invisível nas métricas.
2. **Sem priorização**: todos os hinários eram iguais aos olhos da fila. Editores não tinham como sinalizar "esse aqui urge".
3. **Filtros lineares**: só uma dimensão de ordenação. Não dava pra cruzar "menos revisado dentro dos P1", ou "menos áudios dentro dos P1".
4. **Bug nominal**: o item de menu "Editor" não comunicava que aquele era o módulo de revisão; a home mostrava "em destaque" os 6 hinários mais recentes (sem curadoria); a revisão ágil capturava 1/2/3/4 dentro de inputs de texto.

### A visão unificadora

**Dar ao editor uma visão completa e priorizada do trabalho que falta, em múltiplos eixos.** Isso desdobra em:

- Curadoria editorial dos hinários (prioridade P1/P2/P3 + destaque na home) controlada por staff.
- Métricas granulares por hinário (4 dimensões: revisão completa, estilo, repetições, áudios).
- Filtros multidimensionais (prioridade × ordenação).
- Inputs livres onde o editor precisar deles (estilo na revisão ágil), sem que atalhos atrapalhem.
- Nomenclatura clara ("Fila de revisão", não "Editor").

### Os 6 blocos do batch

| Bloco | O que faz | Onde está hoje |
|---|---|---|
| 1 | Header: `Editor` → `Fila de revisão` | ✅ implementado (PR #46) |
| 2 | Home `Em destaque` rotativo + determinístico por hora; campo `is_featured` | ✅ implementado (PR #46) |
| 3 | Painel staff "Curadoria editorial" no `hymnbook_detail` + campo `priority` | ✅ implementado (PR #46) |
| **4** | **Workspace: 4 métricas no card + filtros multidimensionais** | **🎯 este handoff** |
| 5 | Revisão ágil: input livre de estilo (Marcha/Valsa/Mazurca preenchem) | ✅ implementado (PR #46) |
| 6 | Bug fix: atalhos 1/2/3/4 e M/V/Z não disparam dentro de inputs | ✅ implementado (PR #46) |

### Por que Bloco 4 é o coração

Os blocos 2, 3 e 5 criam **infraestrutura** (campos, flags, inputs). O Bloco 4 é onde a infraestrutura vira **experiência editorial**: o editor abre `/editor/hinarios/` e vê, em 1 segundo:
- Onde estão as urgências (badges P1 destacados).
- Em que dimensão cada hinário está atrasado (REV / EST / REP / AUD).
- Quais hinários precisam mais áudio (novo sort `least_audios`).
- Pode cruzar prioridade × dimensão (P1 + menos áudios) pra escolher trabalho.

Sem o Bloco 4, os campos `priority` e `is_featured` ficam visíveis só no admin/curadoria; as métricas de revisão ágil continuam invisíveis. Bloco 4 fecha o ciclo.

### Como ler o restante deste documento

A partir daqui o documento é executável: contexto técnico (seção 1), escopo exato (2), design (3), código copy-paste (4–6), testes (7), verificação (8), restrições (9), entregáveis (10). Se quiser olhar o arco maior antes de codar, abra `_plan/plano-revisoes-ux-priorizacao-editorial.md` — ele lista os trade-offs aceitos no batch inteiro.

---

## 1. Contexto rápido

**Projeto**: `hinaria.com.br` — portal editorial de hinários do Santo Daime. Django 5.x + Wagtail + Tailwind via CDN. Estética editorial / livro de cantador (cream/ink/firmament/gold/rust/moss, Cormorant Garamond + Source Serif 4 + Inter Tight).

**Workspace Editorial** é a "fila de revisão": página onde editores escolhem em qual hinário trabalhar. Cada hinário aparece como card numa lista densa, com nome, dono, e uma barra de progresso única (% revisado).

**Onde está hoje**:
- URL: `/editor/hinarios/`
- View: `apps/hymns/editor_views.py::editor_hymnbook_list` (linhas 98–127)
- Template: `templates/hymns/editor/hymnbook_list.html`
- Manager queryset: `apps/hymns/managers.py::HymnBookQuerySet.with_review_progress` (linhas 28–46)
- Card row: linhas 55–84 do template

**Modelo de dados relevantes** (`apps/hymns/models.py`):
- `HymnBook` tem hoje (já em produção): `is_published`, `is_featured`, `priority` (`P1`/`P2`/`P3`, default `P3`), `cover_image`, `accent_color`, etc.
- `Hymn` tem: `review_status` (`NOT_REVIEWED`/`IN_REVIEW`/`REVIEWED`), `style` (CharField livre), `repetitions` (CharField livre), e `audios` (reverso para `HymnAudio`).
- `HymnAudio` tem: `is_approved` (Boolean).

---

## 2. Escopo deste handoff

Sob foco: **Bloco 4** do plano `/_plan/plano-revisoes-ux-priorizacao-editorial.md` — métricas granulares no card do Workspace Editorial + filtros multidimensionais.

**Está fora do escopo (já implementado, não tocar)**:
- Header rename "Editor" → "Fila de revisão"
- Home `Em destaque` rotativo
- Painel staff "Curadoria editorial" no `hymnbook_detail`
- Migration 0016 (campos `is_featured` e `priority` já existem)
- Input livre de estilo na revisão ágil
- Bug fix dos atalhos de teclado em quick-review.js

**Está dentro do escopo (você implementa)**:

1. **Manager** — estender `HymnBookQuerySet.with_review_progress` para anotar 3 métricas extras: `style_pct`, `reps_pct`, `audio_pct`, sem cross-product nos JOINs.
2. **View** — `editor_hymnbook_list` aceita query strings combináveis:
   - `?sort=least_reviewed|most_reviewed|recent|least_audios` (default `least_reviewed`)
   - `?priority=all|P1|P2|P3` (default `all`)
3. **Template** — rewrite do card (linhas 55–84) com 4 micro-barras (REV / EST / REP / AUD) e badge de prioridade. Barra de filtros ganha chips de prioridade ao lado dos chips de ordenação. Chips preservam mutuamente o outro param via querystring.
4. **CSS** — adicionar `.metric-bar` e `.priority-pill--p1|p2|p3` em `static/css/components.css`.
5. **Testes** — unit suite em `tests/unit/test_workspace_metrics.py`.

---

## 3. Visão de design

### Card — antes (atual)

```
┌─────────────────────────────────────────────────────────────────┐
│ ●02  Hinário do Padrinho                       18/45 revisados  │
│      Padrinho Sebastião · subido há 3 dias     ████░░░░░ 40%    │
│                                                                 │
│                                       [Revisar próximo →]       │
│                                       [⚡ Revisão ágil       ]   │
└─────────────────────────────────────────────────────────────────┘
```

### Card — depois (a construir)

```
┌─────────────────────────────────────────────────────────────────┐
│ ●02  Hinário do Padrinho                         ┌────────┐     │
│      Padrinho Sebastião · subido há 3 dias       │   P1   │ ◀── badge rust (urgente)
│                                                  └────────┘     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ REV  ▰▰▰▰░░░░░░  40%      EST  ▰▰▰▰▰▰▰▰░░  80%         │   │
│  │ REP  ▰▰░░░░░░░░  20%      AUD  ▰▰▰▰▰▰▱░░░  60%         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                       [Revisar próximo →]       │
│                                       [⚡ Revisão ágil       ]   │
└─────────────────────────────────────────────────────────────────┘
```

- **Badge de prioridade** no canto superior direito (alinhado com o nome). Tamanho compacto, label-mono, espaçamento `px-2 py-0.5`.
  - `P1`: fundo `var(--color-rust)` (#B13E2E), texto `var(--color-cream)`.
  - `P2`: fundo `var(--color-gold)` (#B8893A), texto `var(--color-night)`.
  - `P3`: fundo transparente, borda `rgba(246,239,226,0.25)`, texto `rgba(246,239,226,0.75)` — quase invisível (P3 = baixa prioridade, não deve poluir).
- **Bloco de métricas**: 4 micro-barras horizontais em grid 2×2 (em telas md+) ou empilhadas (mobile). Cada uma com:
  - Label `label-mono` de 3 letras (REV / EST / REP / AUD).
  - Track fino (6px de altura, `bg-ink/10`, `rounded-full`).
  - Fill `bg-gold` (single tone — não diferenciar por métrica para evitar sobrecarga cromática).
  - Percentual numérico à direita: `font-mono text-xs`.
- **Botões e ações**: mantidos como hoje ("Revisar próximo" + "⚡ Revisão ágil"), à direita ou abaixo (decisão sua, mas preserve a relação visual atual).
- **Densidade**: o card pode ficar ~10–20% mais alto que o atual; é aceitável. Não comprima as 4 barras a ponto de virarem ilegíveis.

### Barra de filtros — antes (atual)

```
Ordenar:  [● Menos revisados]  [● Mais revisados]  [● Recém adicionados]   4 hinários
```

### Barra de filtros — depois (a construir)

```
Ordenar:    [● Menos revisados]  [● Mais revisados]  [● Recém adicionados]  [● Menos áudios]
Prioridade: [Todos]  [P1]  [P2]  [P3]
                                                                          4 hinários
```

- 2 linhas. Ambas mantêm a estética `btn-pill` existente (Tailwind utility class do projeto).
- Cada chip é um `<a href>` que muda só o parâmetro relevante na querystring, preservando o outro. Ex: estando em `?sort=recent&priority=P1`, clicar em "P2" leva pra `?sort=recent&priority=P2`.
- Chip ativo: `data-active="true"`. O CSS já existente em `static/css/components.css` para `.btn-pill[data-active="true"]` deve cobrir; se não, adicione.

### Notas de design

- Estética editorial fina, sem ruído. Evite cores "puxando atenção" nas barrinhas — single tone gold.
- A informação importante é o **conjunto** (4 barras juntas dão um perfil rápido do hinário). Não destaque uma sobre as outras.
- O badge P1 deve "chamar" o olho. P2 média atenção. P3 não chama nada.
- Manter a estética card-soft (já existe em `components.css`).

---

## 4. Implementação · backend

### 4.1 Manager (`apps/hymns/managers.py`)

Estender `with_review_progress` para anotar 3 métricas extras. **Atenção ao cross-product**: empilhar múltiplos `Count(filter=...)` na mesma query pode produzir contagens infladas se houver JOINs com áudios. Solução: usar `Subquery` para áudio (que envolve JOIN extra), `Count` direto pros campos de `Hymn` (mesmo nível).

```python
# apps/hymns/managers.py
from django.db.models import Case, Count, F, IntegerField, OuterRef, Q, Subquery, Value, When
from django.db.models.functions import Coalesce


def _pct(num: str, den: str) -> Case:
    """Helper: percentual inteiro de num/den, 0 quando den=0."""
    return Case(
        When(**{den: 0}, then=Value(0)),
        default=(F(num) * 100) / Coalesce(F(den), 1),
        output_field=IntegerField(),
    )


class HymnBookQuerySet(models.QuerySet):
    # ... published(), visible_to() inalterados ...

    def with_review_progress(self):
        """
        Anota total + 4 métricas por hinário, sem cross-product:
        - reviewed_hymns / review_pct (revisão completa: Hymn.review_status=REVIEWED)
        - style_hymns / style_pct      (revisão ágil: Hymn.style ≠ "")
        - reps_hymns / reps_pct        (revisão ágil: Hymn.repetitions ≠ "")
        - audio_hymns / audio_pct      (Hymn com ≥1 HymnAudio.is_approved=True)
        """
        from .models import Hymn, HymnAudio

        # Subquery para áudios — evita JOIN duplicado no `annotate` principal.
        audio_subq = (
            HymnAudio.objects
            .filter(hymn__hymn_book=OuterRef("pk"), is_approved=True)
            .values("hymn__hymn_book")
            .annotate(c=Count("hymn_id", distinct=True))
            .values("c")
        )

        return self.annotate(
            total_hymns=Count("hymns", distinct=True),
            reviewed_hymns=Count(
                "hymns",
                filter=Q(hymns__review_status=Hymn.ReviewStatus.REVIEWED),
                distinct=True,
            ),
            in_review_hymns=Count(
                "hymns",
                filter=Q(hymns__review_status=Hymn.ReviewStatus.IN_REVIEW),
                distinct=True,
            ),
            style_hymns=Count(
                "hymns",
                filter=~Q(hymns__style=""),
                distinct=True,
            ),
            reps_hymns=Count(
                "hymns",
                filter=~Q(hymns__repetitions=""),
                distinct=True,
            ),
            audio_hymns=Coalesce(Subquery(audio_subq, output_field=IntegerField()), 0),
        ).annotate(
            review_pct=_pct("reviewed_hymns", "total_hymns"),
            style_pct=_pct("style_hymns", "total_hymns"),
            reps_pct=_pct("reps_hymns", "total_hymns"),
            audio_pct=_pct("audio_hymns", "total_hymns"),
        )
```

**Por que `~Q(hymns__style="")` e não `~Q(hymns__style__isnull=True)`**: o campo é `CharField` no `Hymn` (não nullable). String vazia é o "não preenchido" canônico no projeto.

**Por que `distinct=True` em todos os Counts**: ao adicionar mais um Count com filtro complexo, o ORM precisa garantir que um hino não seja contado duas vezes por causa de algum JOIN.

### 4.2 View (`apps/hymns/editor_views.py`)

Substituir a lógica de `sort` em `editor_hymnbook_list` (linhas 107–114) por duas dimensões combináveis:

```python
# editor_views.py — dentro de editor_hymnbook_list, substituindo o bloco atual

VALID_SORTS = {"least_reviewed", "most_reviewed", "recent", "least_audios"}
VALID_PRIORITIES = {"P1", "P2", "P3"}

sort = request.GET.get("sort", "least_reviewed")
if sort not in VALID_SORTS:
    sort = "least_reviewed"
priority = request.GET.get("priority", "all")
if priority not in VALID_PRIORITIES:
    priority = "all"

qs = _editor_visible_books(request.user).with_review_progress()

if priority != "all":
    qs = qs.filter(priority=priority)

if sort == "most_reviewed":
    qs = qs.order_by("-review_pct", "name")
elif sort == "recent":
    qs = qs.order_by("-created_at")
elif sort == "least_audios":
    qs = qs.order_by("audio_pct", "name")
else:  # least_reviewed (default)
    qs = qs.order_by("review_pct", "name")
```

Depois injetar no contexto:
```python
context = {
    # ... existing keys ...
    "sort": sort,
    "priority": priority,
}
```

(Confirme com o contexto atual — `sort` já é passado hoje; apenas adicione `priority`.)

### 4.3 Compat

- Chamada legada sem `?priority=` → `priority="all"`, comportamento idêntico ao atual.
- `?sort=` com valor inválido → fallback `least_reviewed` (já era o comportamento do default branch).

---

## 5. Implementação · CSS (`static/css/components.css`)

Adicionar no final do arquivo (ou em uma seção `/* === Workspace Editorial — métricas e prioridade === */`):

```css
/* Micro-barra usada nos cards do workspace (REV/EST/REP/AUD). */
.metric-bar {
  height: 6px;
  border-radius: 9999px;
  background: rgba(26, 29, 46, 0.10);          /* ink @ 10% */
  overflow: hidden;
}
.dark .metric-bar {
  background: rgba(246, 239, 226, 0.10);       /* cream @ 10% no tema escuro */
}
.metric-bar > span {
  display: block;
  height: 100%;
  background: var(--color-gold, #B8893A);
  transition: width 220ms ease-out;
}

/* Badge de prioridade no card do workspace.
   Tamanho compacto pra não competir com o nome do hinário. */
.priority-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-family: var(--font-mono, "JetBrains Mono", ui-monospace, monospace);
  font-size: 0.6875rem;       /* 11px */
  letter-spacing: 0.12em;
  line-height: 1;
  text-transform: uppercase;
}
.priority-pill--p1 { background: var(--color-rust, #B13E2E); color: var(--color-cream, #F6EFE2); }
.priority-pill--p2 { background: var(--color-gold, #B8893A); color: var(--color-night, #1A1D2E); }
.priority-pill--p3 {
  background: transparent;
  color: rgba(246, 239, 226, 0.75);
  border: 1px solid rgba(246, 239, 226, 0.25);
}
/* Em tema claro, P3 precisa contraste com o card-soft. */
:not(.dark) .priority-pill--p3 {
  color: rgba(26, 29, 46, 0.55);
  border-color: rgba(26, 29, 46, 0.25);
}
```

Os tokens (`--color-gold`, `--color-rust`, `--color-cream`, `--color-night`, `--font-mono`) já estão definidos em `static/css/design-tokens.css`. Use as referências para `var()` ao invés de hex literais quando possível; os hex são fallback.

---

## 6. Implementação · template (`templates/hymns/editor/hymnbook_list.html`)

### 6.1 Barra de filtros (substituir linhas 46–52)

```django
<div class="mt-8 space-y-3">
  <div class="flex items-center gap-3 flex-wrap text-sm">
    <span class="label-mono">Ordenar:</span>
    <a href="?sort=least_reviewed&priority={{ priority }}" class="btn-pill"
       data-active="{% if sort == 'least_reviewed' %}true{% else %}false{% endif %}">● Menos revisados</a>
    <a href="?sort=most_reviewed&priority={{ priority }}" class="btn-pill"
       data-active="{% if sort == 'most_reviewed' %}true{% else %}false{% endif %}">● Mais revisados</a>
    <a href="?sort=recent&priority={{ priority }}" class="btn-pill"
       data-active="{% if sort == 'recent' %}true{% else %}false{% endif %}">● Recém adicionados</a>
    <a href="?sort=least_audios&priority={{ priority }}" class="btn-pill"
       data-active="{% if sort == 'least_audios' %}true{% else %}false{% endif %}">● Menos áudios</a>
  </div>
  <div class="flex items-center gap-3 flex-wrap text-sm">
    <span class="label-mono">Prioridade:</span>
    <a href="?sort={{ sort }}&priority=all" class="btn-pill"
       data-active="{% if priority == 'all' %}true{% else %}false{% endif %}">Todos</a>
    <a href="?sort={{ sort }}&priority=P1" class="btn-pill"
       data-active="{% if priority == 'P1' %}true{% else %}false{% endif %}">P1</a>
    <a href="?sort={{ sort }}&priority=P2" class="btn-pill"
       data-active="{% if priority == 'P2' %}true{% else %}false{% endif %}">P2</a>
    <a href="?sort={{ sort }}&priority=P3" class="btn-pill"
       data-active="{% if priority == 'P3' %}true{% else %}false{% endif %}">P3</a>
    <span class="ml-auto label-mono">{{ hymnbooks|length }} hinário{{ hymnbooks|length|pluralize }}</span>
  </div>
</div>
```

### 6.2 Card (substituir linhas 55–84)

```django
<ul class="mt-6 space-y-3">
  {% for hb in hymnbooks %}
    {% with review=hb.review_pct|default:0 style=hb.style_pct|default:0 reps=hb.reps_pct|default:0 audio=hb.audio_pct|default:0 %}
    <li>
      <a href="{% url 'hymns:editor_hymnbook_detail' hb.slug %}"
         class="card-soft p-5 flex flex-col gap-4 no-underline text-inherit hover:bg-ink/5 transition">
        {# === Cabeçalho do card: monograma + nome + badge prioridade === #}
        <div class="flex items-start gap-4">
          <div class="w-12 h-12 rounded-full inline-flex items-center justify-center font-display text-xl shrink-0"
               style="background: color-mix(in srgb, {{ hb.display_accent }} 18%, transparent); color: {{ hb.display_accent }};">
            {{ forloop.counter|stringformat:"02d" }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-display text-xl truncate">{{ hb.name }}</p>
            <p class="label-mono mt-1">
              {{ hb.owner_name }} · subido {{ hb.created_at|timesince }} atrás
            </p>
          </div>
          <span class="priority-pill priority-pill--{{ hb.priority|lower }}" aria-label="Prioridade {{ hb.priority }}">
            {{ hb.priority }}
          </span>
        </div>

        {# === 4 métricas em grid 2×2 (md+) ou empilhadas (mobile) === #}
        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <div class="flex items-center gap-3">
            <dt class="label-mono w-8 shrink-0">REV</dt>
            <div class="metric-bar flex-1"><span style="width: {{ review }}%;"></span></div>
            <dd class="font-mono text-ink-soft tabular-nums w-10 text-right">{{ review }}%</dd>
          </div>
          <div class="flex items-center gap-3">
            <dt class="label-mono w-8 shrink-0">EST</dt>
            <div class="metric-bar flex-1"><span style="width: {{ style }}%;"></span></div>
            <dd class="font-mono text-ink-soft tabular-nums w-10 text-right">{{ style }}%</dd>
          </div>
          <div class="flex items-center gap-3">
            <dt class="label-mono w-8 shrink-0">REP</dt>
            <div class="metric-bar flex-1"><span style="width: {{ reps }}%;"></span></div>
            <dd class="font-mono text-ink-soft tabular-nums w-10 text-right">{{ reps }}%</dd>
          </div>
          <div class="flex items-center gap-3">
            <dt class="label-mono w-8 shrink-0">AUD</dt>
            <div class="metric-bar flex-1"><span style="width: {{ audio }}%;"></span></div>
            <dd class="font-mono text-ink-soft tabular-nums w-10 text-right">{{ audio }}%</dd>
          </div>
        </dl>

        {# === Ações === #}
        <div class="flex flex-wrap items-center gap-2 ml-auto">
          {% if hb.review_pct == 100 and not hb.is_published %}
            <form action="{% url 'hymns:hymnbook_publish' hb.slug %}" method="post" onclick="event.stopPropagation()">
              {% csrf_token %}
              <button class="bg-firmament text-cream rounded-full px-4 py-2 text-sm font-medium hover:bg-firmament-2">Publicar hinário ✓</button>
            </form>
          {% else %}
            <a href="{% url 'hymns:editor_next_hymn' hb.slug %}"
               class="bg-firmament text-cream rounded-full px-4 py-2 text-sm hover:bg-firmament-2"
               onclick="event.stopPropagation()">Revisar próximo →</a>
          {% endif %}
          <a href="{% url 'hymns:editor_quick_review' hb.slug %}"
             class="border border-gold text-gold rounded-full px-3 py-1.5 text-xs font-mono uppercase tracking-widest hover:bg-gold/10"
             onclick="event.stopPropagation()">⚡ Revisão ágil</a>
        </div>
      </a>
    </li>
    {% endwith %}
  {% empty %}
    <li class="card-soft p-10 text-center text-ink-soft">Nenhum hinário disponível.</li>
  {% endfor %}
</ul>
```

**Padrões do projeto que estou reusando**:
- `card-soft`, `label-mono`, `btn-pill`, `font-display` → todos já existem em `components.css` ou na config Tailwind inline em `templates/base.html`.
- `display_accent` é uma `@property` no model `HymnBook` que devolve hex (palette ou `accent_color` custom).
- O wrapping no `<a>` toda a área clicável + `event.stopPropagation()` nos botões internos é o padrão atual — mantido.

---

## 7. Testes

Criar `tests/unit/test_workspace_metrics.py`:

```python
"""Workspace Editorial · métricas granulares + filtros multidimensionais.

Cobertura:
- Anotação do manager: total / reviewed / style / reps / audio + os 4 `_pct`.
- View: `?sort=` e `?priority=` independentes e combináveis; defaults estáveis.
- Template: 4 micro-barras + badge de prioridade renderizam.
"""

from __future__ import annotations

import pytest
from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse


def _audio():
    return SimpleUploadedFile("t.mp3", b"\xff\xfb\x90\x00" + b"\x00" * 100, content_type="audio/mpeg")


def _make_editor(user):
    user.groups.add(Group.objects.get(name="editor"))
    return user


@pytest.mark.django_db
class TestManagerAnnotations:
    def test_pct_style_and_reps_and_audio(self, hymn_book_factory, hymn_factory):
        from apps.hymns.models import HymnAudio, HymnBook

        hb = hymn_book_factory(name="Métrica")
        # 5 hinos: 3 com style, 2 com reps, 2 com áudio aprovado
        h1 = hymn_factory(hymn_book=hb, number=1, style="Marcha", repetitions="1-2,3-4")
        h2 = hymn_factory(hymn_book=hb, number=2, style="Valsa", repetitions="")
        h3 = hymn_factory(hymn_book=hb, number=3, style="Mazurca", repetitions="")
        hymn_factory(hymn_book=hb, number=4, style="", repetitions="1-4")
        hymn_factory(hymn_book=hb, number=5, style="", repetitions="")
        HymnAudio.objects.create(hymn=h1, audio_file=_audio(), is_approved=True)
        HymnAudio.objects.create(hymn=h2, audio_file=_audio(), is_approved=True)
        # 1 áudio NÃO aprovado — não deve contar
        HymnAudio.objects.create(hymn=h3, audio_file=_audio(), is_approved=False)

        ann = HymnBook.objects.with_review_progress().get(pk=hb.pk)
        assert ann.total_hymns == 5
        assert ann.style_hymns == 3 and ann.style_pct == 60
        assert ann.reps_hymns == 2 and ann.reps_pct == 40
        assert ann.audio_hymns == 2 and ann.audio_pct == 40

    def test_empty_book_returns_zero_percents(self, hymn_book_factory):
        from apps.hymns.models import HymnBook

        hb = hymn_book_factory(name="Vazio")
        ann = HymnBook.objects.with_review_progress().get(pk=hb.pk)
        assert ann.total_hymns == 0
        for pct in (ann.review_pct, ann.style_pct, ann.reps_pct, ann.audio_pct):
            assert pct == 0

    def test_no_cross_product_with_multiple_audios(self, hymn_book_factory, hymn_factory):
        """Hino com 2 áudios aprovados não deve contar 2× em audio_hymns."""
        from apps.hymns.models import HymnAudio, HymnBook

        hb = hymn_book_factory(name="No Cross")
        h = hymn_factory(hymn_book=hb, number=1, style="Marcha")
        HymnAudio.objects.create(hymn=h, audio_file=_audio(), is_approved=True)
        HymnAudio.objects.create(hymn=h, audio_file=_audio(), is_approved=True)
        ann = HymnBook.objects.with_review_progress().get(pk=hb.pk)
        assert ann.audio_hymns == 1


@pytest.mark.django_db
class TestSortAndPriorityFilters:
    def test_default_sort_least_reviewed(self, authenticated_client, hymn_book_factory, hymn_factory):
        from apps.hymns.models import Hymn

        _make_editor(authenticated_client.user)
        hb_low = hymn_book_factory(name="Low")
        hb_high = hymn_book_factory(name="High")
        hymn_factory(hymn_book=hb_low, number=1)  # 0% revisado
        h = hymn_factory(hymn_book=hb_high, number=1)
        h.review_status = Hymn.ReviewStatus.REVIEWED
        h.save()  # 100% revisado

        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_list"))
        books = list(resp.context["hymnbooks"])
        # menos revisados primeiro
        assert books[0].pk == hb_low.pk
        assert books[1].pk == hb_high.pk

    def test_sort_least_audios(self, authenticated_client, hymn_book_factory, hymn_factory):
        from apps.hymns.models import HymnAudio

        _make_editor(authenticated_client.user)
        hb_a = hymn_book_factory(name="Com Áudio")
        hb_b = hymn_book_factory(name="Sem Áudio")
        h_a = hymn_factory(hymn_book=hb_a, number=1)
        HymnAudio.objects.create(hymn=h_a, audio_file=_audio(), is_approved=True)
        hymn_factory(hymn_book=hb_b, number=1)  # sem áudio

        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_list") + "?sort=least_audios")
        books = list(resp.context["hymnbooks"])
        assert books[0].pk == hb_b.pk
        assert books[1].pk == hb_a.pk

    def test_filter_priority_p1(self, authenticated_client, hymn_book_factory):
        _make_editor(authenticated_client.user)
        hb_p1 = hymn_book_factory(name="P1 Lib", priority="P1")
        hymn_book_factory(name="P2 Lib", priority="P2")
        hymn_book_factory(name="P3 Lib", priority="P3")

        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_list") + "?priority=P1")
        slugs = [hb.slug for hb in resp.context["hymnbooks"]]
        assert slugs == [hb_p1.slug]

    def test_priority_and_sort_combine(self, authenticated_client, hymn_book_factory, hymn_factory):
        from apps.hymns.models import Hymn

        _make_editor(authenticated_client.user)
        hb_a = hymn_book_factory(name="P1 A", priority="P1")
        hb_b = hymn_book_factory(name="P1 B", priority="P1")
        hymn_book_factory(name="P2", priority="P2")
        # B tem 100% revisado, A tem 0%
        h_a = hymn_factory(hymn_book=hb_a, number=1)
        h_b = hymn_factory(hymn_book=hb_b, number=1)
        h_b.review_status = Hymn.ReviewStatus.REVIEWED
        h_b.save()
        # Sem revisar h_a

        url = reverse("hymns:editor_hymnbook_list") + "?priority=P1&sort=most_reviewed"
        resp = authenticated_client.get(url)
        slugs = [hb.slug for hb in resp.context["hymnbooks"]]
        assert slugs == [hb_b.slug, hb_a.slug]  # P1 + mais revisados primeiro

    def test_invalid_params_fall_back_to_defaults(self, authenticated_client, hymn_book_factory):
        _make_editor(authenticated_client.user)
        hymn_book_factory(name="X")
        resp = authenticated_client.get(reverse("hymns:editor_hymnbook_list") + "?sort=banana&priority=Z")
        assert resp.status_code == 200
        assert resp.context["sort"] == "least_reviewed"
        assert resp.context["priority"] == "all"


@pytest.mark.django_db
class TestCardRendering:
    def test_card_has_four_metric_bars(self, authenticated_client, hymn_book_factory, hymn_factory):
        _make_editor(authenticated_client.user)
        hb = hymn_book_factory(name="Render Test")
        hymn_factory(hymn_book=hb, number=1)
        body = authenticated_client.get(reverse("hymns:editor_hymnbook_list")).content.decode()
        # 4 micro-barras com classe .metric-bar
        assert body.count('class="metric-bar') >= 4
        # Labels REV/EST/REP/AUD presentes (qualquer ordem)
        for label in ("REV", "EST", "REP", "AUD"):
            assert f">{label}<" in body

    def test_card_shows_priority_badge(self, authenticated_client, hymn_book_factory):
        _make_editor(authenticated_client.user)
        hymn_book_factory(name="P1 Lib", priority="P1")
        hymn_book_factory(name="P2 Lib", priority="P2")
        body = authenticated_client.get(reverse("hymns:editor_hymnbook_list")).content.decode()
        assert "priority-pill--p1" in body
        assert "priority-pill--p2" in body

    def test_filter_chips_preserve_other_param(self, authenticated_client, hymn_book_factory):
        _make_editor(authenticated_client.user)
        hymn_book_factory(name="X")
        url = reverse("hymns:editor_hymnbook_list") + "?sort=recent&priority=P1"
        body = authenticated_client.get(url).content.decode()
        # Chip de prioridade "P2" mantém ?sort=recent
        assert "?sort=recent&priority=P2" in body
        # Chip de sort "least_reviewed" mantém ?priority=P1
        assert "?sort=least_reviewed&priority=P1" in body


class TestComponentsCssRules:
    def test_metric_bar_rules_present(self):
        from pathlib import Path

        css = (Path(__file__).resolve().parents[2] / "static/css/components.css").read_text(encoding="utf-8")
        assert ".metric-bar" in css
        assert ".priority-pill--p1" in css
        assert ".priority-pill--p2" in css
        assert ".priority-pill--p3" in css
```

> Os fixtures `hymn_book_factory`, `hymn_factory`, `authenticated_client` já existem em `tests/conftest.py`. O grupo `editor` é criado pela migration `0008_editor_group_and_perms.py`, então `Group.objects.get(name="editor")` funciona em qualquer teste com `@pytest.mark.django_db`.

---

## 8. Como rodar e verificar local

### Setup
```bash
# Em /Users/nitai/dev/hyms-platform/hymns-plat/
uv sync                                                      # se faltarem deps
docker compose up -d                                          # Postgres + Redis
DJANGO_SETTINGS_MODULE=config.settings.local uv run python manage.py migrate
DJANGO_SETTINGS_MODULE=config.settings.local uv run python manage.py runserver
```

### Smoke local
1. Crie um usuário staff/editor e logue.
2. Marque 1 hinário como P1 e outro como P2 via `/django-admin/hymns/hymnbook/`.
3. Em `/editor/hinarios/`:
   - Card deve mostrar badge P1 (rust) e P2 (gold).
   - 4 micro-barras visíveis em cada card.
   - Chip "P1" filtra; combinar com "Menos áudios" mantém ambos.
   - `?sort=least_audios` reordena.

### Testes
```bash
DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest tests/unit/test_workspace_metrics.py -v
DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest tests/unit/ -q       # full unit suite — não deve quebrar nada
```

### Lint (precisa passar pro CI)
```bash
uv run black .
uv run isort .
uv run ruff check .
```

---

## 9. Restrições importantes

1. **Não criar migration**. Os campos `priority` e `is_featured` já existem (`apps/hymns/migrations/0016_hymnbook_priority_featured.py`). Só usar.
2. **Não tocar em**:
   - `templates/_partials/_header.html` (rename já feito)
   - `apps/hymns/views.py` → `home_view` ou `_hourly_featured` (já feito)
   - `apps/hymns/forms.py` → `HymnBookEditorialForm` (já feito)
   - `static/js/quick-review.js` (já fixado)
   - `templates/hymns/editor/quick_review.html` (já refatorado)
3. **Compat URL**: chamada legada `GET /editor/hinarios/?sort=recent` (sem `priority=`) deve continuar funcionando, com `priority="all"` implícito.
4. **Não quebrar testes existentes**: rode `pytest tests/unit/ -q` ao final; meta é manter o resultado atual (855 passing) + os novos casos verdes.
5. **Estética**: 4 cores diferentes nas barrinhas é demais. Single gold tone para fill. A diferenciação vem do label (REV/EST/REP/AUD) + da posição.

---

## 10. Entregáveis esperados

Quando você terminar, os arquivos modificados serão:

```
apps/hymns/managers.py                                # +Subqueries +pct helper
apps/hymns/editor_views.py                            # +priority filter +least_audios sort
templates/hymns/editor/hymnbook_list.html             # +filter row +card redesign
static/css/components.css                             # +.metric-bar +.priority-pill--*
tests/unit/test_workspace_metrics.py                  # NOVO arquivo
```

Tudo verde no `pytest tests/unit/ -q` + lint passando.

Boa! Qualquer dúvida sobre tokens, padrões ou expectativas, leia o `CLAUDE.md` na raiz do projeto — ele tem o resumo das convenções (tipografia, paleta, branch protection, deploy).
