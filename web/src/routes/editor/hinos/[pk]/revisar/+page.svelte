<script lang="ts">
  /**
   * Sub-marco 5.C — tela 07 · Revisar hino. Ciclo 5C.1 (casca).
   *
   * Paridade com `templates/hymns/editor/revise_hymn.html`: header com
   * posição na fila, duas colunas (editor à esquerda, prévia à direita) e
   * barra de ações fixa no rodapé. Os ciclos seguintes preenchem cada peça.
   */
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<section data-testid="revise-hymn">
  {#if data.error}
    <p data-testid="error">Falha ao carregar hino: {data.error}</p>
  {:else if !data.hymn}
    <p data-testid="not-found">Hino não encontrado.</p>
  {:else}
    <header class="revise-header">
      <a class="back-link" href="/editor/hinarios/{data.hymn.hymnBook.slug}"
        >← {data.hymn.hymnBook.name}</a
      >
      <p class="revise-title" data-testid="revise-title">Revisar hino</p>
    </header>
  {/if}
</section>

<style>
  .revise-header {
    align-items: baseline;
    border-bottom: 1px solid var(--color-border);
    display: flex;
    gap: 1rem;
    justify-content: space-between;
    padding-bottom: 0.75rem;
  }

  .back-link {
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .revise-title {
    font-family: var(--font-display);
    font-size: 1.25rem;
  }
</style>
