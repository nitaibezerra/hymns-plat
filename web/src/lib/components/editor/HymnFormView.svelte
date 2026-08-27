<script lang="ts">
  /**
   * Sub-marco 5.D — Ciclos 5D.8 a 5D.10.
   *
   * Form headless de hino, espelhando o `HymnForm` do Django
   * (`apps/hymns/forms.py`) e o template `templates/hymns/hymn_form.html`.
   *
   * Diferença deliberada em relação ao form Django: `received_at` NÃO
   * aparece. `HymnInput`/`HymnUpdateInput` (5.A) não expõem esse campo, então
   * um input aqui não teria pra onde ir. Quando o schema ganhar `receivedAt`
   * de escrita, é só acrescentar mais um campo — nada mais muda.
   *
   * A unicidade de `number` dentro do hinário é validada no backend
   * (`HymnForm.clean_number`); o cliente só desenha o erro que voltar.
   */
  import { untrack } from "svelte";

  export interface HymnFormValues {
    number: number;
    title: string;
    text: string;
    style: string;
    repetitions: string;
    extraInstructions: string;
    offeredTo: string;
    section: string;
  }

  const EMPTY: HymnFormValues = {
    number: 1,
    title: "",
    text: "",
    style: "",
    repetitions: "",
    extraInstructions: "",
    offeredTo: "",
    section: "",
  };

  let {
    initial = EMPTY,
    submitLabel = "Salvar",
    submitting = false,
    error = null,
    cancelHref = null,
    onsubmit,
  }: {
    initial?: HymnFormValues;
    submitLabel?: string;
    submitting?: boolean;
    error?: string | null;
    cancelHref?: string | null;
    onsubmit?: (values: HymnFormValues) => void | Promise<void>;
  } = $props();

  // `untrack` deixa explícito que `initial` é só semente.
  let number = $state(untrack(() => initial.number));
  let title = $state(untrack(() => initial.title));
  let text = $state(untrack(() => initial.text));
  let style = $state(untrack(() => initial.style));
  let repetitions = $state(untrack(() => initial.repetitions));
  let extraInstructions = $state(untrack(() => initial.extraInstructions));
  let offeredTo = $state(untrack(() => initial.offeredTo));
  let section = $state(untrack(() => initial.section));

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    onsubmit?.({
      number: Number(number),
      title: title.trim(),
      text,
      style: style.trim(),
      repetitions: repetitions.trim(),
      extraInstructions: extraInstructions.trim(),
      offeredTo: offeredTo.trim(),
      section: section.trim(),
    });
  }
</script>

<form class="hymn-form" data-testid="hymn-form" onsubmit={handleSubmit}>
  {#if error}
    <p class="form-error" role="alert" data-testid="form-error">{error}</p>
  {/if}

  <label class="field field-narrow" for="hymn-number">
    <span class="field-label">Número</span>
    <input
      id="hymn-number"
      name="number"
      type="number"
      min="1"
      required
      bind:value={number}
      data-testid="field-number"
    />
  </label>

  <label class="field" for="hymn-title">
    <span class="field-label">Título</span>
    <input id="hymn-title" name="title" type="text" required bind:value={title} data-testid="field-title" />
  </label>

  <label class="field" for="hymn-text">
    <span class="field-label">Letra</span>
    <textarea
      id="hymn-text"
      name="text"
      rows="12"
      placeholder="Letra do hino"
      bind:value={text}
      data-testid="field-text"
    ></textarea>
  </label>

  <label class="field" for="hymn-style">
    <span class="field-label">Estilo</span>
    <input
      id="hymn-style"
      name="style"
      type="text"
      placeholder="Ex: Valsa, Marcha"
      bind:value={style}
      data-testid="field-style"
    />
  </label>

  <label class="field" for="hymn-repetitions">
    <span class="field-label">Repetições</span>
    <input
      id="hymn-repetitions"
      name="repetitions"
      type="text"
      placeholder="Ex: 1-4, 5-8"
      bind:value={repetitions}
      data-testid="field-repetitions"
    />
  </label>

  <label class="field" for="hymn-extra-instructions">
    <span class="field-label">Instruções</span>
    <textarea
      id="hymn-extra-instructions"
      name="extraInstructions"
      rows="2"
      bind:value={extraInstructions}
      data-testid="field-extra-instructions"
    ></textarea>
  </label>

  <label class="field" for="hymn-offered-to">
    <span class="field-label">Oferecido para</span>
    <input
      id="hymn-offered-to"
      name="offeredTo"
      type="text"
      bind:value={offeredTo}
      data-testid="field-offered-to"
    />
  </label>

  <label class="field" for="hymn-section">
    <span class="field-label">Seção</span>
    <input
      id="hymn-section"
      name="section"
      type="text"
      bind:value={section}
      data-testid="field-section"
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
  .hymn-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 44rem;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  .field-narrow {
    max-width: 8rem;
  }
  .field-label {
    font-family: var(--font-sans);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  input[type="text"],
  input[type="number"],
  textarea {
    background: var(--color-surface);
    border: 1px solid var(--color-border-soft);
    border-radius: 0.5rem;
    font: inherit;
    padding: 0.5rem 0.75rem;
  }
  textarea[name="text"] {
    font-family: var(--font-serif);
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
