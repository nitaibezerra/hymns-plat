<script lang="ts">
  /**
   * Sub-marco 5.E — Ciclo 5E.1.
   *
   * Tela 07c · Revisão ágil. Primeiro passo: cabeçalho + prévia do hino
   * corrente escolhido pela load. Pílulas, atalhos, submit e navegação
   * entram nos ciclos seguintes.
   */
  import HymnBody from "$lib/components/HymnBody.svelte";

  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<section class="quick-review" data-testid="quick-review-page">
  <header class="topbar">
    <a class="back" href={`/editor/hinarios/${data.hymnbook.slug}/`}>← {data.hymnbook.name}</a>
    <div class="headline">
      <p class="screen-name">Revisão ágil · Estilo &amp; Repetições</p>
    </div>
  </header>

  {#if data.current}
    <section class="preview" data-testid="quick-review-preview">
      <p class="eyebrow">Prévia · como o leitor vai ver</p>
      <article class="preview-card">
        <h1 class="preview-title" data-testid="quick-review-title">
          {data.current.number} - {data.current.title}
        </h1>
        <HymnBody body={data.current.body} />
      </article>
    </section>
  {/if}
</section>

<style>
  .quick-review {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .topbar {
    align-items: baseline;
    border-bottom: 1px solid var(--color-border-soft);
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: space-between;
    padding-bottom: 0.75rem;
  }
  .back {
    color: var(--color-text-soft);
    font-family: var(--font-mono, monospace);
    font-size: 0.75rem;
    letter-spacing: 0.12em;
    text-decoration: none;
    text-transform: uppercase;
  }
  .back:hover {
    color: var(--color-accent);
  }
  .screen-name {
    font-family: var(--font-display, serif);
    font-size: 1.25rem;
    margin: 0;
  }
  .eyebrow {
    color: var(--color-text-soft);
    font-family: var(--font-mono, monospace);
    font-size: 0.6875rem;
    letter-spacing: 0.12em;
    margin: 0 0 0.75rem;
    text-transform: uppercase;
  }
  .preview-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border-soft);
    border-radius: 0.75rem;
    padding: 1.5rem;
  }
  .preview-title {
    font-family: var(--font-display, serif);
    font-size: 1.5rem;
    margin: 0 0 1.25rem;
    text-align: center;
  }
</style>
