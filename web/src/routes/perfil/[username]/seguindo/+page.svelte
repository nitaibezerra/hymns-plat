<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const hasPrev = $derived(data.page > 1);
  const hasNext = $derived(data.page * data.pageSize < data.followingCount);
</script>

<section class="following-page" data-testid="following-page">
  <header>
    <p class="crumb">
      <a href={`/perfil/${data.username}`}>← Voltar para o perfil de {data.username}</a>
    </p>
    <h1>{data.username} está seguindo</h1>
    <p class="count">{data.followingCount} {data.followingCount === 1 ? "usuário" : "usuários"}</p>
  </header>

  {#if data.error}
    <p data-testid="error">Falha ao carregar lista: {data.error}</p>
  {:else if data.following.length === 0}
    <p data-testid="following-empty">
      {#if data.page > 1}
        Esta página está vazia.
      {:else}
        {data.username} ainda não segue ninguém.
      {/if}
    </p>
  {:else}
    <ul class="list">
      {#each data.following as f (f.id)}
        <li class="item" data-testid="following-item">
          <a href={`/perfil/${f.username}`}>{f.username}</a>
        </li>
      {/each}
    </ul>
  {/if}

  <nav class="pager" aria-label="Paginação">
    {#if hasPrev}
      <a class="pager-link" href={`/perfil/${data.username}/seguindo?page=${data.page - 1}`}>
        ← Anterior
      </a>
    {/if}
    {#if hasNext}
      <a class="pager-link" href={`/perfil/${data.username}/seguindo?page=${data.page + 1}`}>
        Próximo →
      </a>
    {/if}
  </nav>
</section>

<style>
  .following-page header {
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
