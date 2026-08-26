<script lang="ts">
  /**
   * Sub-marco 5.F — Ciclos 5F.5 a 5F.8.
   *
   * Tela 1 do wizard: porta de `templates/users/upload.html`. Coleta os
   * dados no `ContribuirForm`, sobe o PDF no endpoint REST do Django e
   * navega pro passo 2 com a `OCRTask` recém-criada na URL.
   */
  import { goto } from "$app/navigation";
  import ContribuirForm from "$lib/components/contribuir/ContribuirForm.svelte";
  import UploadStepper from "$lib/components/contribuir/UploadStepper.svelte";

  import { uploadPdfForOcr } from "./upload-pdf";

  import type { UploadPayload } from "$lib/components/contribuir/ContribuirForm.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let submitting = $state(false);
  let submitError = $state<string | null>(null);

  async function handleUpload(payload: UploadPayload) {
    submitting = true;
    submitError = null;
    const result = await uploadPdfForOcr(fetch, payload);
    submitting = false;
    if (result.ok) {
      await goto(`/contribuir/processando/?task=${result.taskId}`);
    } else {
      submitError = result.message;
    }
  }
</script>

<section data-testid="contribuir-page">
  <p class="eyebrow">Contribuir · novo hinário</p>
  <h1>Subir um PDF para OCR</h1>
  <p class="lead">Vamos extrair os hinos automaticamente. Você confere antes de salvar.</p>

  <div class="stepper">
    <UploadStepper step={1} />
  </div>

  {#if data.error}
    <p class="error" role="alert" data-testid="contribuir-error">
      Não foi possível falar com o servidor: {data.error}
    </p>
  {/if}

  <div class="form-wrap">
    <ContribuirForm onsubmit={handleUpload} {submitting} {submitError} />
  </div>

  {#if data.currentUser}
    <p class="hint" data-testid="contribuir-user">Enviando como {data.currentUser.username}.</p>
  {/if}
</section>

<style>
  section {
    margin: 0 auto;
    max-width: 48rem;
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
  .form-wrap {
    margin-top: 2.5rem;
  }
  .error {
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-status-not);
    border-radius: var(--radius-md);
    color: var(--color-status-not);
    font-size: 0.875rem;
    padding: 0.75rem 1rem;
  }
  .hint {
    color: var(--color-text-muted);
    font-size: 0.875rem;
    margin-top: 1rem;
  }
</style>
