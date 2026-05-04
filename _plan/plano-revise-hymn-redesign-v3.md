# Plano: Redesign tela "07 · Revisar Hino" — invert layout + preview ao vivo + audio review

> **TDD strict**: cada item tem teste vermelho ANTES da implementação, verde
> depois. Suíte unit + E2E Playwright sempre verde antes de PR. Bug existente
> capturado em teste de regressão antes do fix.

## Contexto

O design da tela de revisão de hino (07) foi profundamente repensado em `chat2.md`
do bundle (claude.ai/design). Resumo do que mudou no `revise-hymn.jsx` novo
(comparado ao que está em prod hoje, pós PR #27 + PR #30):

**Inversão de colunas + nova função da direita.** Hoje a esquerda mostra OCR/Diff
e a direita é o formulário; o usuário avaliou e concluiu que **a fonte de verdade
não é o OCR — é como o leitor vai ver o hino renderizado**. Então:

- **ESQUERDA = Editor (foco principal)**: número/título · atalhos de formatação ·
  textarea (ou OCR cru / Diff via toggle interno) · meta com chips de preset ·
  status segmentado.
- **DIREITA = Prévia + Áudio**: card "como o leitor verá", com barrinhas de
  repetição à esquerda das linhas agrupadas (estilo Hinaria.com.br) + linha
  ativa destacada (sincronia com o cursor do textarea) + bloco de **revisão
  de áudio** (player com waveform · "É mesmo essa gravação?" · qualidade 1-5 ·
  motivos para não-conferência).

A intenção declarada do user no chat: *"o foco aqui é o texto e como é
renderizado na página"* + *"talvez fazer sentido requerer do revisor um feedback
sobre a qualidade da gravação"*.

OCR/Diff continuam acessíveis mas viram **modos alternativos do editor**
(toggle "Escrever / OCR cru / Diff vs OCR" no topo da coluna esquerda).

## Bug regressivo do botão "Marcar revisado e avançar"

User reportou: clicar não avança automaticamente para o próximo hino.

**Root cause** (lido em `apps/hymns/editor_views.py:191-226`): o handler POST
salva o hino com `review_status` vindo do radio. Como a maioria dos hinos
chega com `review_status=in_review`, e o user normalmente NÃO clica explicito
em "Revisado ✓" antes de submeter, o save ocorre com `in_review`, e o redirect
para o próximo pendente acontece — **mas o hino atual continua não-revisado**.
Resultado prático: o user volta a ver o mesmo hino na próxima passada pela
fila, e nada nunca é marcado como revisado.

**Fix de semântica**: quando `next_action=="next"` (botão "Marcar revisado e
avançar"), forçar `review_status=REVIEWED` antes do save, ignorando o radio.
A radio fica como controle explícito para os outros casos (regredir para
não_revisado, voltar a in_review).

**Fix secundário (UX queue order)**: a query atual `.exclude(reviewed)
.order_by("number").first()` pode pular para um hino com número MENOR que o
atual se ele estiver pendente. UX correta: preferir o próximo `number > atual`
e só dar fallback wrap-around se não houver. Não muda o comportamento "nunca
fica preso", mas evita salto pra trás surpreendente.

**Mesmo fix aplica ao link "Pular sem salvar"** (`editor_next_hymn`) — usa o
mesmo método de queue ordering com `number > atual`, fallback first pending.

## O que está em prod hoje vs. o que precisa mudar

Baseline pós-PR #30 (lido agora):

- ✅ **Hymn.repetitions** já é CharField livre; **CANONICAL_REPETITIONS** já em
  formato range `("1-2,3-4", "1-2,3-4,1-4", "1-4", "3-4,1-4", "1-2,1-4")`.
  Nada para mudar no model.
- ✅ **CANONICAL_STYLES** = `("Marcha", "Valsa", "Mazurca")`. OK.
- ✅ Atalhos pills (`.shortcut-pill`), suggestion chips (`.chip-suggestion`),
  status segmentado vermilion/gold/moss, diff inline, kbd — **todas as classes
  CSS já existem**.
- ✅ `_compute_inline_diff()` e `_common_field_values()` já estão em
  `editor_views.py`.
- ✅ `HymnAudio.waveform_peaks` (JSONField) já populado pelo signal.
- ❌ **Layout invertido** — coluna direita atual precisa virar esquerda e vice-
  versa, com toggle "Escrever / OCR cru / Diff vs OCR".
- ❌ **Prévia renderizada** (carrossel-style) na direita — não existe.
- ❌ **Barrinhas de repetição** parseadas de `repetitions` — não existem.
- ❌ **Cross-pane line highlight** (caret no textarea ↔ linha na prévia) —
  não existe.
- ❌ **Bloco de audio review** — `HymnAudio` só tem `is_approved` boolean;
  faltam `is_match`, `quality_rating`, `quality_observations`,
  `mismatch_reason`, `reviewed_by`, `reviewed_at`.
- ❌ **Endpoint** para o audio review POST.
- ❌ **Bundle `_design/fase2-bundle/`** ainda tem o JSX antigo (datado May 3) —
  precisa ser substituído pelo extraído em `/tmp/design-fetch/hymns-platform/`.

## Decisões

### A. Replicação fiel do JSX, mas SSR-first + JS para live update

Toda a prévia é renderizada **server-side** no `revise_hymn.html` (zero flash de
conteúdo vazio), e um novo `static/js/editor-preview.js` re-renderiza a coluna
direita inteira sempre que `textarea[name=text]` ou `input[name=repetitions]`
mudam. JS lê os valores correntes desses campos, recompõe estrofes (split por
linhas em branco), recomputa as barrinhas de repetição e atualiza o markup. O
caret-tracking (linha ativa) é independente: escuta `keyup`/`click`/`select` no
textarea, calcula o índice da linha global, aplica `.preview-line.is-active`
no `[data-line="N"]` correspondente.

**Por que SSR + JS** (não SPA-style com React): manter consistência com o resto
do projeto (Tailwind CDN, sem Node build) e evitar flash de loading. A
duplicação de lógica (Python + JS) cobre só 2 funções pequenas: `parseReps()`
e `buildStanzas()`. O custo é baixo.

### B. Modelo `HymnAudio` ganha 6 campos de review

Migration `0014_hymnaudio_review_fields.py` adiciona:

- `is_match: BooleanField(null=True, blank=True)` — `True` (✓ confere) /
  `False` (✗ não confere) / `None` (não revisado ainda).
- `quality_rating: PositiveSmallIntegerField(null=True, blank=True,
  validators=[MinValue(1), MaxValue(5)])` — só preenchido quando `is_match=True`.
- `quality_observations: JSONField(default=list, blank=True)` — lista das
  observações marcadas (strings das chips).
- `mismatch_reason: CharField(max_length=20, blank=True, choices=...)` — só
  preenchido quando `is_match=False`. Choices: `OTHER_HYMN`, `INCOMPLETE`,
  `WRONG_LYRICS`, `INAUDIBLE`, `OTHER`.
- `reviewed_by: ForeignKey(User, null=True, blank=True, on_delete=SET_NULL,
  related_name="hymn_audio_reviews")`.
- `reviewed_at: DateTimeField(null=True, blank=True)`.

**Novas constantes class-level** em `HymnAudio`:

- `QUALITY_OBSERVATIONS = ("Ruído de fundo", "Voz baixa", "Cortes",
  "Excelente captação", "Mestre de cerimônias")`.
- `class MismatchReason(TextChoices)` com os 5 valores acima.

Decisão de modelo simples (1 review por audio, não tabela separada de histórico)
— para v1 é suficiente. Quando precisarmos de histórico de revisores ou
discussão entre eles, fazemos `HymnAudioReview` em PR futuro. **Bandeira**:
quando `is_match=False`, `is_approved` é coerced para `False` no save.

### C. Endpoint dedicado para audio review (não junta com o form principal)

Novo `editor_hymn_audio_review(request, hymn_pk, audio_pk)` em `editor_views.py`
aceita só `POST` e retorna `JsonResponse` (XHR pattern). Aceita os 4 sub-payloads:
`{is_match: true/false}`, `{quality_rating: 1..5}`,
`{quality_observations: [...]}`, `{mismatch_reason: "..."}`. Cada sub-payload
é um sub-recurso atualizável independente — o JS dispara um POST quando o user
clica em ✓/✗/rating/chip/motivo. A view valida, salva, retorna o estado novo.

Atalho: o **mesmo** view atualiza `reviewed_by=request.user` e `reviewed_at=now()`
em qualquer um dos 4 calls. Se `is_match` muda, limpa os campos da outra
vertente (ex: `is_match=True` zera `mismatch_reason`).

URL: `/editor/hinos/<int:hymn_pk>/audio/<int:audio_pk>/review/` em
`apps/hymns/urls_editor.py`.

### D. Preview rendering — repetition bars como `position:absolute` por estrofe

Cada estrofe (grupo de linhas separado por blank) é um `<div class="preview-stanza">`
com `position: relative; padding-left: 18px`. Cada linha não-branca dentro é um
`<div class="preview-line" data-line="<global-idx>">`. Para cada range
`{start, end}` parseado de `repetitions`, o JS computa `flatPositions` (mapa
de índice global → `{stanzaIdx, lineInStanza}`), e se `start..end` cabem
inteiramente em uma estrofe, insere uma `<div class="repetition-bar">`
absolutamente posicionada (`top = lineInStanza * lineHeight + 4`,
`height = (to-from+1) * lineHeight - 8`).

`lineHeight` lido via `getComputedStyle().lineHeight` para evitar magic number.
Se a range cruza fronteiras de estrofe ou tem índices inválidos, é ignorada
silenciosamente (mesma semântica que o JSX).

### E. Caret line highlight — events e mapping

Listeners no textarea: `keyup`, `click`, `select`. Cada um chama
`updateActiveLine()` que faz:
1. `pos = textarea.selectionStart`
2. `lineIdx = textarea.value.slice(0, pos).split("\n").length - 1`
3. Remove `.is-active` de todos `[data-line]`, adiciona em `[data-line="${lineIdx}"]`
4. Atualiza o status mono `Linha N de M` abaixo do textarea.

Note: `lineIdx` é o índice **global** considerando linhas em branco. As linhas
em branco não têm `[data-line]` correspondente na prévia, então elas não
destacam nada — comportamento desejado (linhas vazias do textarea ficam entre
estrofes).

### F. OCR/Diff continuam read-only no toggle

Quando `editorView` ≠ `"write"`, escondemos: a textarea, a fileira de atalhos,
e o status `Linha N de M`. O número/título/meta/status seguem visíveis sempre
(não dependem do view). Mostramos apenas o `<pre>` com OCR cru ou o diff inline
existente. Toggle implementado com classes `data-editor-view` no container e
`hidden` por CSS — sem JS pesado.

### G. Reutilizar `_audio_player.html`?

Não — o player do audio review é mais compacto (44px play button, sem título
de hino, sem créditos), e tem 2 controles novos (±10s, velocidade). Vou criar
`templates/hymns/editor/_audio_review.html` como partial dedicado, e
`static/js/audio-review.js` para a interação (play/pause, scrub, ±10s). O
waveform reaproveita o markup SVG do player existente (mesma estrutura
`<g><rect>...<clipPath>`) só que parametrizado pelo partial.

**Speed control (1×/1.25×/1.5×)**: `audio.playbackRate = N`, ciclar nos cliques.

### H. Tipografia do título da prévia: `font-serif`, NÃO `font-display`

Confirmado em `chat2.md`: o user explicitamente reclamou de `font-display`
(Cormorant Garamond) nos títulos do hino — *"o número tem um alinhamento mais
pra baixo e o hífem/travessão tem uma inclinação. Isso vai distrair a pessoa.
Use a mesma fonte do texto do hino"*. Então:

- **Inputs do editor** (número/título): mantém `font-display` (campos de
  formulário, não impactam a leitura).
- **Título da prévia** (`<h2>` no card): `font-serif` (Source Serif 4), 24px,
  weight 500, centralizado.
- **Body da prévia**: `font-serif` 17px line-height 1.55 (mesmo da carrossel
  atual).

## Arquivos

### 1. `_design/fase2-bundle/` — substituir bundle inteiro

`rsync -av --delete /tmp/design-fetch/hymns-platform/ _design/fase2-bundle/`

(O bundle baixado em `/tmp/design-fetch/hymns-platform/` tem o `revise-hymn.jsx`
novo + 2 chats atualizados + `docs/PLAYER_DESIGN.md` novo + screens novos
`player-a.jsx`, `player-scenes.jsx` que serão referência para PR futuro.)

### 2. `apps/hymns/models.py`

Adicionar em `HymnAudio`:

```python
class HymnAudio(models.Model):
    QUALITY_OBSERVATIONS = (
        "Ruído de fundo", "Voz baixa", "Cortes",
        "Excelente captação", "Mestre de cerimônias",
    )

    class MismatchReason(models.TextChoices):
        OTHER_HYMN = "other_hymn", "É outro hino"
        INCOMPLETE = "incomplete", "Áudio cortado/incompleto"
        WRONG_LYRICS = "wrong_lyrics", "Letra diferente"
        INAUDIBLE = "inaudible", "Áudio inaudível"
        OTHER = "other", "Outro"

    # ... campos existentes ...
    is_match = models.BooleanField(null=True, blank=True)
    quality_rating = models.PositiveSmallIntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    quality_observations = models.JSONField(default=list, blank=True)
    mismatch_reason = models.CharField(
        max_length=20, blank=True, choices=MismatchReason.choices,
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="hymn_audio_reviews",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if self.is_match is False:
            self.is_approved = False  # mismatch = nunca aprovado
            self.quality_rating = None
            self.quality_observations = []
        elif self.is_match is True:
            self.mismatch_reason = ""
        super().save(*args, **kwargs)
```

### 3. Migration `apps/hymns/migrations/0014_hymnaudio_review_fields.py`

Auto-gerar via `makemigrations`. Inclui os 6 campos novos. **Não** inclui
backfill — `is_match=None` por default em audios existentes (significa "não
revisado"), o que é o estado correto.

### 4. `apps/hymns/editor_views.py`

**Expandir `editor_revise_hymn` context** (linhas ~245-249):

```python
context.update({
    # ... existente ...
    "audio": hymn.audios.filter(is_approved=True).first()
             or hymn.audios.first(),  # canonical or first available
    "audio_mismatch_reasons": HymnAudio.MismatchReason.choices,
    "audio_observation_options": HymnAudio.QUALITY_OBSERVATIONS,
})
```

**Novo view `editor_hymn_audio_review`**:

```python
@login_required
@require_POST
def editor_hymn_audio_review(request, hymn_pk, audio_pk):
    hymn = get_object_or_404(Hymn, pk=hymn_pk)
    audio = get_object_or_404(HymnAudio, pk=audio_pk, hymn=hymn)
    if not can_edit_hymnbook(request.user, hymn.hymnbook):
        return HttpResponseForbidden()
    payload = json.loads(request.body or "{}")
    if "is_match" in payload:
        audio.is_match = bool(payload["is_match"])
    if "quality_rating" in payload:
        v = payload["quality_rating"]
        audio.quality_rating = v if v in {1,2,3,4,5} else None
    if "quality_observations" in payload:
        obs = payload["quality_observations"]
        valid = set(HymnAudio.QUALITY_OBSERVATIONS)
        audio.quality_observations = [o for o in obs if o in valid]
    if "mismatch_reason" in payload:
        v = payload["mismatch_reason"]
        valid = {c[0] for c in HymnAudio.MismatchReason.choices}
        audio.mismatch_reason = v if v in valid else ""
    audio.reviewed_by = request.user
    audio.reviewed_at = timezone.now()
    audio.save()
    return JsonResponse({
        "is_match": audio.is_match,
        "quality_rating": audio.quality_rating,
        "quality_observations": audio.quality_observations,
        "mismatch_reason": audio.mismatch_reason,
    })
```

URL em `apps/hymns/urls_editor.py`:
`path("hinos/<int:hymn_pk>/audio/<int:audio_pk>/review/", editor_hymn_audio_review, name="editor_hymn_audio_review")`.

### 5. `templates/hymns/editor/revise_hymn.html` — REESCRITA

Estrutura nova (resumida):

```django
<form ...>
  <header><!-- topbar slim com voltar / título / contador / pill em revisão --></header>
  <div class="editor-progress"><!-- barra gold gradient --></div>

  <div class="lg:grid lg:grid-cols-2">
    {# === LEFT: Editor === #}
    <section class="editor-pane lg:border-r lg:border-rule px-6 lg:px-10 py-8" data-editor-view="write">
      <div class="flex justify-between items-center">
        <span class="eyebrow">Editor · Texto</span>
        <div class="view-toggle" role="tablist">
          <button data-view="write" class="active">Escrever</button>
          <button data-view="ocr">OCR cru</button>
          <button data-view="diff">Diff vs OCR</button>
        </div>
      </div>

      {# Number + title (sempre visível) #}
      <div class="grid grid-cols-[88px_1fr] gap-3 mt-4">
        <input name="number" class="font-display text-2xl ..." value="{{ hymn.number }}">
        <input name="title"  class="font-display text-2xl ..." value="{{ hymn.title }}">
      </div>

      {# Write view #}
      <div data-view-pane="write">
        <div class="shortcuts-row">
          <span class="eyebrow">Atalhos</span>
          <button type="button" class="shortcut-pill" data-shortcut="strip-blanks">...</button>
          <button type="button" class="shortcut-pill" data-shortcut="paragraph" data-n="4">¶ a cada 4 linhas</button>
          <button type="button" class="shortcut-pill" data-shortcut="paragraph" data-n="3">¶ a cada 3 linhas</button>
        </div>
        <textarea name="text" class="font-serif text-base leading-relaxed">{{ hymn.text }}</textarea>
        <p class="caret-status mono muted">Linha <span data-caret-line>1</span> de <span data-caret-total>{{ hymn.text|line_count }}</span> · destaque sincronizado com a prévia →</p>
      </div>

      {# OCR view #}
      <pre data-view-pane="ocr" class="hidden ocr-raw">{{ hymn.ocr_text }}</pre>

      {# Diff view #}
      <div data-view-pane="diff" class="hidden diff-inline">
        {# inline diff existente — re-usa markup já em prod #}
        ...
      </div>

      {# Meta grid + status segmentado + change summary (sempre visível) #}
      ...
    </section>

    {# === RIGHT: Preview + Audio === #}
    <section class="preview-pane px-6 lg:px-10 py-8 bg-paper-soft" data-preview-root>
      <p class="eyebrow">Prévia · como o leitor vai ver</p>
      <article class="preview-card">
        <h2 class="preview-title font-serif">{{ hymn.number }} - {{ hymn.title }}</h2>
        <div class="preview-body" data-preview-body>
          {% for stanza in preview_stanzas %}
            <div class="preview-stanza">
              {% for line in stanza.lines %}
                <div class="preview-line" data-line="{{ line.global_idx }}">{{ line.text }}</div>
              {% endfor %}
              {% for bar in stanza.repetition_bars %}
                <div class="repetition-bar" style="top: {{ bar.top }}px; height: {{ bar.height }}px"></div>
              {% endfor %}
            </div>
          {% endfor %}
        </div>
        <div class="preview-glyph">✡</div>
      </article>

      {% if audio %}
        {% include "hymns/editor/_audio_review.html" with audio=audio %}
      {% else %}
        <div class="audio-empty">Sem gravação para este hino. <a href="...">Contribuir áudio</a></div>
      {% endif %}
    </section>
  </div>

  <footer class="action-bar"><!-- inalterado vs hoje --></footer>
</form>
```

**Helpers Python para o context** (em `editor_views.py` ou novo
`apps/hymns/services/preview.py`):

```python
def build_preview_stanzas(text: str, repetitions: str, line_height: int = 26) -> list[dict]:
    """Devolve estrofes prontas para template, com posições de barras pré-computadas."""
    # 1. split por linhas em branco
    # 2. atribuir global_idx por linha não-branca
    # 3. parse repetitions ("1-2,3-4") → ranges
    # 4. para cada range que cabe em uma estrofe, calcular bar.top/height
```

Tag/filtro `line_count` em `apps/hymns/templatetags/hymn_extras.py`:
`@register.filter def line_count(s): return len((s or "").split("\n"))`.

### 6. `templates/hymns/editor/_audio_review.html` — NOVO partial

```django
<section class="audio-review" data-audio-review-root data-hymn-id="{{ hymn.pk }}" data-audio-id="{{ audio.pk }}">
  <header class="flex justify-between">
    <span class="eyebrow">Revisão de áudio</span>
    <span class="mono muted text-xs">arquivo · {{ audio.audio_file.name|basename }} · {{ audio.duration|duration_mmss }}</span>
  </header>

  <div class="audio-player-row">
    <button type="button" class="audio-play-btn" data-audio-toggle>{# play/pause svg #}</button>
    <svg class="audio-waveform" data-audio-waveform>{# bars rendered from audio.waveform_peaks #}</svg>
    <button type="button" data-audio-skip="-10">«10</button>
    <button type="button" data-audio-skip="10">10»</button>
    <button type="button" data-audio-speed>1×</button>
    <audio src="{{ audio.audio_file.url }}" preload="metadata" data-audio-source></audio>
  </div>

  <div class="match-question">
    <div>
      <p>É mesmo a gravação de <em>"{{ hymn.title }}"</em>?</p>
      <p class="muted text-xs">Confirma se o áudio corresponde ao hino e à letra acima.</p>
    </div>
    <div>
      <button type="button" class="yesno-btn yes {% if audio.is_match %}is-active{% endif %}" data-audio-match="true">✓ Confere</button>
      <button type="button" class="yesno-btn no {% if audio.is_match is False %}is-active{% endif %}" data-audio-match="false">✗ Não confere</button>
    </div>
  </div>

  <div class="quality-block" data-quality-block {% if not audio.is_match %}hidden{% endif %}>
    <p>Qualidade da gravação</p>
    <div class="quality-stars">
      {% for n in "12345" %}
        <button type="button" class="quality-star {% if audio.quality_rating >= n|add:0 %}is-active{% endif %}" data-quality-rating="{{ n }}">{{ n }}</button>
      {% endfor %}
    </div>
    <div class="observations" data-observations>
      <span class="eyebrow">Observações</span>
      {% for obs in audio_observation_options %}
        <button type="button" class="chip-obs {% if obs in audio.quality_observations %}is-active{% endif %}" data-observation="{{ obs }}">{{ obs }}</button>
      {% endfor %}
    </div>
  </div>

  <div class="mismatch-block" data-mismatch-block {% if audio.is_match is not False %}hidden{% endif %}>
    <strong>Áudio sinalizado.</strong> Vai para a fila de revisão de moderador. Marque o motivo:
    <div>
      {% for value, label in audio_mismatch_reasons %}
        <button type="button" class="chip-reason {% if audio.mismatch_reason == value %}is-active{% endif %}" data-mismatch-reason="{{ value }}">{{ label }}</button>
      {% endfor %}
    </div>
  </div>
</section>
```

### 7. `static/css/components.css` — adicionar

Classes novas (sem remover existentes):

- `.editor-pane`, `.preview-pane` (substituem o `lg:grid-cols-2 gap-6` atual)
- `.view-toggle` + `.view-toggle button.active` (paper-soft pill com ink-active)
- `.preview-card` (paper bg, shadow-2, rounded-sm, padding 48px 56px)
- `.preview-title` (font-serif 24px, centered, mb-8)
- `.preview-body` (font-serif 17px, line-height 1.55, width:max-content, mx-auto)
- `.preview-stanza` (relative, padding-left 18px, mb 22px)
- `.preview-line` (padding 1px 8px, border-left 2px transparent, transition)
- `.preview-line.is-active` (background gold-soft 22%, border-left gold)
- `.repetition-bar` (absolute, left 4px, width 2px, ink-soft, rounded 1px)
- `.preview-glyph` (gold, italic font-display 18px, centered, mt 28px)
- `.audio-review` (paper card, padding 20px, border rule)
- `.audio-empty` (paper, dashed border)
- `.audio-play-btn` (44px round, firmament bg, paper text)
- `.audio-waveform` (height 32px, flex bars)
- `.match-question`, `.yesno-btn.yes` (moss), `.yesno-btn.no` (vermilion)
- `.quality-block`, `.quality-stars`, `.quality-star.is-active` (gold)
- `.observations`, `.chip-obs.is-active` (ink/paper)
- `.mismatch-block` (vermilion bg-tint, vermilion border)
- `.chip-reason` (vermilion outlined), `.chip-reason.is-active` (vermilion fill)
- `.caret-status` (mono ink-mute, fontsize 11px)
- `.ocr-raw` (mono 13px line-height 1.7, paper-soft, padding 24px)

### 8. `static/js/editor-preview.js` — NOVO

Responsabilidades:

```js
// On DOMContentLoaded
const textarea = document.querySelector('textarea[name="text"]');
const repsInput = document.querySelector('input[name="repetitions"]');
const previewBody = document.querySelector('[data-preview-body]');

function rerender() {
  const stanzas = buildStanzas(textarea.value);
  const ranges = parseReps(repsInput.value);
  previewBody.innerHTML = renderStanzasHtml(stanzas, ranges);
  updateActiveLine();
}

function updateActiveLine() {
  const idx = textarea.value.slice(0, textarea.selectionStart).split('\n').length - 1;
  document.querySelectorAll('[data-line].is-active').forEach(el => el.classList.remove('is-active'));
  const target = previewBody.querySelector(`[data-line="${idx}"]`);
  if (target) target.classList.add('is-active');
  document.querySelector('[data-caret-line]').textContent = idx + 1;
  document.querySelector('[data-caret-total]').textContent = textarea.value.split('\n').length;
}

textarea.addEventListener('input', rerender);
textarea.addEventListener('keyup', updateActiveLine);
textarea.addEventListener('click', updateActiveLine);
textarea.addEventListener('select', updateActiveLine);
repsInput.addEventListener('input', rerender);
// rAF debounce em rerender se ficar pesado
```

`buildStanzas`, `parseReps`, `renderStanzasHtml` espelham `build_preview_stanzas`
do Python, com lineHeight via `getComputedStyle()`.

### 9. `static/js/audio-review.js` — NOVO

```js
const root = document.querySelector('[data-audio-review-root]');
const audio = root.querySelector('[data-audio-source]');
const url = `/editor/hinos/${root.dataset.hymnId}/audio/${root.dataset.audioId}/review/`;

async function postReview(payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
    body: JSON.stringify(payload),
  });
  return res.json();
}

// Click handlers em [data-audio-match], [data-quality-rating], [data-observation],
// [data-mismatch-reason] → POST + atualiza UI (toggle is-active, mostra/esconde
// quality-block / mismatch-block)

// Player: data-audio-toggle (play/pause), data-audio-skip ±10, data-audio-speed
// (cicla 1x, 1.25x, 1.5x).
```

### 10. `tests/unit/test_editor_workspace.py` — atualizar

**Remover/adaptar testes existentes que fixam markup antigo da coluna esquerda
(OCR/diff)**:

- `TestRevisePerLineConfidenceSparkline` — reposicionado dentro de `[data-view-pane="ocr"]`
  ou `[data-view-pane="diff"]`; pode ficar visível só em modos OCR/Diff. Atualizar
  selector.
- `TestReviseInlineDiff` — markup do diff agora dentro de `[data-view-pane="diff"]`.
  Ajustar.
- `TestReviseTypographyAndLayout::test_two_col_full_bleed_layout` — assertions
  ainda válidas (`lg:grid-cols-2`, `lg:border-r`).

**Adicionar 4 classes novas**:

- `TestReviseEditorViewToggle`:
  - `test_three_view_buttons` — 3 botões `[data-view]` (write/ocr/diff)
  - `test_default_view_is_write` — `data-editor-view="write"` no `<section>`
  - `test_ocr_pane_initially_hidden` — `[data-view-pane="ocr"]` tem `hidden`

- `TestReviseLivePreview`:
  - `test_preview_body_renders_lines_with_data_line` — cada linha não-branca
    tem `[data-line="N"]`
  - `test_repetition_bars_for_simple_range` — `repetitions="1-2"` produz 1 barra
    com top/height calculados corretamente
  - `test_repetition_bars_for_two_ranges` — `repetitions="1-2,3-4"` produz 2 barras
  - `test_repetition_bars_skip_cross_stanza_range` — range `1-5` quando estrofe
    tem só 4 linhas → barra ignorada (vai para próxima estrofe)
  - `test_preview_title_uses_font_serif_not_display` — `<h2 class="...font-serif...">`
    no preview-title (regressão da queixa do user)

- `TestHymnAudioReviewModel`:
  - `test_is_match_true_clears_mismatch_reason` — set `is_match=False` + reason,
    depois `is_match=True`, save → reason vazio
  - `test_is_match_false_clears_quality` — set rating=5, depois `is_match=False`,
    save → rating=None, observations=[]
  - `test_is_match_false_forces_is_approved_false` — `is_match=False` + save →
    `is_approved=False`
  - `test_quality_rating_validators` — rating=0 raises, rating=6 raises

- `TestEditorHymnAudioReviewView`:
  - `test_post_is_match_true_updates_audio` — POST `{is_match: true}` → 200,
    audio refreshed has `is_match=True`, `reviewed_by=user`, `reviewed_at` set
  - `test_post_quality_rating_updates_only_when_match` — POST rating sem
    `is_match` → audio rating set (mas só efetiva se já tinha `is_match=True`)
  - `test_post_invalid_mismatch_reason_rejected` — `{mismatch_reason: "xxx"}`
    → reason fica vazio
  - `test_non_editor_user_forbidden` — anon ou user sem perm → 403
  - `test_get_method_not_allowed` — GET → 405

### 11. `tests/unit/test_hymn_models.py` — adicionar

`TestHymnAudioReviewFields` — testa que os 6 campos novos têm os tipos/defaults
corretos via introspection (`HymnAudio._meta.get_field("is_match").null == True`,
etc.). Migration smoke: testa que `0014` aplica sem erro num hino com audios
existentes.

## Sequência de execução (TDD strict)

Cada passo: **RED** (teste falhando), **GREEN** (implementação mínima até o
teste passar), eventualmente **REFACTOR**. Após cada step rodar
`pytest tests/unit/test_editor_workspace.py tests/unit/test_hymn_models.py -q`.

### 1. Bundle update + branch

`rsync /tmp/design-fetch/hymns-platform/ _design/fase2-bundle/`. Commit
isolado. `git checkout -b feat/revise-hymn-design-v3`.

### 2. Bug regressivo "Marcar revisado e avançar"

**RED** em `tests/unit/test_editor_workspace.py`:
```python
def test_next_action_next_forces_reviewed_even_if_radio_in_review(...):
    # POST com review_status=in_review (radio NÃO mudado) + next_action=next
    # Espera: hymn.review_status == REVIEWED após save (button promete isso)
    # Espera: redirect para próximo pendente
def test_next_action_next_prefers_higher_number(...):
    # Hinos 1, 2 (atual), 3, 4 — todos não-revisados
    # Click em hymn 2 → redirect para hymn 3 (não para hymn 1)
def test_next_action_next_falls_back_to_first_pending_when_no_higher(...):
    # User no último número, mas hymn 1 ainda pendente → vai pra 1
```

**GREEN** em `editor_views.py:editor_revise_hymn` POST handler:
- Se `next_action == "next"`: `hymn.review_status = REVIEWED` antes de save.
- Refatorar query de pending: nova função `_next_pending_hymn(hymn)` em
  `editor_views.py` que faz `filter(number__gt=hymn.number)` primeiro,
  fallback global. Reaproveita em `editor_next_hymn` (link "Pular sem salvar").

### 3. HymnAudio review fields

**RED** em `tests/unit/test_hymn_models.py` (`TestHymnAudioReviewFields`):
- 6 campos novos com tipos/null corretos.
- `is_match=False` força `is_approved=False`, zera quality fields.
- `is_match=True` zera `mismatch_reason`.
- `quality_rating` validators (1-5).

**GREEN**: adicionar campos em `models.py`, `MismatchReason` TextChoices,
`QUALITY_OBSERVATIONS` const, `save()` override. `makemigrations hymns` →
`0014_hymnaudio_review_fields.py`. `migrate`.

### 4. Endpoint editor_hymn_audio_review

**RED** em `tests/unit/test_editor_workspace.py` (`TestEditorHymnAudioReviewView`):
- POST `{is_match: true}` → 200, audio refresh tem is_match=True, reviewed_by
  setado.
- POST `{quality_rating: 4}` → quality_rating=4.
- POST `{quality_observations: ["Voz baixa"]}` → JSONField atualizado.
- POST `{quality_observations: ["XYZ"]}` → string inválida filtrada.
- POST `{mismatch_reason: "incomplete"}` → reason setado.
- POST `{mismatch_reason: "xxx"}` → reason vazio.
- Anon → 302 (login_required).
- Editor de outro book → 403.
- GET → 405.

**GREEN**: implementar view em `editor_views.py`, URL em `urls_editor.py`.

### 5. Preview stanzas service

**RED** em novo `tests/unit/test_preview_service.py` (`TestBuildPreviewStanzas`):
- Texto sem blanks → 1 estrofe com N linhas.
- Texto com blank duplo → 2 estrofes.
- Cada linha tem `global_idx` correto (pula blanks).
- `repetitions="1-2"` na primeira estrofe → 1 bar com `top, height` calculados.
- `repetitions="1-2,3-4"` em estrofe de 4 linhas → 2 bars.
- `repetitions="1-5"` quando estrofe tem 4 linhas → bar ignorado (cross-stanza).
- `repetitions="x-y"` lixo → ignorado, sem crash.

**GREEN**: criar `apps/hymns/services/preview.py::build_preview_stanzas(text,
repetitions, line_height_px=26)`.

### 6. Template inversion + view toggle markup

**RED** em `tests/unit/test_editor_workspace.py`:
- `TestReviseLayoutInversion`:
  - Editor pane (com `[data-editor-view]`) aparece **antes** do preview pane
    (com `[data-preview-root]`) no HTML — assert via `html.index()`.
  - Editor pane tem `lg:border-r` (não preview pane).
- `TestReviseEditorViewToggle`:
  - 3 botões `[data-view="write|ocr|diff"]`.
  - `[data-view-pane="write"]` visível por default; `ocr` e `diff` têm
    classe `hidden`.
- `TestReviseLivePreview`:
  - Cada linha não-branca tem `<div class="preview-line" data-line="N">`.
  - `repetitions="1-2,3-4"` em hino com 4 linhas em 1 estrofe → 2
    `.repetition-bar` no markup.
  - Título do preview usa `font-serif` (regressão da queixa do user em chat2).
- `TestReviseAudioReviewBlock`:
  - Quando hymn tem audio: `[data-audio-review-root]` no markup.
  - 2 botões `[data-audio-match="true|false"]`.
  - 5 botões `[data-quality-rating="1..5"]` dentro de `[data-quality-block]`.
  - 5 chips `[data-mismatch-reason="..."]` dentro de `[data-mismatch-block]`.
  - Quando hymn NÃO tem audio: `.audio-empty` com link "Contribuir áudio".

**GREEN**: reescrever `templates/hymns/editor/revise_hymn.html` + criar
partial `templates/hymns/editor/_audio_review.html`. Adicionar templatetag
`line_count` em `apps/hymns/templatetags/hymn_extras.py`.

### 7. CSS

Adicionar todas as classes novas em `static/css/components.css`. Sem testes
Python (estilo é validado por Playwright em #9). Mantém classes existentes.

### 8. JavaScript

Criar:
- `static/js/editor-preview.js` — re-render preview on text/reps change,
  caret highlight sync, view toggle.
- `static/js/audio-review.js` — player controls, review POSTs.

Atualizar `templates/hymns/editor/revise_hymn.html` para incluir os scripts
no fim. Manter `applyShortcut` e atalhos de teclado existentes (renomear
arquivo se ajudar legibilidade).

### 9. Playwright E2E — fluxo completo

Novo `tests/e2e/test_revise_hymn_v3.py` (Playwright sync API, padrão dos
demais E2E em `tests/e2e/`). Pré-requisito: `manage.py runserver --port 9000`
+ fixture com hymnbook + 3 hinos seed (ao menos 1 com OCR e 1 com áudio).

Casos de teste (todos no mesmo arquivo):

```python
class TestReviseScreenWorkflows:
    def test_layout_invertido(page, ...):
        # Editor pane fica à esquerda do preview no DOM
        # editor-pane.boundingBox.x < preview-pane.boundingBox.x

    def test_view_toggle_swaps_panes(page, ...):
        # default: pane "write" visível, "ocr"/"diff" hidden
        # click "OCR cru" → pane "ocr" visível, "write" hidden
        # click "Diff vs OCR" → pane "diff" visível

    def test_atalho_strip_blanks(page, ...):
        # textarea começa com "linha1\n\nlinha2"
        # click data-shortcut="strip-blanks" → textarea = "linha1\nlinha2"

    def test_atalho_paragraph_4(page, ...):
        # textarea com 8 linhas → click ¶4 → tem 1 blank entre as linhas 4 e 5

    def test_chip_repeticao(page, ...):
        # click [data-suggestion="1-2,3-4"] → input.value == "1-2,3-4"

    def test_chip_estilo(page, ...):
        # click [data-suggestion="Marcha"] → input.value == "Marcha"

    def test_repetition_bars_render_for_range(page, ...):
        # Set repetitions = "1-2,3-4", text = "a\nb\nc\nd"
        # → page.locator(".repetition-bar").count() == 2

    def test_caret_line_highlights_preview(page, ...):
        # textarea click on line 2 → preview-line[data-line="1"].is-active

    def test_status_segmentado_cor_por_estado(page, ...):
        # click "Em revisão" → background gold (rgb match)
        # click "Revisado" → background moss

    def test_autosave_debounce(page, ...):
        # type in title → wait 1.6s → [data-autosave-status] contém "Salvo"
        # request log contém POST com autosave=1

    def test_marcar_revisado_e_avancar_redirects_and_marks_reviewed(page, ...):
        # No hymn 1 (in_review). NÃO toca radio. Click "Marcar revisado e avançar"
        # → page.url contém /revisar/<hymn_2_pk>/
        # → backend: hymn 1 agora REVIEWED (assert via API ou refresh DB)

    def test_marcar_revisado_no_ultimo_volta_para_book_detail(page, ...):
        # Único hino não-revisado. Click button → URL é /editor/hinarios/<slug>/

    def test_pular_sem_salvar_link(page, ...):
        # Edit textarea (sem submit), click "Pular sem salvar"
        # → URL muda para próximo hino
        # → hymn original mantém texto antigo (não salvou)

    def test_atalho_teclado_enter_submits_as_reviewed(page, ...):
        # Press Enter fora de textarea → form submeted, hymn → REVIEWED, redirect
        # Press Enter dentro de textarea → quebra de linha, NÃO submete

    def test_atalho_teclado_cmdS_salva_rascunho(page, ...):
        # Press Cmd+S → form submeted com next_action=back, redirect para book detail

    def test_atalho_teclado_esc_pula(page, ...):
        # Press Esc → URL muda para próximo hino sem salvar

    def test_audio_review_yes_revela_quality(page, ...):
        # Hymn com audio. Click ✓ Confere → quality-block deixa de ter [hidden]
        # Click 4 estrelas → POST disparado, [data-quality-rating="4"] active
        # Click chip "Voz baixa" → POST, chip ativa
        # Refresh page → estado persiste

    def test_audio_review_no_revela_mismatch(page, ...):
        # Click ✗ Não confere → mismatch-block visível, quality-block hidden
        # Click chip "É outro hino" → POST, chip ativa
        # is_approved virou False (assert via API)

    def test_audio_review_empty_state(page, ...):
        # Hymn sem audio → .audio-empty com texto "Sem gravação para este hino"
        # Sem [data-audio-review-root] no DOM
```

Rodar: `poetry run pytest tests/e2e/test_revise_hymn_v3.py -v` (servidor em
:9000 obrigatório). Se algum caso falhar, voltar ao GREEN do passo
correspondente até passar.

### 10. Lint + smoke manual

```bash
poetry run black . && poetry run isort . && poetry run ruff check .
poetry run pytest tests/unit/ -q
poetry run python manage.py runserver 8001
# → /editor/hinos/<pk_de_hino_com_audio>/revisar/
```

### 11. PR + deploy + smoke prod

`git push -u origin feat/revise-hymn-design-v3`. `gh pr create` (título
≤70 chars, body com sumário + test plan). Aguarda 3 status checks (Lint, Unit,
E2E) ficarem verdes. Squash merge. Monitora `Deploy` workflow. Smoke
`https://hinaria.com.br/editor/hinos/<pk>/revisar/`.

## Verificação

```bash
cd /Users/nitai/dev/hyms-platform/hymns-plat

# Suíte completa
DJANGO_SETTINGS_MODULE=config.settings.test poetry run pytest tests/unit/ -q

# Migrations dry-run
poetry run python manage.py makemigrations --dry-run hymns

# Lint
poetry run black . && poetry run isort . && poetry run ruff check .

# Smoke local
poetry run python manage.py runserver 8001
# → /editor/hinos/<pk_de_hino_com_audio>/revisar/
```

## Fora de escopo (PRs futuros)

- **Player & Playback global** (capítulo enorme do `chat2.md` + `docs/PLAYER_DESIGN.md`):
  player persistente no `<App>`, fila, drawer, modo trabalho, sleep timer,
  karaokê, mediaSession API. PR separado, depois deste.
- **Repetition bars na Carrossel/Corrido/HymnDetail** — o user perguntou ao final
  do `chat2.md` *"Devo aplicar o mesmo padrão na tela 04 · Carrossel?"* e não
  respondeu explicitamente. Tratar como **não** por ora; aplicar quando confirmado
  num PR de consistência.
- **Histórico de revisões de áudio** (multiple reviewers) — modelo
  `HymnAudioReview` separado. v2.
- **Karaokê com timestamps** — exige timestamps no JSON do áudio. v3+.
- **Modo "PDF página"** (terceira view do editor) — depende de armazenar PDF
  original. Como o user mesmo disse: *"quero que simplifiquemos e desvinculemos
  o conceito de PDF da revisão do hino"*. Permanentemente fora.

## Decisões em aberto (perguntar ao user)

1. **`HymnAudio.audios.first()` como canonical** — quando há múltiplos áudios
   por hino, qual mostrar para revisão? Opções: (a) primeiro aprovado, fallback
   primeiro qualquer; (b) todos em sequência, revisor passa entre eles; (c)
   só o "canônico" (precisa novo flag). Plano default: (a). Confirmar.

2. **Tela com `is_match=False` ainda permite ouvir o áudio?** Pelo design sim
   (player permanece visível), só a UI vermilion sinaliza problema. OK.

3. **Velocidade do player**: 1× / 1.25× / 1.5× só, ou também 0.75× / 2×?
   Default plano: 4 valores `[1, 1.25, 1.5, 0.75]`. Ciclo no botão.
