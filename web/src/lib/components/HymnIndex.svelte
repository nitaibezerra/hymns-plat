<script lang="ts">
  /**
   * Marco 4.D — Ciclo 4D.2.
   *
   * Lista numerada de hinos do hinário (modo "índice"). Cada hino é um link
   * para a página de detalhe do hino (`/hinos/[id]`). Preserva o look
   * "dot leader" do template Django original (número monoespaçado + título
   * em serifa).
   */

  interface HymnSummary {
    id: string;
    number: number;
    title: string;
  }

  let { hymns }: { hymns: HymnSummary[] } = $props();

  function pad2(n: number): string {
    return n < 10 ? `0${n}` : String(n);
  }
</script>

{#if hymns.length === 0}
  <p data-testid="hymn-index-empty" class="hymn-index-empty">Nenhum hino cadastrado.</p>
{:else}
  <ol class="hymn-index" data-testid="hymn-index">
    {#each hymns as h (h.id)}
      <li data-testid="hymn-index-item" class="hymn-index-item">
        <a href={`/hinos/${h.id}`} class="hymn-index-link">
          <span class="hymn-index-number">{pad2(h.number)}</span>
          <span class="hymn-index-title">{h.title}</span>
        </a>
      </li>
    {/each}
  </ol>
{/if}

<style>
  .hymn-index {
    display: grid;
    gap: 0.25rem 3rem;
    grid-template-columns: 1fr;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  @media (min-width: 640px) {
    .hymn-index {
      grid-template-columns: 1fr 1fr;
    }
  }
  .hymn-index-item {
    margin: 0;
    padding: 0;
  }
  .hymn-index-link {
    align-items: baseline;
    color: var(--color-text);
    display: flex;
    font-family: var(--font-serif);
    gap: 0.5rem;
    padding: 0.5rem 0;
    text-decoration: none;
  }
  .hymn-index-link:hover {
    color: var(--color-accent);
  }
  .hymn-index-number {
    color: var(--color-text-soft, var(--color-text));
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.75rem;
    opacity: 0.7;
  }
  .hymn-index-title {
    font-size: 1.125rem;
  }
  .hymn-index-empty {
    color: var(--color-text-soft, var(--color-text));
    opacity: 0.7;
  }
</style>
