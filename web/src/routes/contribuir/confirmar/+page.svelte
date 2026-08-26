<script lang="ts">
  /**
   * Sub-marco 5.F — Ciclo 5F.16.
   *
   * Tela 4 do wizard: porta de `templates/users/upload_confirm.html`. Resume o
   * hinário de destino e a nova versão, e fecha o fluxo chamando
   * `createHymnBookVersionFromOcr` — que recebe task, hinário e nome por
   * argumento, sem estado implícito de servidor.
   */
  import { goto } from "$app/navigation";
  import UploadStepper from "$lib/components/contribuir/UploadStepper.svelte";

  import { createHymnBookVersionFromOcr } from "../ocr-import";

  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let submitting = $state(false);
  let submitError = $state<string | null>(null);

  async function handleConfirm() {
    if (!data.target) return;
    submitting = true;
    submitError = null;
    const result = await createHymnBookVersionFromOcr(
      fetch,
      data.taskId,
      data.target.slug,
      data.versionName,
    );
    submitting = false;
    if (result.ok) {
      await goto(`/hinarios/${result.slug}/`);
    } else {
      submitError = result.message;
    }
  }
</script>

<section data-testid="confirmar-page">
  <p class="eyebrow">Contribuir · confirmar</p>
  <h1>Confirmar nova versão</h1>
  <p class="lead">Você está adicionando uma nova versão de um hinário que já existe.</p>

  <div class="stepper">
    <UploadStepper step={4} />
  </div>

  {#if data.error}
    <p class="error" role="alert" data-testid="confirmar-error">{data.error}</p>
  {/if}

  {#if data.target}
    <div class="card">
      <div class="block" data-testid="confirmar-target">
        <p class="block-label">Hinário existente</p>
        <p class="target-name">
          <a href={`/hinarios/${data.target.slug}/`}>{data.target.name}</a>
        </p>
        <p class="meta">{data.target.ownerName} · {data.target.hymnsTotal} hinos</p>
      </div>

      <div class="block bordered" data-testid="confirmar-version">
        <p class="block-label">Nova versão</p>
        <p class="version-name">{data.versionName}</p>
        <p class="meta">Arquivo: {data.pdfFilename} · {data.totalHymns} hinos extraídos</p>
      </div>

      <p class="notice" data-testid="confirmar-notice">
        A nova versão <strong>não será marcada como primária</strong> automaticamente. O arquivo
        extraído fica guardado para referência futura.
      </p>

      {#if submitError}
        <p class="submit-error" role="alert" data-testid="confirmar-submit-error">{submitError}</p>
      {/if}

      <footer class="actions">
        <button type="button" onclick={handleConfirm} disabled={submitting} data-testid="confirmar-submit">
          {submitting ? "Criando…" : "Confirmar e criar versão"}
        </button>
        <a class="cancel" href="/contribuir/">Cancelar</a>
      </footer>
    </div>
  {/if}
</section>

<style>
  section {
    margin: 0 auto;
    max-width: 44rem;
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
  .card {
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    margin-top: 2.5rem;
    padding: 1.75rem;
  }
  .block-label {
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.625rem;
    letter-spacing: 0.12em;
    margin: 0 0 0.25rem;
    text-transform: uppercase;
  }
  .bordered {
    border-top: 1px solid var(--color-border-soft);
    margin-top: 1.25rem;
    padding-top: 1.25rem;
  }
  .target-name {
    font-family: var(--font-display);
    font-size: 1.625rem;
    margin: 0;
  }
  .target-name a {
    color: var(--color-text);
    text-decoration: none;
  }
  .target-name a:hover {
    text-decoration: underline;
  }
  .version-name {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0;
  }
  .meta {
    color: var(--color-text-soft);
    font-size: 0.875rem;
    margin: 0.25rem 0 0;
  }
  .notice {
    background: var(--color-bg-deep);
    border: 1px solid var(--color-gold-soft);
    border-radius: var(--radius-md);
    color: var(--color-text-soft);
    font-size: 0.875rem;
    margin: 1.5rem 0 0;
    padding: 0.75rem 1rem;
  }
  .submit-error {
    color: var(--color-status-not);
    font-size: 0.875rem;
    margin: 1rem 0 0;
  }
  .actions {
    align-items: center;
    display: flex;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }
  .actions button {
    background: var(--color-accent);
    border: none;
    border-radius: var(--radius-pill);
    color: var(--color-bg);
    cursor: pointer;
    font: inherit;
    font-size: 0.875rem;
    padding: 0.5rem 1.25rem;
  }
  .actions button:disabled {
    cursor: progress;
    opacity: 0.6;
  }
  .cancel {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-pill);
    color: var(--color-text);
    font-size: 0.875rem;
    padding: 0.5rem 1rem;
    text-decoration: none;
  }
</style>
