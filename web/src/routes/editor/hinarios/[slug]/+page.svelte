<script lang="ts">
  /**
   * Marco 5.B — Ciclo 5B.8.
   *
   * Detalhe do hinário na visão do editor: migalha de volta pra fila,
   * cabeçalho com autoria e estado de publicação, barra de progresso de
   * revisão e a lista de hinos com badge de status.
   *
   * Paridade com `templates/hymns/editor/hymnbook_detail.html`.
   */
  import HymnStatusList from "$lib/components/editor/HymnStatusList.svelte";
  import ReviewProgressBar from "$lib/components/editor/ReviewProgressBar.svelte";

  import { editorReviseHref } from "../../+layout";

  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const book = $derived(data.hymnbook);
</script>

<section class="detail" data-testid="editor-hymnbook-detail">
  <nav class="breadcrumb">
    <a href="/editor/">← Fila de revisão</a>
  </nav>

  <header class="detail-header">
    <div class="detail-ident">
      <p class="eyebrow">Hinário em revisão</p>
      <h1 class="font-display detail-title">{book.name}</h1>
      <p class="detail-owner" data-testid="detail-owner">{book.ownerName}</p>
    </div>

    {#if !book.isPublished}
      <span class="draft-badge" data-testid="detail-draft-badge">Rascunho</span>
    {/if}
  </header>

  <div class="detail-progress">
    <ReviewProgressBar
      label="Revisados"
      tone="review"
      pct={book.reviewProgress.reviewPct}
      count={`${book.stats.hymnsReviewed} de ${book.stats.hymnsTotal}`}
    />
  </div>

  <HymnStatusList hymns={book.hymns} hrefFor={editorReviseHref} />
</section>

<style>
  .detail {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .breadcrumb a {
    color: var(--color-text-muted);
    font-family: var(--font-mono, var(--font-sans));
    font-size: 0.6875rem;
    letter-spacing: 0.14em;
    text-decoration: none;
    text-transform: uppercase;
  }
  .breadcrumb a:hover,
  .breadcrumb a:focus-visible {
    color: var(--color-gold);
  }
  .detail-header {
    align-items: flex-start;
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    justify-content: space-between;
  }
  .detail-ident {
    flex: 1;
    min-width: 0;
  }
  .eyebrow {
    color: var(--color-text-muted);
    font-family: var(--font-mono, var(--font-sans));
    font-size: 0.6875rem;
    font-weight: 500;
    letter-spacing: 0.14em;
    margin: 0;
    text-transform: uppercase;
  }
  .detail-title {
    font-size: clamp(1.875rem, 4vw, 2.5rem);
    font-weight: 600;
    line-height: 1.05;
    margin: 0.5rem 0 0;
  }
  .detail-owner {
    color: var(--color-text-soft);
    margin: 0.25rem 0 0;
  }
  .draft-badge {
    background: var(--color-bg-deep);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-pill);
    color: var(--color-text-soft);
    font-family: var(--font-sans);
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    padding: 0.25rem 0.625rem;
    text-transform: uppercase;
  }
  .detail-progress {
    border-bottom: 1px solid var(--color-border-soft);
    padding-bottom: 1.25rem;
  }
</style>
