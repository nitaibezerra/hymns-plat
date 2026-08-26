<script lang="ts">
  /**
   * Sub-marco 5.D — Ciclos 5D.12 e 5D.13.
   *
   * Drawer de envio de gravação para um hino. Sobe via `uploadAudio`
   * (scalar `Upload`, multipart habilitado em `apps/api/urls.py`).
   *
   * Não navega e não recarrega listas: avisa `onuploaded` e quem embute
   * decide (invalidar a rota, fechar o drawer, mostrar toast).
   */
  import { uploadAudio, validateAudioFile } from "$lib/graphql/operations/crud";

  export interface AudioTargetHymn {
    id: string;
    number: number;
    title: string;
  }

  let {
    open = false,
    hymn,
    onuploaded,
    onclose,
  }: {
    open?: boolean;
    hymn: AudioTargetHymn;
    onuploaded?: () => void;
    onclose?: () => void;
  } = $props();

  let file = $state<File | null>(null);
  let title = $state("");
  let source = $state("");
  let credits = $state("");
  let allowDownload = $state(false);
  let uploading = $state(false);
  let error = $state<string | null>(null);

  /**
   * 5D.13 — valida na hora da escolha (feedback imediato) e de novo no
   * submit (o input pode ser preenchido por drag-and-drop ou por script).
   */
  function handleFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    file = input.files && input.files.length > 0 ? input.files[0] : null;
    error = file ? validateAudioFile(file) : null;
  }

  const fileInvalid = $derived(file !== null && validateAudioFile(file) !== null);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (uploading) return;
    if (!file) {
      error = "Selecione um arquivo de áudio.";
      return;
    }
    const invalid = validateAudioFile(file);
    if (invalid) {
      error = invalid;
      return;
    }

    uploading = true;
    error = null;
    const result = await uploadAudio(fetch, hymn.id, file, {
      title: title.trim(),
      source: source.trim(),
      credits: credits.trim(),
      allowDownload,
    });
    uploading = false;
    if (result.ok) {
      onuploaded?.();
      return;
    }
    error = result.message;
  }
</script>

{#if open}
  <aside
    class="drawer"
    role="dialog"
    aria-modal="true"
    aria-labelledby="audio-upload-title"
    data-testid="audio-upload-drawer"
  >
    <h2 id="audio-upload-title" class="drawer-title">Enviar gravação</h2>
    <p class="target">
      Hino #{hymn.number} — {hymn.title}
    </p>

    <form class="upload-form" data-testid="audio-upload-form" onsubmit={handleSubmit}>
      <label class="field" for="audio-file">
        <span class="field-label">Arquivo de áudio</span>
        <input
          id="audio-file"
          name="file"
          type="file"
          accept=".mp3,.ogg,.flac,audio/mpeg,audio/ogg,audio/flac"
          onchange={handleFileChange}
          data-testid="field-file"
        />
        <span class="hint">Formatos aceitos: MP3, OGG ou FLAC. Tamanho máximo: 25 MB.</span>
      </label>

      <label class="field" for="audio-title">
        <span class="field-label">Título</span>
        <input id="audio-title" name="title" type="text" bind:value={title} data-testid="field-title" />
      </label>

      <label class="field" for="audio-source">
        <span class="field-label">Fonte</span>
        <input id="audio-source" name="source" type="text" bind:value={source} data-testid="field-source" />
      </label>

      <label class="field" for="audio-credits">
        <span class="field-label">Créditos</span>
        <input
          id="audio-credits"
          name="credits"
          type="text"
          bind:value={credits}
          data-testid="field-credits"
        />
      </label>

      <label class="field field-inline" for="audio-allow-download">
        <input
          id="audio-allow-download"
          name="allowDownload"
          type="checkbox"
          bind:checked={allowDownload}
          data-testid="field-allow-download"
        />
        <span>Permitir download</span>
      </label>

      {#if error}
        <p class="form-error" role="alert" data-testid="upload-error">{error}</p>
      {/if}

      <div class="actions">
        <button type="submit" disabled={uploading || fileInvalid} data-testid="submit-upload">
          {uploading ? "Enviando…" : "Enviar"}
        </button>
        <button type="button" onclick={() => onclose?.()} data-testid="cancel-upload">
          Cancelar
        </button>
      </div>
    </form>
  </aside>
{/if}

<style>
  .drawer {
    background: var(--color-surface);
    border: 1px solid var(--color-border-soft);
    border-radius: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 32rem;
    padding: 1.25rem;
  }
  .drawer-title {
    font-family: var(--font-display);
    font-size: 1.375rem;
    margin: 0;
  }
  .target {
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    margin: 0;
  }
  .upload-form {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  .field-inline {
    align-items: center;
    flex-direction: row;
    gap: 0.5rem;
  }
  .field-label {
    font-family: var(--font-sans);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .hint {
    font-family: var(--font-sans);
    font-size: 0.75rem;
  }
  input[type="text"] {
    background: var(--color-surface);
    border: 1px solid var(--color-border-soft);
    border-radius: 0.5rem;
    font: inherit;
    padding: 0.5rem 0.75rem;
  }
  .actions {
    display: flex;
    gap: 0.75rem;
  }
  .form-error {
    border: 1px solid var(--color-border-soft);
    border-radius: 0.5rem;
    margin: 0;
    padding: 0.625rem 0.875rem;
  }
</style>
