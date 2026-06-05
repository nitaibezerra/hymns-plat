<script lang="ts">
  /**
   * Marco 4.D — Detalhe do hinário em 3 modos (índice/corrido/carrossel).
   *
   * Esqueleto inicial — ciclos seguintes preenchem os modos.
   */
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<section data-testid="hymnbook-detail">
  {#if data.error}
    <p data-testid="error">Falha ao carregar hinário: {data.error}</p>
  {:else if !data.hymnbook}
    <p data-testid="not-found">Hinário não encontrado.</p>
  {:else}
    <h1>{data.hymnbook.name}</h1>
  {/if}
</section>
