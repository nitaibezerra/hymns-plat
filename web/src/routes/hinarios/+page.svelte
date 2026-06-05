<script lang="ts">
  /**
   * Marco 4.C — Ciclos 4C.4 e 4C.5.
   *
   * Lista headless de hinários, com:
   *
   *   - busca local (client-side) por nome, case- e accent-insensitive;
   *   - grid de `HymnbookCard`;
   *   - badge "Rascunho" automático nos cards onde `isPublished=false`
   *     (esses só aparecem na lista se o user atual for editor/admin —
   *     filtro de visibilidade é do resolver GraphQL, não duplicamos aqui).
   *
   * O `data.currentUser` chega via `+layout.ts` (Marco 4.B). Só usamos pra
   * decidir se mostramos o badge "Rascunho" — a presença de rascunho no
   * resultado já implica que o user pode vê-los, então mostrar o badge
   * é puramente informativo para evitar confusão visual.
   */
  import HymnbookCard from "$lib/components/HymnbookCard.svelte";

  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let query = $state("");

  function normalize(s: string): string {
    // NFD separa diacrítico do glyph; o range U+0300–U+036F remove marcas
    // combinantes (acentos, til, cedilha decomposta etc.) — assim "Estação"
    // vira "estacao" e "Iemanjá" vira "iemanja" para casar busca digitada
    // sem acento.
    return s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
  }

  const isEditor = $derived(data.currentUser !== null);
  const normalizedQuery = $derived(normalize(query));
  const filtered = $derived(
    normalizedQuery.length === 0
      ? data.hymnbooks
      : data.hymnbooks.filter((hb) => normalize(hb.name).includes(normalizedQuery)),
  );
</script>

<section data-testid="hymnbooks">
  <header class="page-header">
    <p class="eyebrow">Biblioteca</p>
    <h1 class="page-title font-display">Hinários</h1>
    <p class="page-lead">
      Coleções recebidas pelos padrinhos e madrinhas, com revisão editorial.
    </p>
  </header>

  <div class="search">
    <label class="visually-hidden" for="hymnbook-search-input">Buscar hinário</label>
    <input
      id="hymnbook-search-input"
      type="search"
      placeholder="Buscar hinário pelo nome…"
      autocomplete="off"
      bind:value={query}
      data-testid="hymnbook-search"
    />
  </div>

  {#if data.error}
    <p class="error" data-testid="error">Falha ao carregar hinários: {data.error}</p>
  {:else if data.hymnbooks.length === 0}
    <p class="empty" data-testid="empty">Nenhum hinário publicado ainda.</p>
  {:else if filtered.length === 0}
    <p class="empty" data-testid="empty-filter">
      Nenhum hinário casa com “{query}”.
    </p>
  {:else}
    <div class="grid" data-testid="hymnbooks-grid">
      {#each filtered as hb (hb.id)}
        <HymnbookCard hymnbook={hb} showDraftBadge={isEditor} />
      {/each}
    </div>
  {/if}
</section>

<style>
  .page-header {
    margin-bottom: 1.75rem;
  }
  .eyebrow {
    color: var(--color-text-muted);
    font-family: var(--font-sans);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    margin: 0;
    text-transform: uppercase;
  }
  .page-title {
    color: var(--color-text);
    font-size: clamp(2rem, 4vw, 2.75rem);
    font-weight: 600;
    letter-spacing: -0.005em;
    line-height: 1.1;
    margin: 0.5rem 0 0.5rem;
  }
  .page-lead {
    color: var(--color-text-soft);
    margin: 0;
    max-width: 36rem;
  }
  .search {
    margin: 1.5rem 0 1.75rem;
    max-width: 28rem;
  }
  .search input {
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-pill);
    color: var(--color-text);
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    padding: 0.625rem 1rem;
    width: 100%;
  }
  .search input:focus {
    border-color: var(--color-accent);
    outline: 2px solid var(--color-accent-3);
    outline-offset: 1px;
  }
  .visually-hidden {
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    height: 1px;
    overflow: hidden;
    position: absolute;
    white-space: nowrap;
    width: 1px;
  }
  .error {
    color: var(--color-status-not);
  }
  .empty {
    color: var(--color-text-muted);
  }
  .grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  }
</style>
