<script lang="ts">
  import ActivityHeatmap from "$lib/components/ActivityHeatmap.svelte";
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

    <section class="activity">
      <h2>Trabalho editorial · último ano</h2>
      <ActivityHeatmap buckets={data.userProfile.activityHeatmap} />
    </section>

    <ProfileUploads audios={data.userProfile.uploadedAudios} />
  {/if}
</section>

<style>
  .activity {
    margin-top: 2rem;
  }
  .activity h2 {
    font-family: var(--font-display, serif);
    font-size: 1.5rem;
    margin: 0 0 1rem;
  }
</style>
