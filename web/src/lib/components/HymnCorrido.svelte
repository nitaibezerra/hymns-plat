<script lang="ts">
  /**
   * Marco 4.D — Ciclo 4D.3.
   *
   * Modo "corrido": todos os hinos do hinário renderizados em coluna, um
   * bloco por hino com título e HymnBody. Look "página de cantador" —
   * espelha o template Django `hymnbook_read.html` (modo=corrido).
   */
  import HymnBody from "./HymnBody.svelte";

  interface HymnSummary {
    id: string;
    number: number;
    title: string;
    body: string | null;
  }

  let { hymns }: { hymns: HymnSummary[] } = $props();
</script>

{#if hymns.length === 0}
  <p data-testid="hymn-corrido-empty" class="hymn-corrido-empty">Nenhum hino cadastrado.</p>
{:else}
  <div class="hymn-corrido" data-testid="hymn-corrido">
    {#each hymns as h, i (h.id)}
      <article data-testid="hymn-corrido-item" class="hymn-corrido-item" id={`hymn-${h.number}`}>
        <h2 class="hymn-corrido-title">{h.number} — {h.title}</h2>
        <HymnBody body={h.body} />
        <div class="hymn-corrido-end" aria-hidden="true">
          {(i + 1) % 3 === 0 ? "☀ ☾ ★" : "✡"}
        </div>
      </article>
    {/each}
  </div>
{/if}

<style>
  .hymn-corrido {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    margin-inline: auto;
    max-width: 48rem;
    padding-block: 2.5rem;
  }
  .hymn-corrido-item {
    padding: 2rem 1.5rem;
  }
  .hymn-corrido-title {
    font-family: var(--font-display, serif);
    font-size: 1.75rem;
    margin: 0 0 1.5rem;
    text-align: center;
  }
  .hymn-corrido-end {
    color: var(--color-accent, #b08c4a);
    font-family: var(--font-display, serif);
    font-style: italic;
    margin-top: 1.5rem;
    text-align: center;
  }
  .hymn-corrido-empty {
    color: var(--color-text-soft, var(--color-text));
    opacity: 0.7;
    text-align: center;
  }
</style>
