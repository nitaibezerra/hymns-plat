<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const hasPrev = $derived(data.page > 1);
  const hasNext = $derived(data.page * data.pageSize < data.followersCount);
</script>

<section class="followers-page" data-testid="followers-page">
  <header>
    <p class="crumb">
      <a href={`/perfil/${data.username}`}>← Voltar para o perfil de {data.username}</a>
    </p>
    <h1>Seguidores de {data.username}</h1>
    <p class="count">{data.followersCount} {data.followersCount === 1 ? "seguidor" : "seguidores"}</p>
  </header>

  {#if data.error}
    <p data-testid="error">Falha ao carregar seguidores: {data.error}</p>
  {:else if data.followers.length === 0}
    <p data-testid="followers-empty">
      {#if data.page > 1}
        Esta página está vazia.
      {:else}
        Ainda não há seguidores.
      {/if}
    </p>
  {:else}
    <ul class="list">
      {#each data.followers as f (f.id)}
        <li class="item" data-testid="follower-item">
          <a href={`/perfil/${f.username}`}>{f.username}</a>
        </li>
      {/each}
    </ul>
  {/if}

  <nav class="pager" aria-label="Paginação">
    {#if hasPrev}
      <a class="pager-link" href={`/perfil/${data.username}/seguidores?page=${data.page - 1}`}>
        ← Anterior
      </a>
    {/if}
    {#if hasNext}
      <a class="pager-link" href={`/perfil/${data.username}/seguidores?page=${data.page + 1}`}>
        Próximo →
      </a>
    {/if}
  </nav>
</section>

<style>
  .followers-page header {
    margin-bottom: 1.5rem;
  }
  .crumb {
    font-size: 0.875rem;
    margin: 0 0 0.5rem;
  }
  .crumb a {
    color: var(--color-text-soft, #666);
    text-decoration: none;
  }
  .crumb a:hover {
    color: var(--color-accent, #b58d3e);
  }
  h1 {
    font-family: var(--font-display, serif);
    font-size: 2rem;
    margin: 0;
  }
  .count {
    color: var(--color-text-soft, #888);
    font-family: var(--font-mono, monospace);
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .list {
    display: grid;
    gap: 0.5rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .item a {
    color: var(--color-text, inherit);
    display: block;
    padding: 0.75rem 1rem;
    border: 1px solid var(--color-border-soft, rgba(0, 0, 0, 0.08));
    border-radius: var(--radius-md, 0.5rem);
    text-decoration: none;
  }
  .item a:hover {
    border-color: var(--color-accent, #b58d3e);
  }
  .pager {
    display: flex;
    gap: 1rem;
    justify-content: space-between;
    margin-top: 1.5rem;
  }
  .pager-link {
    color: var(--color-accent, #b58d3e);
    font-size: 0.875rem;
    text-decoration: none;
  }
</style>
