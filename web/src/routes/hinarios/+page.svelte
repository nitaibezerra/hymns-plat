<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<section data-testid="hymnbooks">
  <h1>Hinários</h1>
  {#if data.error}
    <p data-testid="error">Falha ao carregar hinários: {data.error}</p>
  {:else if data.hymnbooks.length === 0}
    <p data-testid="empty">Nenhum hinário publicado ainda.</p>
  {:else}
    <ul>
      {#each data.hymnbooks as hb (hb.id)}
        <li data-testid="hymnbook-item">
          <a href={`/hinarios/${hb.slug}`}>{hb.name}</a>
          {#if !hb.isPublished}<span data-testid="draft-tag">(rascunho)</span>{/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>
