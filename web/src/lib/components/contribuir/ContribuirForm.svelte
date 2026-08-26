<script lang="ts">
  /**
   * Sub-marco 5.F — Ciclos 5F.7 e 5F.8.
   *
   * Porta de `templates/users/upload.html`. Coleta nome, dono, PDF e capa
   * opcional, valida no cliente (espelho de `HymnBookPdfUploadForm`) e só
   * então entrega o payload pra página, que faz o `fetch` multipart.
   *
   * O componente não conhece rede nem navegação — quem sobe o arquivo é
   * `routes/contribuir/+page.svelte`.
   */
  import { validateUploadForm } from "./upload-validation";

  import type { UploadFormErrors } from "./upload-validation";

  export interface UploadPayload {
    name: string;
    ownerName: string;
    pdfFile: File;
    coverImage: File | null;
  }

  let {
    onsubmit,
    submitting = false,
    submitError = null,
  }: {
    onsubmit: (payload: UploadPayload) => void;
    submitting?: boolean;
    submitError?: string | null;
  } = $props();

  let name = $state("");
  let ownerName = $state("");
  let pdfFile = $state<File | null>(null);
  let coverImage = $state<File | null>(null);
  let errors = $state<UploadFormErrors>({});

  function firstFile(event: Event): File | null {
    const input = event.currentTarget as HTMLInputElement;
    return input.files?.[0] ?? null;
  }

  function handlePdfChange(event: Event) {
    pdfFile = firstFile(event);
  }

  function handleCoverChange(event: Event) {
    coverImage = firstFile(event);
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    const found = validateUploadForm({ name, ownerName, pdfFile });
    errors = found;
    if (Object.keys(found).length > 0 || !pdfFile) return;
    onsubmit({ name: name.trim(), ownerName: ownerName.trim(), pdfFile, coverImage });
  }
</script>

<form onsubmit={handleSubmit} data-testid="contribuir-form" novalidate>
  <label class="field">
    <span class="label">Nome do hinário</span>
    <input
      type="text"
      name="name"
      placeholder="Ex: O Justiceiro"
      bind:value={name}
      data-testid="name-input"
      aria-invalid={errors.name ? "true" : undefined}
    />
    {#if errors.name}
      <p class="field-error" data-testid="error-name">{errors.name}</p>
    {/if}
  </label>

  <label class="field">
    <span class="label">Dono / autor</span>
    <input
      type="text"
      name="owner_name"
      placeholder="Ex: Padrinho Sebastião"
      bind:value={ownerName}
      data-testid="owner-input"
      aria-invalid={errors.ownerName ? "true" : undefined}
    />
    {#if errors.ownerName}
      <p class="field-error" data-testid="error-ownerName">{errors.ownerName}</p>
    {/if}
  </label>

  <label class="field">
    <span class="label">Arquivo PDF</span>
    <input
      type="file"
      name="pdf_file"
      accept=".pdf"
      onchange={handlePdfChange}
      data-testid="pdf-input"
      aria-invalid={errors.pdfFile ? "true" : undefined}
    />
    <p class="help">
      Envie um PDF gerado pelo hymn_pdf_generator. Máximo de 50 MB. A extração via OCR pode levar
      alguns minutos.
    </p>
    {#if errors.pdfFile}
      <p class="field-error" data-testid="error-pdfFile">{errors.pdfFile}</p>
    {/if}
  </label>

  <label class="field">
    <span class="label">Imagem de capa · opcional</span>
    <input
      type="file"
      name="cover_image"
      accept="image/*"
      onchange={handleCoverChange}
      data-testid="cover-input"
    />
    <p class="help">JPG, PNG ou GIF. Tamanho recomendado: 600x800px.</p>
  </label>

  <p class="notice">A extração via OCR pode levar 1–3 minutos.</p>

  {#if submitError}
    <p class="field-error" role="alert" data-testid="submit-error">{submitError}</p>
  {/if}

  <button type="submit" disabled={submitting} data-testid="contribuir-submit">
    {submitting ? "Enviando…" : "Enviar PDF →"}
  </button>
</form>

<style>
  form {
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    display: grid;
    gap: 1.25rem;
    padding: 2rem;
  }
  .field {
    display: grid;
    gap: 0.375rem;
  }
  .label {
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  input[type="text"] {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text);
    font: inherit;
    padding: 0.625rem 0.75rem;
    width: 100%;
  }
  input[aria-invalid="true"] {
    border-color: var(--color-status-not);
  }
  .help {
    color: var(--color-text-muted);
    font-size: 0.75rem;
    margin: 0;
  }
  .field-error {
    color: var(--color-status-not);
    font-size: 0.8125rem;
    margin: 0;
  }
  .notice {
    background: var(--color-bg-deep);
    border: 1px solid var(--color-gold-soft);
    border-radius: var(--radius-md);
    color: var(--color-gold);
    font-size: 0.875rem;
    margin: 0;
    padding: 0.75rem 1rem;
  }
  button {
    background: var(--color-accent);
    border: none;
    border-radius: var(--radius-pill);
    color: var(--color-bg);
    cursor: pointer;
    font: inherit;
    justify-self: start;
    padding: 0.625rem 1.25rem;
  }
  button:disabled {
    cursor: progress;
    opacity: 0.6;
  }
</style>
