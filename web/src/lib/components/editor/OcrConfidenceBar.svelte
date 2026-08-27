<script lang="ts">
  /**
   * Sub-marco 5.C — Ciclo 5C.4.
   *
   * Sparkline de fidelidade do OCR: uma barra por linha de
   * `HymnType.ocrLineConfidences`. O backend não guarda confiança do
   * Tesseract por linha — o número é a similaridade entre a linha do OCR e a
   * linha mais próxima do texto revisado (`_compute_ocr_line_confidences`).
   * Editorialmente é o sinal útil: mostra onde o OCR errou mais.
   *
   * Paridade com `.ocr-confidence-sparkline` de `static/css/components.css`
   * (altura 36px, gap 4px, `low`/`mid`/`high` em rust/gold/moss). Os cortes
   * das faixas não estão fixados em nenhum lugar do Django; adotamos
   * `< 60` low, `60-84` mid, `>= 85` high.
   */
  let { confidences = [] }: { confidences?: number[] } = $props();

  const LOW_MAX = 60;
  const MID_MAX = 85;

  function clamp(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(100, Math.max(0, Math.round(value)));
  }

  function level(value: number): "low" | "mid" | "high" {
    if (value < LOW_MAX) return "low";
    if (value < MID_MAX) return "mid";
    return "high";
  }

  let bars = $derived(
    confidences.map((raw, index) => {
      const score = clamp(raw);
      return { line: index + 1, score, level: level(score) };
    }),
  );

  let average = $derived(
    bars.length === 0 ? 0 : Math.round(bars.reduce((sum, bar) => sum + bar.score, 0) / bars.length),
  );
</script>

{#if bars.length === 0}
  <p class="ocr-empty" data-testid="ocr-empty">Sem OCR para este hino.</p>
{:else}
  <div class="ocr-confidence" data-testid="ocr-confidence">
    <div class="ocr-sparkline" role="img" aria-label="Fidelidade do OCR por linha">
      {#each bars as bar (bar.line)}
        <div
          class="ocr-bar"
          data-testid="ocr-bar"
          data-level={bar.level}
          style="height: {bar.score}%"
          title="Linha {bar.line} · {bar.score}% de fidelidade do OCR"
        ></div>
      {/each}
    </div>
    <p class="ocr-average" data-testid="ocr-average">Fidelidade média do OCR · {average}%</p>
  </div>
{/if}

<style>
  .ocr-empty,
  .ocr-average {
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    letter-spacing: 0.06em;
  }

  .ocr-average {
    margin-top: 0.375rem;
  }

  .ocr-sparkline {
    align-items: flex-end;
    display: flex;
    gap: 4px;
    height: 36px;
  }

  .ocr-bar {
    border-radius: 2px 2px 0 0;
    flex: 1;
    min-height: 4px;
    min-width: 4px;
    opacity: 0.85;
    transition: opacity 120ms;
  }

  .ocr-bar:hover {
    opacity: 1;
  }

  .ocr-bar[data-level="low"] {
    background: var(--color-status-not);
  }

  .ocr-bar[data-level="mid"] {
    background: var(--color-status-mid);
  }

  .ocr-bar[data-level="high"] {
    background: var(--color-status-ok);
  }
</style>
