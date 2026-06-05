<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  function formatRelative(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
</script>

<section class="notifications-page" data-testid="notifications-page">
  <header>
    <h1>Notificações</h1>
  </header>

  {#if data.error}
    <p data-testid="error">Falha ao carregar notificações: {data.error}</p>
  {:else if data.notifications.length === 0}
    <p data-testid="notifications-empty">
      {#if data.unreadOnly}
        Nenhuma notificação não lida.
      {:else}
        Você não tem notificações.
      {/if}
    </p>
  {:else}
    <ul class="list">
      {#each data.notifications as n (n.id)}
        <li
          class="item"
          data-testid="notification-item"
          data-is-read={n.isRead}
          data-notification-type={n.notificationType}
        >
          <div class="content">
            <p class="title">{n.title}</p>
            <p class="message">{n.message}</p>
            <p class="meta">{formatRelative(n.createdAt)}</p>
          </div>
          {#if n.link}
            <a class="link" href={n.link}>Ver</a>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .notifications-page header {
    align-items: baseline;
    display: flex;
    gap: 1rem;
    justify-content: space-between;
    margin-bottom: 1.5rem;
  }
  h1 {
    font-family: var(--font-display, serif);
    font-size: 2rem;
    margin: 0;
  }
  .list {
    display: grid;
    gap: 0.75rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .item {
    align-items: start;
    background: var(--color-surface, transparent);
    border-left: 3px solid var(--color-border-soft, #ccc);
    border-radius: var(--radius-md, 0.5rem);
    display: flex;
    gap: 1rem;
    padding: 0.75rem 1rem;
  }
  .item[data-is-read="false"] {
    border-left-color: var(--color-accent, #b58d3e);
  }
  .content {
    flex: 1;
    min-width: 0;
  }
  .title {
    font-weight: 600;
    margin: 0;
  }
  .message {
    color: var(--color-text-soft, #555);
    font-size: 0.9375rem;
    margin: 0.25rem 0 0;
  }
  .meta {
    color: var(--color-text-soft, #888);
    font-family: var(--font-mono, monospace);
    font-size: 0.75rem;
    letter-spacing: 0.05em;
    margin: 0.5rem 0 0;
  }
  .link {
    align-self: center;
    color: var(--color-accent, #b58d3e);
    font-size: 0.875rem;
    text-decoration: none;
    white-space: nowrap;
  }
</style>
