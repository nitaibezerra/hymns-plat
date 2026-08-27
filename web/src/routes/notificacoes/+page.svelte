<script lang="ts">
  /**
   * Marco 4.H · Sub-marco 5.E — Ciclo 5E.8.
   *
   * 5E.8 acrescenta "Marcar tudo como lido" (`markAllNotificationsRead`) e o
   * remetente de cada notificação (`NotificationType.sender`, campo do 5.A½
   * que o template Django já mostrava e a SPA ignorava).
   */
  import { getCsrfTokenFromCookie } from "$lib/graphql/client";
  import { GRAPHQL_URL } from "$lib/config";
  import { gqlFetch } from "$lib/graphql/fetcher";
  import { MARK_ALL_NOTIFICATIONS_READ_MUTATION } from "$lib/graphql/operations/quick-review";

  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  function formatRelative(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toISOString().slice(0, 16).replace("T", " ");
  }

  /**
   * Ids marcados como lidos nesta sessão. Guardamos o conjunto em vez de
   * mutar `data.notifications`: `data` é da load e volta original na próxima
   * navegação — com a lista já correta, vinda do servidor.
   */
  let markedRead = $state(new Set<string>());
  let marking = $state(false);
  let markError = $state<string | null>(null);

  const isRead = (n: { id: string; isRead: boolean }) => n.isRead || markedRead.has(n.id);
  const hasUnread = $derived(data.notifications.some((n) => !isRead(n)));

  /**
   * `markAllNotificationsRead` devolve `Int!` (quantas marcou), não uma union
   * — não há `__typename` pra discriminar, então o único desfecho ruim é erro
   * de transporte ou GraphQL error.
   */
  async function markAllRead() {
    if (marking) return;
    marking = true;
    markError = null;

    const response = await gqlFetch<{ markAllNotificationsRead: number }>(
      fetch,
      GRAPHQL_URL,
      MARK_ALL_NOTIFICATIONS_READ_MUTATION,
      {},
      { csrfToken: getCsrfTokenFromCookie() },
    );
    marking = false;

    const message = response.errors?.[0]?.message;
    if (message) {
      markError = message;
      return;
    }
    markedRead = new Set(data.notifications.map((n) => n.id));
  }
</script>

<section class="notifications-page" data-testid="notifications-page">
  <header>
    <h1>Notificações</h1>
    <div class="header-actions">
      {#if hasUnread}
        <button
          type="button"
          class="mark-all"
          data-testid="mark-all-read"
          disabled={marking}
          onclick={markAllRead}
        >
          {marking ? "Marcando…" : "Marcar tudo como lido"}
        </button>
      {/if}
      <p class="toggle">
        {#if data.unreadOnly}
          <a href="/notificacoes/?unread=0" data-testid="toggle-all">Todas</a>
        {:else}
          <a href="/notificacoes/?unread=1" data-testid="toggle-unread">Apenas não lidas</a>
        {/if}
      </p>
    </div>
  </header>

  {#if markError}
    <p class="mark-error" role="alert" data-testid="mark-all-read-error">
      Não foi possível marcar como lido: {markError}
    </p>
  {/if}

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
          data-is-read={isRead(n)}
          data-notification-type={n.notificationType}
        >
          <div class="content">
            <p class="title">{n.title}</p>
            <p class="message">{n.message}</p>
            {#if n.sender}
              <p class="sender" data-testid="notification-sender">
                De: <a href={`/perfil/${n.sender.username}/`}>{n.sender.username}</a>
              </p>
            {/if}
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
  .header-actions {
    align-items: baseline;
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }
  .mark-all {
    background: transparent;
    border: 1px solid var(--color-border-soft, #ccc);
    border-radius: var(--radius-pill, 9999px);
    color: var(--color-accent, #b58d3e);
    cursor: pointer;
    font-family: var(--font-sans, sans-serif);
    font-size: 0.8125rem;
    padding: 0.3125rem 0.875rem;
  }
  .mark-all[disabled] {
    cursor: progress;
    opacity: 0.6;
  }
  .mark-error {
    border: 1px solid var(--color-border-soft, #ccc);
    border-radius: var(--radius-md, 0.5rem);
    font-size: 0.875rem;
    margin: 0 0 1rem;
    padding: 0.625rem 0.875rem;
  }
  .sender {
    color: var(--color-text-soft, #666);
    font-size: 0.8125rem;
    margin: 0.375rem 0 0;
  }
  .sender a {
    color: var(--color-accent, #b58d3e);
    text-decoration: none;
  }
  .sender a:hover {
    text-decoration: underline;
  }
  .toggle {
    margin: 0;
  }
  .toggle a {
    color: var(--color-accent, #b58d3e);
    font-size: 0.875rem;
    text-decoration: none;
  }
  .toggle a:hover {
    text-decoration: underline;
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
