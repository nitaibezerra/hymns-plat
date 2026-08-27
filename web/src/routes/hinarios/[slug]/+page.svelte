<script lang="ts">
  /**
   * Marco 4.D — Detalhe do hinário em 3 modos (índice/corrido/carrossel).
   *
   * O modo é URL-driven (`?mode=indice|corrido|carrossel`) e resolvido pelo
   * load function. Cada modo é renderizado por um componente próprio:
   *   - índice: <HymnIndex />     (lista numerada com links)
   *   - corrido: <HymnCorrido />  (todos os hinos em coluna)
   *   - carrossel: <HymnCarousel /> (1 slide por viewport, reader focus)
   *
   * No modo carrossel o header e os toggle pills ficam escondidos (decisão
   * "Reader Focus" herdada do monolito).
   */
  import HymnCarousel from "$lib/components/HymnCarousel.svelte";
  import HymnCorrido from "$lib/components/HymnCorrido.svelte";
  import HymnIndex from "$lib/components/HymnIndex.svelte";
  import ModeTogglePills from "$lib/components/ModeTogglePills.svelte";

  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let isCarousel = $derived(data.mode === "carrossel");
</script>

<section data-testid="hymnbook-detail">
  {#if data.error}
    <p data-testid="error">Falha ao carregar hinário: {data.error}</p>
  {:else if !data.hymnbook}
    <p data-testid="not-found">Hinário não encontrado.</p>
  {:else}
    {#if !isCarousel}
      <header class="hymnbook-header">
        <h1>{data.hymnbook.name}</h1>
        <ModeTogglePills mode={data.mode} />
      </header>
    {/if}

    {#if data.mode === "indice"}
      <HymnIndex hymns={data.hymnbook.hymns} />
    {:else if data.mode === "corrido"}
      <HymnCorrido hymns={data.hymnbook.hymns} />
    {:else if data.mode === "carrossel"}
      <HymnCarousel hymns={data.hymnbook.hymns} hymnbookSlug={data.hymnbook.slug} />
    {/if}
  {/if}
</section>

<style>
  .hymnbook-header {
    align-items: flex-start;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
</style>
