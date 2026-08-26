<script lang="ts">
  /**
   * Marco 5.B — Ciclo 5B.7.
   *
   * Micro-barra de progresso, em paridade com `.metric-bar` do monolito:
   * rótulo · contagem absoluta opcional · trilho · percentual em mono.
   *
   * Duas cores, com significado: `review` usa o azul litúrgico porque é a
   * métrica que fecha o hinário; `content` usa ouro porque completude de
   * conteúdo é secundária.
   *
   * O percentual chega PRONTO de `HymnBookType.reviewProgress` (5.A½) — o
   * cliente não recalcula progresso. A única defesa local é o clamp em
   * 0-100: um valor fora da faixa viraria uma barra vazando o trilho.
   */
  let {
    label,
    pct,
    count = null,
    tone = "content",
  }: {
    label: string;
    pct: number;
    count?: string | null;
    tone?: "review" | "content";
  } = $props();

  const safePct = $derived(Math.max(0, Math.min(100, Math.round(pct))));
</script>

<div
  class={`metric-bar is-${tone}`}
  data-testid="review-progress-bar"
  data-metric-tone={tone}
>
  <span class="metric-label">{label}</span>

  {#if count}
    <span class="metric-count" data-testid="progress-count">{count}</span>
  {/if}

  <span
    class="metric-track"
    role="progressbar"
    aria-label={label}
    aria-valuenow={safePct}
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <span class="metric-fill" data-testid="progress-fill" style={`width: ${safePct}%;`}></span>
  </span>

  <span class="metric-pct">{safePct}%</span>
</div>

<style>
  .metric-bar {
    align-items: center;
    display: grid;
    gap: 0.625rem;
    grid-template-columns: 6rem 1fr 2.75rem;
  }
  /* A barra de revisão ganha uma coluna extra pra contagem absoluta. */
  .metric-bar:has(.metric-count) {
    grid-template-columns: 6rem auto 1fr 2.75rem;
  }
  .metric-label {
    color: var(--color-text);
    font-family: var(--font-sans);
    font-size: 0.8125rem;
  }
  .is-review .metric-label {
    font-weight: 500;
  }
  .metric-count,
  .metric-pct {
    color: var(--color-text-muted);
    font-family: var(--font-mono, var(--font-sans));
    font-size: 0.6875rem;
    font-variant-numeric: tabular-nums;
  }
  .metric-pct {
    text-align: right;
  }
  .metric-track {
    background: var(--color-bg-deep);
    border-radius: var(--radius-sm);
    display: block;
    height: 0.375rem;
    overflow: hidden;
  }
  .metric-fill {
    background: var(--color-gold);
    display: block;
    height: 100%;
    transition: width 200ms ease;
  }
  .is-review .metric-fill {
    background: var(--color-accent);
  }
</style>
