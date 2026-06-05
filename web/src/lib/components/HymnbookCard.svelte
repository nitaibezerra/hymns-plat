<script lang="ts">
  /**
   * Marco 4.C — Ciclo 4C.2.
   *
   * Cartão headless de um hinário, usado tanto na home (grid de featured)
   * quanto em /hinarios (lista completa).
   *
   * Estrutura:
   *   - <a> envolve o card todo, levando pra /hinarios/<slug>.
   *   - Título com `font-display` (Cormorant Garamond, papel decorativo).
   *   - Três métricas (Hinos · Revisados · Áudios) em pílulas.
   *   - Badge "Rascunho" quando `!isPublished` E o page-pai pediu
   *     explicitamente via `showDraftBadge=true` (controle de auth fica
   *     na page, não no card — Princípio: dumb component).
   *
   * Cores e tipografia via tokens (`var(--color-bg-elevated)` etc.) para
   * herdar dark mode automaticamente.
   */
  export interface HymnbookCardStats {
    hymnsTotal: number;
    hymnsReviewed: number;
    audiosApproved: number;
  }

  export interface HymnbookCardData {
    id: string;
    name: string;
    slug: string;
    isPublished: boolean;
    stats: HymnbookCardStats;
  }

  let {
    hymnbook,
    showDraftBadge = false,
  }: {
    hymnbook: HymnbookCardData;
    showDraftBadge?: boolean;
  } = $props();

  const isDraft = $derived(!hymnbook.isPublished);
  const showBadge = $derived(isDraft && showDraftBadge);
</script>

<a class="card" href={`/hinarios/${hymnbook.slug}`} data-testid="hymnbook-card">
  <article class="card-inner">
    <header class="card-header">
      <h3 class="font-display title">{hymnbook.name}</h3>
      {#if showBadge}
        <span class="badge" data-testid="draft-badge">Rascunho</span>
      {/if}
    </header>

    <dl class="stats" aria-label="Métricas do hinário">
      <div class="stat">
        <dt>Hinos</dt>
        <dd data-testid="stat-hymns-total">{hymnbook.stats.hymnsTotal}</dd>
      </div>
      <div class="stat">
        <dt>Revisados</dt>
        <dd data-testid="stat-hymns-reviewed">{hymnbook.stats.hymnsReviewed}</dd>
      </div>
      <div class="stat">
        <dt>Áudios</dt>
        <dd data-testid="stat-audios-approved">{hymnbook.stats.audiosApproved}</dd>
      </div>
    </dl>
  </article>
</a>

<style>
  .card {
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-1);
    color: var(--color-text);
    display: block;
    overflow: hidden;
    text-decoration: none;
    transition:
      transform 160ms ease,
      box-shadow 160ms ease,
      border-color 160ms ease;
  }
  .card:hover,
  .card:focus-visible {
    border-color: var(--color-accent-3);
    box-shadow: var(--shadow-2);
    transform: translateY(-2px);
  }
  .card-inner {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.25rem 1.25rem 1.125rem;
  }
  .card-header {
    align-items: flex-start;
    display: flex;
    gap: 0.75rem;
    justify-content: space-between;
  }
  .title {
    color: var(--color-text);
    font-size: 1.5rem;
    font-weight: 600;
    letter-spacing: 0.005em;
    line-height: 1.15;
    margin: 0;
  }
  .badge {
    background: var(--color-bg-deep);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-pill);
    color: var(--color-text-soft);
    flex-shrink: 0;
    font-family: var(--font-sans);
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    padding: 0.25rem 0.625rem;
    text-transform: uppercase;
  }
  .stats {
    display: grid;
    gap: 0.5rem;
    grid-template-columns: repeat(3, 1fr);
    margin: 0;
  }
  .stat {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }
  .stat dt {
    color: var(--color-text-muted);
    font-family: var(--font-sans);
    font-size: 0.6875rem;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .stat dd {
    color: var(--color-gold);
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 500;
    line-height: 1;
    margin: 0;
  }
</style>
