<script lang="ts">
  /**
   * Sub-marco 5.E — Ciclos 5E.1 e 5E.2.
   *
   * Tela 07c · Revisão ágil. Duas colunas, como o template Django: prévia à
   * esquerda ("como o leitor vai ver"), os dois parâmetros objetivos à
   * direita. Submit e navegação entram nos ciclos seguintes.
   */
  import HymnBody from "$lib/components/HymnBody.svelte";
  import QuickReviewPills from "$lib/components/editor/QuickReviewPills.svelte";
  import type { QuickReviewValues } from "$lib/components/editor/QuickReviewPills.svelte";

  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  /**
   * Rascunho local dos dois campos. Nasce do que está gravado no hino e é
   * re-semeado sempre que a load troca de hino (navegar por `?h=` mantém o
   * componente montado).
   */
  let values = $state<QuickReviewValues>({ style: "", repetitions: "" });
  let seededFor = $state<string | null>(null);

  $effect(() => {
    const current = data.current;
    if (!current || seededFor === current.id) return;
    seededFor = current.id;
    values = { style: current.style, repetitions: current.repetitions };
  });
</script>

<section class="quick-review" data-testid="quick-review-page">
  <header class="topbar">
    <a class="back" href={`/editor/hinarios/${data.hymnbook.slug}/`}>← {data.hymnbook.name}</a>
    <div class="headline">
      <p class="screen-name">Revisão ágil · Estilo &amp; Repetições</p>
    </div>
  </header>

  {#if data.current}
    <div class="columns">
      <section class="preview" data-testid="quick-review-preview">
        <p class="eyebrow">Prévia · como o leitor vai ver</p>
        <article class="preview-card">
          <h1 class="preview-title" data-testid="quick-review-title">
            {data.current.number} - {data.current.title}
          </h1>
          <HymnBody body={data.current.body} />
        </article>
      </section>

      <section class="params">
        <div class="params-head">
          <p class="eyebrow">Parâmetros objetivos</p>
          <span class="eyebrow">Atalhos de teclado ativos</span>
        </div>

        <QuickReviewPills
          style={values.style}
          repetitions={values.repetitions}
          onchange={(next) => (values = next)}
        />

        <p class="disclaimer" data-testid="quick-review-disclaimer">
          <strong>Esta tela não conclui a revisão.</strong>
          Para marcar o hino como revisado é preciso passar pela revisão completa
          (texto + áudio).
        </p>
      </section>
    </div>
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
  .columns {
    align-items: start;
    display: grid;
    gap: 2rem;
  }
  @media (min-width: 60rem) {
    .columns {
      grid-template-columns: 1fr 1fr;
    }
  }
  .params {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .params-head {
    align-items: baseline;
    display: flex;
    gap: 1rem;
    justify-content: space-between;
  }
  .params-head .eyebrow {
    margin: 0;
  }
  .disclaimer {
    background: var(--color-surface-soft, transparent);
    border: 1px solid var(--color-border-soft);
    border-radius: 0.5rem;
    color: var(--color-text-soft);
    font-size: 0.875rem;
    margin: 0;
    padding: 0.75rem 1rem;
  }
</style>
