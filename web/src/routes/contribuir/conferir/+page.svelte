<script lang="ts">
  /**
   * Sub-marco 5.F — Ciclo 5F.14.
   *
   * Tela 3b do wizard: porta de `templates/users/upload_preview.html`. Duas
   * colunas — a prévia do texto extraído à esquerda e o resumo + tabela à
   * direita, com o aviso de rascunho em destaque.
   */
  import OcrPreviewTable from "$lib/components/contribuir/OcrPreviewTable.svelte";
  import UploadStepper from "$lib/components/contribuir/UploadStepper.svelte";

  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<section data-testid="conferir-page">
  <p class="eyebrow">Contribuir · conferir</p>
  <h1>Conferir o hinário extraído</h1>
  <p class="lead">Confira o que o OCR entendeu antes de salvar.</p>

  <div class="stepper">
    <UploadStepper step={3} />
  </div>

  {#if data.error}
    <p class="error" role="alert" data-testid="conferir-error">{data.error}</p>
  {/if}

  <div class="columns">
    <article class="preview" data-testid="conferir-preview">
      <p class="block-label">Pré-visualização do conteúdo extraído</p>
      <div class="hymns">
        {#each data.previewHymns as hymn, i (`${hymn.number ?? "s"}-${i}`)}
          <article class="hymn">
            <p class="hymn-title">{hymn.number} — {hymn.title}</p>
            <pre class="hymn-text">{hymn.text}</pre>
          </article>
        {/each}
      </div>
    </article>

    <aside class="side">
      <div class="draft" data-testid="draft-warning">
        <p class="draft-title">Será criado como rascunho</p>
        <p class="draft-body">
          O hinário entra como <strong>não publicado</strong> e cada hino como
          <strong>não revisado</strong>. Use o workspace do editor para revisar antes de publicar.
        </p>
      </div>

      <div class="card">
        <header class="card-head" data-testid="conferir-summary">
          <p class="book-name">{data.name}</p>
          <span class="detected">Detectado · {data.totalHymns} hinos</span>
          <p class="owner">{data.owner}</p>
        </header>

        <div class="table">
          <OcrPreviewTable hymns={data.previewHymns} totalHymns={data.totalHymns} />
        </div>

        <footer class="actions">
          <a class="back" href="/contribuir/">← Voltar</a>
        </footer>
      </div>
    </aside>
  </div>
</section>

<style>
  section {
    margin: 0 auto;
    max-width: 72rem;
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
  .columns {
    display: grid;
    gap: 1.5rem;
    grid-template-columns: 1fr;
    margin-top: 2rem;
  }
  @media (min-width: 62rem) {
    .columns {
      grid-template-columns: 1fr 1.1fr;
    }
  }
  .preview,
  .card {
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
  }
  .block-label {
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.625rem;
    letter-spacing: 0.12em;
    margin: 0 0 1rem;
    text-transform: uppercase;
  }
  .hymns {
    display: grid;
    gap: 1.5rem;
    max-height: 28rem;
    overflow-y: auto;
  }
  .hymn-title {
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    letter-spacing: 0.1em;
    margin: 0;
    text-align: center;
    text-transform: uppercase;
  }
  .hymn-text {
    font-family: var(--font-serif);
    font-size: 1rem;
    line-height: 1.7;
    margin: 0.5rem 0 0;
    white-space: pre-wrap;
  }
  .side {
    display: grid;
    gap: 1rem;
  }
  .draft {
    background: var(--color-bg-deep);
    border: 1px solid var(--color-gold-soft);
    border-radius: var(--radius-md);
    padding: 1rem 1.25rem;
  }
  .draft-title {
    font-weight: 600;
    margin: 0;
  }
  .draft-body {
    color: var(--color-text-soft);
    font-size: 0.875rem;
    margin: 0.25rem 0 0;
  }
  .card-head {
    display: grid;
    gap: 0.125rem;
  }
  .book-name {
    font-family: var(--font-display);
    font-size: 1.75rem;
    margin: 0;
  }
  .detected {
    color: var(--color-status-ok);
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .owner {
    color: var(--color-text-soft);
    margin: 0.25rem 0 0;
  }
  .table {
    margin-top: 1.25rem;
  }
  .actions {
    align-items: center;
    display: flex;
    gap: 0.75rem;
    justify-content: space-between;
    margin-top: 1.5rem;
  }
  .back {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-pill);
    color: var(--color-text);
    font-size: 0.875rem;
    padding: 0.5rem 1rem;
    text-decoration: none;
  }
</style>
