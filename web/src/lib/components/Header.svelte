<script lang="ts">
  /**
   * Marco 4.B — Ciclo 4B.4.
   *
   * Header global do shell headless. Renderiza:
   *
   *   - Brand "hinária" linkando pra `/`.
   *   - Links de navegação: Hinários, Buscar.
   *   - ThemeToggle (botão de alternar tema; comportamento no ciclo 4B.5).
   *   - Slot de usuário: avatar+username se autenticado; link "Entrar" se não.
   *
   * `currentUser` chega do `+layout.ts` (ciclo 4B.7). Pode ser null.
   */
  import ThemeToggle from "./ThemeToggle.svelte";

  export interface HeaderUser {
    id: string;
    username: string;
    email: string;
  }

  let { currentUser = null }: { currentUser?: HeaderUser | null } = $props();
</script>

<header class="site-header" data-testid="site-header">
  <div class="header-inner">
    <a href="/" class="brand" data-testid="brand">hinária</a>

    <nav aria-label="Navegação principal" class="nav">
      <a href="/hinarios">Hinários</a>
      <a href="/buscar">Buscar</a>
    </nav>

    <div class="actions">
      <ThemeToggle />
      {#if currentUser}
        <a
          href="/perfil"
          class="user"
          data-testid="user-avatar"
          aria-label="Perfil de {currentUser.username}"
        >
          <span class="avatar" aria-hidden="true">
            {currentUser.username.charAt(0).toUpperCase()}
          </span>
          <span class="username">{currentUser.username}</span>
        </a>
      {:else}
        <a href="/login" class="login-link">Entrar</a>
      {/if}
    </div>
  </div>
</header>

<style>
  .site-header {
    background: var(--color-bg);
    border-bottom: 1px solid var(--color-border-soft);
    font-family: var(--font-sans);
  }
  .header-inner {
    align-items: center;
    display: flex;
    gap: 1.5rem;
    margin: 0 auto;
    max-width: 72rem;
    padding: 0.75rem 1.25rem;
  }
  .brand {
    color: var(--color-text);
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-decoration: none;
  }
  .nav {
    display: flex;
    flex: 1;
    gap: 1rem;
  }
  .nav a {
    color: var(--color-text-soft);
    font-size: 0.9375rem;
    font-weight: 500;
    text-decoration: none;
  }
  .nav a:hover {
    color: var(--color-accent);
  }
  .actions {
    align-items: center;
    display: flex;
    gap: 0.75rem;
  }
  .login-link {
    color: var(--color-accent);
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
  }
  .user {
    align-items: center;
    color: var(--color-text);
    display: inline-flex;
    gap: 0.5rem;
    text-decoration: none;
  }
  .avatar {
    align-items: center;
    background: var(--color-accent);
    border-radius: var(--radius-pill);
    color: var(--color-bg);
    display: inline-flex;
    font-weight: 600;
    height: 2rem;
    justify-content: center;
    width: 2rem;
  }
  .username {
    font-size: 0.9375rem;
  }
</style>
