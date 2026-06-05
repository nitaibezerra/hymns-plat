<script lang="ts">
  /**
   * Marco 4.D — Detalhe do hinário em 3 modos (índice/corrido/carrossel).
   *
   * O modo é URL-driven (`?mode=indice|corrido|carrossel`) e resolvido pelo
   * load function. Cada modo é renderizado por um componente próprio:
   *   - índice: <HymnIndex />     (lista numerada com links)
   *   - corrido: <HymnCorrido />  (todos os hinos em coluna)
   *   - carrossel: <HymnCarousel /> (1 slide por viewport, reader focus)
   */
  import HymnIndex from "$lib/components/HymnIndex.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<section data-testid="hymnbook-detail">
  {#if data.error}
    <p data-testid="error">Falha ao carregar hinário: {data.error}</p>
  {:else if !data.hymnbook}
    <p data-testid="not-found">Hinário não encontrado.</p>
  {:else}
    <header class="hymnbook-header">
      <h1>{data.hymnbook.name}</h1>
    </header>
    {#if data.mode === "indice"}
      <HymnIndex hymns={data.hymnbook.hymns} />
    {/if}
  {/if}
</section>

<style>
  .hymnbook-header {
    margin-bottom: 1.5rem;
  }
</style>
