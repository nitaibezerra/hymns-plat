<script lang="ts">
  /**
   * Sub-marco 5.F — Ciclos 5F.12 e 5F.13.
   *
   * Tela 3a do wizard: porta de `templates/users/upload_disambiguate.html`.
   * Mostra o que está sendo enviado, o match exato (quando houver) e os
   * hinários similares com os dois scores; a escolha do que fazer fica no
   * `DisambiguationChoice` (5F.13).
   */
  import SimilarBookCard from "$lib/components/contribuir/SimilarBookCard.svelte";
  import UploadStepper from "$lib/components/contribuir/UploadStepper.svelte";

  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<section data-testid="desambiguar-page">
  <p class="eyebrow">Contribuir · desambiguar</p>
  <h1>Hinário similar encontrado</h1>
  <p class="lead">
    Encontramos hinário(s) parecido(s) com o que você está enviando. O que deseja fazer?
  </p>

  <div class="stepper">
    <UploadStepper step={3} />
  </div>

  {#if data.error}
    <p class="error" role="alert" data-testid="desambiguar-error">{data.error}</p>
  {/if}

  <div class="summary" data-testid="upload-summary">
    <p class="summary-label">Hinário que você está enviando</p>
    <p class="summary-name">{data.uploadName} · {data.hymnsCount} hinos</p>
  </div>

  {#if data.duplicates.exactMatch}
    <div class="exact" role="alert" data-testid="exact-match">
      <p class="exact-title">Match exato encontrado</p>
      <p class="exact-body">
        Já existe um hinário com o nome <strong>{data.duplicates.exactMatch.name}</strong> no
        sistema.
      </p>
    </div>
  {/if}

  {#if data.duplicates.similar.length > 0}
    <h2 class="section-title">Hinários similares</h2>
    <div class="similars">
      {#each data.duplicates.similar as similar (similar.hymnbook.id)}
        <SimilarBookCard {similar} />
      {/each}
    </div>
  {/if}
</section>

<style>
  section {
    margin: 0 auto;
    max-width: 56rem;
  }
  .eyebrow {
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    letter-spacing: 0.12em;
    margin: 0;
    text-transform: uppercase;
  }
  h1 {
    font-family: var(--font-display);
    font-size: 2.25rem;
    margin: 0.5rem 0 0;
  }
  .lead {
    color: var(--color-text-soft);
    margin: 0.5rem 0 0;
  }
  .stepper {
    margin-top: 2rem;
  }
  .error {
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-status-not);
    border-radius: var(--radius-md);
    color: var(--color-status-not);
    font-size: 0.875rem;
    padding: 0.75rem 1rem;
  }
  .summary {
    background: var(--color-bg-deep);
    border: 1px solid var(--color-gold-soft);
    border-radius: var(--radius-md);
    margin-top: 2.5rem;
    padding: 1rem 1.25rem;
  }
  .summary-label {
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    letter-spacing: 0.12em;
    margin: 0;
    text-transform: uppercase;
  }
  .summary-name {
    font-family: var(--font-display);
    font-size: 1.375rem;
    margin: 0.25rem 0 0;
  }
  .exact {
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-status-not);
    border-radius: var(--radius-md);
    margin-top: 1.25rem;
    padding: 1rem 1.25rem;
  }
  .exact-title {
    color: var(--color-status-not);
    font-weight: 600;
    margin: 0;
  }
  .exact-body {
    color: var(--color-text-soft);
    font-size: 0.9375rem;
    margin: 0.25rem 0 0;
  }
  .section-title {
    font-family: var(--font-display);
    font-size: 1.5rem;
    margin: 2rem 0 0.75rem;
  }
  .similars {
    display: grid;
    gap: 0.75rem;
  }
</style>
