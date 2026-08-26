<script lang="ts">
  /**
   * Marco 5.B — Ciclo 5B.8.
   *
   * Detalhe do hinário na visão do editor: migalha de volta pra fila,
   * cabeçalho com autoria e estado de publicação, barra de progresso de
   * revisão e a lista de hinos com badge de status.
   *
   * O botão "Próximo pendente" (5B.9) consome `HymnBookType.nextPendingHymn`
   * e navega com `goto`. É um `<button>`, não um `<a>`: o destino não é
   * derivável da URL desta página — quem escolhe o hino é o backend, que
   * conhece a regra de fila com wrap-around. Renderizar um link seria
   * prometer um endereço que o cliente não sabe montar.
   *
   * Paridade com `templates/hymns/editor/hymnbook_detail.html`.
   */
  import { goto } from "$app/navigation";
  import HymnStatusList from "$lib/components/editor/HymnStatusList.svelte";
  import ReviewProgressBar from "$lib/components/editor/ReviewProgressBar.svelte";

  import { editorReviseHref } from "../../+layout";

  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const book = $derived(data.hymnbook);
  const next = $derived(book.nextPendingHymn);

  function goToNextPending() {
    if (!next) return;
    goto(editorReviseHref(next.id));
  }
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

    <div class="detail-actions">
      {#if !book.isPublished}
        <span class="draft-badge" data-testid="detail-draft-badge">Rascunho</span>
      {/if}

      {#if next}
        <button
          type="button"
          class="next-pending"
          data-testid="next-pending"
          title={`Hino ${next.number} — ${next.title}`}
          onclick={goToNextPending}
        >
          Próximo pendente →
        </button>
      {:else}
        <p class="all-reviewed" data-testid="all-reviewed">Tudo revisado ✓</p>
      {/if}
    </div>
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
  .detail-actions {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .next-pending {
    background: var(--color-accent);
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-pill);
    color: var(--color-bg);
    cursor: pointer;
    font-family: var(--font-sans);
    font-size: 0.875rem;
    padding: 0.5rem 1.125rem;
    transition:
      background 140ms ease,
      transform 100ms ease;
  }
  .next-pending:hover,
  .next-pending:focus-visible {
    background: var(--color-accent-2);
  }
  .next-pending:active {
    transform: translateY(1px);
  }
  .all-reviewed {
    color: var(--color-status-ok);
    font-family: var(--font-mono, var(--font-sans));
    font-size: 0.75rem;
    letter-spacing: 0.12em;
    margin: 0;
    text-transform: uppercase;
  }
  .detail-progress {
    border-bottom: 1px solid var(--color-border-soft);
    padding-bottom: 1.25rem;
  }
</style>
