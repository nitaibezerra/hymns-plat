<script lang="ts">
  import ProfileHeader from "$lib/components/ProfileHeader.svelte";
  import ProfileUploads from "$lib/components/ProfileUploads.svelte";

  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<section data-testid="profile-page">
  {#if data.error}
    <p data-testid="error">Falha ao carregar o perfil: {data.error}</p>
  {:else if !data.userProfile}
    <p data-testid="empty">Usuário não encontrado.</p>
  {:else}
    <ProfileHeader
      user={data.userProfile.user}
      followersCount={data.userProfile.followersCount}
      followingCount={data.userProfile.followingCount}
      currentUser={data.currentUser}
    />
    <ProfileUploads audios={data.userProfile.uploadedAudios} />
  {/if}
</section>
