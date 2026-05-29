<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<section data-testid="home">
  <h1>Hinaria</h1>
  <p>Portal de Hinários do Santo Daime</p>

  {#if data.stats}
    <dl data-testid="global-stats">
      <div>
        <dt>Hinários publicados</dt>
        <dd data-testid="stat-hymnbooks">{data.stats.hymnbooks}</dd>
      </div>
      <div>
        <dt>Hinos</dt>
        <dd data-testid="stat-hymns">{data.stats.hymns}</dd>
      </div>
      <div>
        <dt>Áudios aprovados</dt>
        <dd data-testid="stat-audios">{data.stats.audios}</dd>
      </div>
      <div>
        <dt>Revisores ativos (30d)</dt>
        <dd data-testid="stat-reviewers">{data.stats.activeReviewers}</dd>
      </div>
    </dl>
  {:else if data.error}
    <p data-testid="error">Falha ao carregar stats: {data.error}</p>
  {/if}
</section>
