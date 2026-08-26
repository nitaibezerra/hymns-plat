<script lang="ts">
  /**
   * Sub-marco 5.D — Ciclos 5D.1 a 5D.4.
   *
   * Form headless de hinário, espelhando o `HymnBookForm` do Django
   * (`apps/hymns/forms.py`) e o template `templates/hymns/hymnbook_form.html`:
   * nome, nome curto, dono/autor, descrição e imagem de capa.
   *
   * O campo de capa só passou a existir no schema com o 5.A½
   * (`HymnBookInput.coverImage: Upload`) — por isso ele sai daqui como
   * `File | null` separado dos valores de texto: quem submete decide se vai
   * por JSON (sem capa) ou multipart (com capa).
   *
   * O componente é burro de propósito: não conhece GraphQL. Quem monta a
   * mutation é a rota (`novo/` ou `[slug]/editar/`).
   */

  import { untrack } from "svelte";

  export interface HymnBookFormValues {
    name: string;
    introName: string;
    ownerName: string;
    description: string;
  }

  export interface HymnBookFormSubmit {
    values: HymnBookFormValues;
    coverFile: File | null;
  }

  const EMPTY: HymnBookFormValues = {
    name: "",
    introName: "",
    ownerName: "",
    description: "",
  };

  let {
    initial = EMPTY,
    submitLabel = "Salvar",
    submitting = false,
    error = null,
    coverUrl = null,
    cancelHref = null,
    onsubmit,
  }: {
    initial?: HymnBookFormValues;
    submitLabel?: string;
    submitting?: boolean;
    error?: string | null;
    /** Capa atual (modo edição) — mostrada como preview do que já existe. */
    coverUrl?: string | null;
    cancelHref?: string | null;
    onsubmit?: (payload: HymnBookFormSubmit) => void | Promise<void>;
  } = $props();

  // `untrack` deixa explícito que `initial` é só semente: depois do primeiro
  // render quem manda são os campos editados pelo usuário.
  let name = $state(untrack(() => initial.name));
  let introName = $state(untrack(() => initial.introName));
  let ownerName = $state(untrack(() => initial.ownerName));
  let description = $state(untrack(() => initial.description));
  let coverFile = $state<File | null>(null);

  function handleCoverChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    coverFile = input.files && input.files.length > 0 ? input.files[0] : null;
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    onsubmit?.({
      values: {
        name: name.trim(),
        introName: introName.trim(),
        ownerName: ownerName.trim(),
        description: description.trim(),
      },
      coverFile,
    });
  }
</script>

<form class="hb-form" data-testid="hymnbook-form" onsubmit={handleSubmit}>
  {#if error}
    <p class="form-error" role="alert" data-testid="form-error">{error}</p>
  {/if}

  <label class="field" for="hb-name">
    <span class="field-label">Nome do hinário</span>
    <input
      id="hb-name"
      name="name"
      type="text"
      required
      placeholder="Ex: O Cruzeiro"
      bind:value={name}
      data-testid="field-name"
    />
  </label>

  <label class="field" for="hb-intro-name">
    <span class="field-label">Nome curto</span>
    <input
      id="hb-intro-name"
      name="introName"
      type="text"
      placeholder="Nome curto (opcional)"
      bind:value={introName}
      data-testid="field-intro-name"
    />
  </label>

  <label class="field" for="hb-owner-name">
    <span class="field-label">Dono / Autor</span>
    <input
      id="hb-owner-name"
      name="ownerName"
      type="text"
      required
      placeholder="Ex: Mestre Irineu"
      bind:value={ownerName}
      data-testid="field-owner-name"
    />
  </label>

  <label class="field" for="hb-description">
    <span class="field-label">Descrição</span>
    <textarea
      id="hb-description"
      name="description"
      rows="4"
      placeholder="Descrição do hinário (opcional)"
      bind:value={description}
      data-testid="field-description"
    ></textarea>
  </label>

  <label class="field" for="hb-cover-image">
    <span class="field-label">Imagem de capa</span>
    {#if coverUrl}
      <img class="cover-preview" src={coverUrl} alt="Capa atual do hinário" data-testid="cover-atual" />
    {/if}
    <input
      id="hb-cover-image"
      name="coverImage"
      type="file"
      accept="image/*"
      onchange={handleCoverChange}
      data-testid="field-cover-image"
    />
  </label>

  <div class="actions">
    <button type="submit" disabled={submitting} data-testid="submit">
      {submitting ? "Salvando…" : submitLabel}
    </button>
    {#if cancelHref}
      <a class="cancel" href={cancelHref} data-testid="cancel">Cancelar</a>
    {/if}
  </div>
</form>

<style>
  .hb-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 40rem;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  .field-label {
    font-family: var(--font-sans);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  input[type="text"],
  textarea {
    background: var(--color-surface);
    border: 1px solid var(--color-border-soft);
    border-radius: 0.5rem;
    font: inherit;
    padding: 0.5rem 0.75rem;
  }
  .cover-preview {
    border-radius: 0.5rem;
    max-width: 12rem;
  }
  .actions {
    align-items: center;
    display: flex;
    gap: 1rem;
  }
  .form-error {
    border: 1px solid var(--color-border-soft);
    border-radius: 0.5rem;
    padding: 0.625rem 0.875rem;
  }
</style>
