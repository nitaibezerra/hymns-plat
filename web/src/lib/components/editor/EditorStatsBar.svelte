<script lang="ts">
  /**
   * Marco 5.B — Ciclo 5B.3.
   *
   * As 4 stats do workspace, na mesma ordem e com as mesmas cores do `<dl>`
   * de `templates/hymns/editor/hymnbook_list.html`:
   *
   *   P1 urgente (urgência) · Hinários (neutro) · Pendentes (atenção) ·
   *   Revisados · 7d (conquista)
   *
   * Componente burro: recebe números prontos do load e só os apresenta. A
   * cor carrega significado — vermelho é o que dói, verde é o que já rendeu
   * — então cada valor leva uma classe de tom além do `font-display`.
   */
  export interface EditorStatsBarStats {
    totalHinarios: number;
    pendingHymns: number;
    recentReviewed7d: number;
    p1Count: number;
  }

  let { stats }: { stats: EditorStatsBarStats } = $props();

  const cards = $derived([
    { key: "p1", label: "P1 urgente", value: stats.p1Count, tone: "is-urgent" },
    { key: "hinarios", label: "Hinários", value: stats.totalHinarios, tone: "is-neutral" },
    { key: "pendentes", label: "Pendentes", value: stats.pendingHymns, tone: "is-pending" },
    { key: "revisados", label: "Revisados · 7d", value: stats.recentReviewed7d, tone: "is-done" },
  ]);
</script>

<dl class="stats-bar" data-testid="editor-stats-bar" aria-label="Resumo do workspace editorial">
  {#each cards as card (card.key)}
    <div class="stat-card" data-testid={`stat-card-${card.key}`}>
      <dt class="stat-label">{card.label}</dt>
      <dd
        class={`font-display stat-value ${card.tone}`}
        data-testid={`stat-value-${card.key}`}
      >
        {card.value}
      </dd>
    </div>
  {/each}
</dl>

<style>
  .stats-bar {
    display: grid;
    gap: 0.25rem 1.75rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin: 0;
  }
  @media (min-width: 40rem) {
    .stats-bar {
      grid-template-columns: repeat(4, minmax(0, auto));
      text-align: right;
    }
  }
  .stat-card {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }
  .stat-label {
    color: var(--color-text-muted);
    font-family: var(--font-mono, var(--font-sans));
    font-size: 0.6875rem;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .stat-value {
    font-size: 1.75rem;
    font-weight: 500;
    line-height: 1;
    margin: 0;
  }
  .is-neutral {
    color: var(--color-text);
  }
  .is-urgent {
    color: var(--color-status-not);
  }
  .is-pending {
    color: var(--color-status-mid);
  }
  .is-done {
    color: var(--color-status-ok);
  }
</style>
