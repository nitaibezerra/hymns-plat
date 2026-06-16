<script lang="ts">
  /**
   * Marco 4.H — Ciclo 4H.2.
   *
   * Header do perfil: avatar (fallback iniciais), nome, contagens de
   * seguidores/seguindo, botão "Seguir" quando não é o próprio perfil e há
   * usuário autenticado.
   *
   * Sem avatar real ainda — backend GraphQL não expõe `avatar` na
   * `UserType` (a `UserType` do schema 4.A só carrega id/username/email).
   * Quando expusermos, basta acrescentar `avatarUrl` aqui.
   */

  export interface ProfileHeaderUser {
    id: string;
    username: string;
    email: string;
  }

  let {
    user,
    followersCount,
    followingCount,
    currentUser = null,
  }: {
    user: ProfileHeaderUser;
    followersCount: number;
    followingCount: number;
    currentUser?: ProfileHeaderUser | null;
  } = $props();

  const initials = $derived(user.username.slice(0, 2).toUpperCase());
  const isSelf = $derived(currentUser !== null && currentUser.id === user.id);
  const canFollow = $derived(currentUser !== null && !isSelf);
</script>

<header class="profile-header" data-testid="profile-header">
  <div class="avatar" data-testid="profile-avatar" aria-hidden="true">{initials}</div>

  <div class="info">
    <h1 class="name">{user.username}</h1>

    <dl class="counts">
      <div>
        <dt>Seguidores</dt>
        <dd data-testid="profile-followers-count">
          <a href={`/perfil/${user.username}/seguidores`}>{followersCount}</a>
        </dd>
      </div>
      <div>
        <dt>Seguindo</dt>
        <dd data-testid="profile-following-count">
          <a href={`/perfil/${user.username}/seguindo`}>{followingCount}</a>
        </dd>
      </div>
    </dl>
  </div>

  {#if canFollow}
    <div class="actions">
      <button type="button" class="follow-btn" data-testid="follow-btn">Seguir</button>
    </div>
  {/if}
</header>

<style>
  .profile-header {
    align-items: center;
    display: grid;
    gap: 1.5rem;
    grid-template-columns: auto 1fr auto;
    padding: 1.5rem 0;
  }
  .avatar {
    align-items: center;
    background: var(--color-accent, #b58d3e);
    border-radius: 50%;
    color: var(--color-bg, #fff);
    display: inline-flex;
    font-family: var(--font-mono, monospace);
    font-size: 1.5rem;
    font-weight: 600;
    height: 6rem;
    justify-content: center;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    width: 6rem;
  }
  .name {
    font-family: var(--font-display, serif);
    font-size: 2.25rem;
    margin: 0;
  }
  .counts {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
    margin: 0.75rem 0 0;
  }
  .counts div {
    display: flex;
    flex-direction: column;
  }
  .counts dt {
    color: var(--color-text-soft, #666);
    font-family: var(--font-mono, monospace);
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .counts dd {
    font-family: var(--font-display, serif);
    font-size: 1.5rem;
    margin: 0;
  }
  .counts dd a {
    color: inherit;
    text-decoration: none;
  }
  .counts dd a:hover {
    text-decoration: underline;
  }
  .follow-btn {
    background: var(--color-accent, #b58d3e);
    border: 0;
    border-radius: var(--radius-pill, 9999px);
    color: var(--color-bg, #fff);
    cursor: pointer;
    font-family: var(--font-sans, sans-serif);
    font-size: 0.875rem;
    padding: 0.5rem 1.25rem;
  }
</style>
