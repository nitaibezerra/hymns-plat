<script lang="ts">
  /**
   * Marco 4.G — Ciclo 4G.1.
   * Render mínimo enquanto ciclos 4G.2+ não chegam. Usa apenas `data.query`
   * pra confirmar que a load function corre. Cresce nos próximos ciclos.
   */
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<section data-testid="search">
  <p data-testid="search-query">{data.query}</p>
</section>
