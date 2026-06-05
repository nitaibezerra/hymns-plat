<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<section data-testid="profile-page">
  {#if data.error}
    <p data-testid="error">Falha ao carregar o perfil: {data.error}</p>
  {:else if !data.userProfile}
    <p data-testid="empty">Usuário não encontrado.</p>
  {:else}
    <h1>{data.userProfile.user.username}</h1>
  {/if}
</section>
