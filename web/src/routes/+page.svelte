<script lang="ts">
  /**
   * Marco 4.C — Ciclo 4C.3.
   *
   * Página inicial headless. Estrutura espelha o `home.html` do monolito,
   * mas redesenhada com tokens neutros pro shell SvelteKit:
   *
   *   - Hero (slogan + parágrafo + CTAs "Explorar hinários" → `/hinarios` e
   *     "Buscar hinos" → `/busca` + 4 stats globais).
   *   - Grid "Em destaque" com até 6 cards de hinários (hourlyFeatured).
   *
   * Cards são `HymnbookCard` (4C.2). A home não diferencia editor/anônimo —
   * o featured é sempre público (resolver filtra por visibilidade).
   */
  import HymnbookCard from "$lib/components/HymnbookCard.svelte";

  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<section data-testid="home">
  <section class="hero" data-testid="home-hero">
    <p class="eyebrow">Hinaria · hinaria.com.br</p>
    <h1 class="hero-title font-display" data-testid="home-hero-title">
      Hinários para ouvir,<br />
      estudar e cantar <em>com firmeza.</em>
    </h1>
    <p class="hero-lead">
      Uma biblioteca aberta de hinos recebidos, com revisão editorial cuidadosa
      e três modos de leitura — pensada para uso durante os trabalhos.
    </p>

    <div class="hero-cta">
      <a href="/hinarios" class="cta-primary">Explorar hinários</a>
      <a href="/busca" class="cta-secondary">Buscar hinos</a>
    </div>

    {#if data.stats}
      <dl class="hero-stats" data-testid="global-stats">
        <div class="hero-stat">
          <dt>Hinários</dt>
          <dd class="font-display" data-testid="stat-hymnbooks">{data.stats.hymnbooks}</dd>
        </div>
        <div class="hero-stat">
          <dt>Hinos</dt>
          <dd class="font-display" data-testid="stat-hymns">{data.stats.hymns}</dd>
        </div>
        <div class="hero-stat">
          <dt>Áudios</dt>
          <dd class="font-display" data-testid="stat-audios">{data.stats.audios}</dd>
        </div>
        <div class="hero-stat">
          <dt>Revisores ativos</dt>
          <dd class="font-display" data-testid="stat-reviewers">{data.stats.activeReviewers}</dd>
        </div>
      </dl>
    {:else if data.error}
      <p class="error" data-testid="error">Falha ao carregar stats: {data.error}</p>
    {/if}
  </section>

  <section class="featured" aria-labelledby="featured-heading">
    <header class="section-header">
      <h2 id="featured-heading" class="font-display section-title">Em destaque</h2>
      <a href="/hinarios" class="see-all">Ver todos →</a>
    </header>

    {#if data.featured.length > 0}
      <div class="grid" data-testid="home-featured-grid">
        {#each data.featured as hb (hb.id)}
          <HymnbookCard hymnbook={hb} />
        {/each}
      </div>
    {:else}
      <p class="empty">Nenhum hinário publicado ainda.</p>
    {/if}
  </section>
</section>

<style>
  .hero {
    border-bottom: 1px solid var(--color-border-soft);
    padding: 2.5rem 0 3rem;
  }
  .eyebrow {
    color: var(--color-text-muted);
    font-family: var(--font-sans);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    margin: 0 0 1rem;
    text-transform: uppercase;
  }
  .hero-title {
    color: var(--color-text);
    font-size: clamp(2.25rem, 5vw, 3.5rem);
    font-weight: 500;
    letter-spacing: -0.01em;
    line-height: 1.05;
    margin: 0;
  }
  .hero-title em {
    color: var(--color-text-soft);
    font-style: italic;
  }
  .hero-lead {
    color: var(--color-text-soft);
    font-size: 1.0625rem;
    line-height: 1.55;
    margin: 1.25rem 0 0;
    max-width: 36rem;
  }
  .hero-cta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }
  .cta-primary {
    background: var(--color-accent);
    border-radius: var(--radius-pill);
    color: var(--color-bg);
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    font-weight: 600;
    padding: 0.625rem 1.25rem;
    text-decoration: none;
  }
  .cta-primary:hover {
    background: var(--color-accent-2);
  }
  .cta-secondary {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-pill);
    color: var(--color-text);
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    font-weight: 500;
    padding: 0.625rem 1.25rem;
    text-decoration: none;
  }
  .cta-secondary:hover {
    border-color: var(--color-accent-3);
  }
  .hero-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem 2.5rem;
    margin: 2rem 0 0;
  }
  .hero-stat dt {
    color: var(--color-text-muted);
    font-family: var(--font-sans);
    font-size: 0.6875rem;
    font-weight: 500;
    letter-spacing: 0.1em;
    margin: 0;
    text-transform: uppercase;
  }
  .hero-stat dd {
    color: var(--color-gold);
    font-size: 2rem;
    font-weight: 500;
    line-height: 1.1;
    margin: 0.25rem 0 0;
  }
  .error {
    color: var(--color-status-not);
    margin-top: 1.5rem;
  }
  .featured {
    padding: 2.5rem 0;
  }
  .section-header {
    align-items: baseline;
    display: flex;
    gap: 1rem;
    justify-content: space-between;
    margin-bottom: 1.5rem;
  }
  .section-title {
    color: var(--color-text);
    font-size: 1.75rem;
    font-weight: 600;
    margin: 0;
  }
  .see-all {
    color: var(--color-text-soft);
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-decoration: none;
    text-transform: uppercase;
  }
  .see-all:hover {
    color: var(--color-accent);
  }
  .grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  }
  .empty {
    color: var(--color-text-muted);
  }
</style>
