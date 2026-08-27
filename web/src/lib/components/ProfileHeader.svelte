<script lang="ts">
  /**
   * Marco 4.H — Ciclo 4H.2 · Sub-marco 5.E — Ciclo 5E.7.
   *
   * Header do perfil: avatar (fallback iniciais), nome, contagens de
   * seguidores/seguindo, botão "Seguir" quando não é o próprio perfil e há
   * usuário autenticado.
   *
   * Sem avatar real ainda — backend GraphQL não expõe `avatar` na
   * `UserType` (a `UserType` do schema 4.A só carrega id/username/email).
   * Quando expusermos, basta acrescentar `avatarUrl` aqui.
   *
   * 5E.7 — o botão deixou de ser inerte: chama `followUser`/`unfollowUser`
   * com UI otimista. O otimismo é estado local + rollback, e não o
   * `optimisticResponse` do urql, porque as loads deste projeto usam um
   * `gqlFetch` próprio e não passam pelo cache do urql — não há cache pra
   * atualizar.
   */
  import { setFollowing } from "$lib/graphql/operations/quick-review";

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
    isFollowedByCurrentUser = false,
  }: {
    user: ProfileHeaderUser;
    followersCount: number;
    followingCount: number;
    currentUser?: ProfileHeaderUser | null;
    /** `UserProfileType.isFollowedByCurrentUser` — estado inicial do botão. */
    isFollowedByCurrentUser?: boolean;
  } = $props();

  const initials = $derived(user.username.slice(0, 2).toUpperCase());
  const isSelf = $derived(currentUser !== null && currentUser.id === user.id);
  const canFollow = $derived(currentUser !== null && !isSelf);

  /**
   * Enquanto ninguém clicou, o que vale são as props (que vêm da load e
   * sobrevivem ao SSR). O clique instala um `override` local, e a partir daí
   * quem manda é a mutation — o `data` da load só volta a valer numa
   * navegação nova, que remonta o componente.
   *
   * `null` significa "sem override": é o valor pro qual o rollback volta
   * quando a falha acontece no primeiro clique.
   */
  let override = $state<{ following: boolean; followers: number } | null>(null);
  let pending = $state(false);
  let followError = $state<string | null>(null);

  const following = $derived(override ? override.following : isFollowedByCurrentUser);
  const followers = $derived(override ? override.followers : followersCount);

  async function toggleFollow() {
    if (pending) return;

    // Otimismo: guarda o estado atual, aplica o desejado e só então pergunta.
    const previous = override;
    const desired = !following;
    pending = true;
    followError = null;
    override = {
      following: desired,
      followers: Math.max(0, followers + (desired ? 1 : -1)),
    };

    const result = await setFollowing(fetch, user.username, desired);
    pending = false;

    if (!result.ok) {
      override = previous;
      followError = result.message;
      return;
    }
    // A contagem otimista era um palpite; a do servidor é a verdade (outra
    // pessoa pode ter seguido no mesmo segundo).
    if (result.data) {
      override = {
        following: result.data.isFollowedByCurrentUser,
        followers: result.data.followersCount,
      };
    }
  }
</script>

<header class="profile-header" data-testid="profile-header">
  <div class="avatar" data-testid="profile-avatar" aria-hidden="true">{initials}</div>

  <div class="info">
    <h1 class="name">{user.username}</h1>

    <dl class="counts">
      <div>
        <dt>Seguidores</dt>
        <dd data-testid="profile-followers-count">
          <a href={`/perfil/${user.username}/seguidores`}>{followers}</a>
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
      <button
        type="button"
        class="follow-btn"
        data-testid="follow-btn"
        data-following={following ? "true" : "false"}
        aria-pressed={following}
        disabled={pending}
        onclick={toggleFollow}
      >
        {following ? "Seguindo" : "Seguir"}
      </button>
      {#if followError}
        <p class="follow-error" role="alert" data-testid="follow-error">{followError}</p>
      {/if}
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
  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  .follow-btn {
    background: var(--color-accent, #b58d3e);
    border: 1px solid var(--color-accent, #b58d3e);
    border-radius: var(--radius-pill, 9999px);
    color: var(--color-bg, #fff);
    cursor: pointer;
    font-family: var(--font-sans, sans-serif);
    font-size: 0.875rem;
    padding: 0.5rem 1.25rem;
  }
  /* "Seguindo" é um estado, não uma chamada pra ação: perde o preenchimento
     pra não competir com o resto da página. */
  .follow-btn[data-following="true"] {
    background: transparent;
    border-color: var(--color-border-soft, #ccc);
    color: var(--color-text-soft, #666);
  }
  .follow-btn[disabled] {
    cursor: progress;
    opacity: 0.6;
  }
  .follow-error {
    color: var(--color-text-soft, #666);
    font-size: 0.75rem;
    margin: 0;
    max-width: 14rem;
  }
</style>
