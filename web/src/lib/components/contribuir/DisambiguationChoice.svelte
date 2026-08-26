<script lang="ts">
  /**
   * Sub-marco 5.F — Ciclo 5F.13.
   *
   * Porta do formulário de escolha de `upload_disambiguate.html` +
   * `DisambiguationChoiceForm`. Três opções, com `create_new` como default
   * (igual ao `initial` do form Django).
   *
   * Diferença deliberada em relação ao Django: em vez de deixar o usuário
   * submeter e voltar com `ValidationError`, o submit fica **desabilitado**
   * enquanto `add_version` está incompleto, com a razão visível ao lado. A
   * regra é a mesma (`validateChoice` porta o `clean()`), só o momento de
   * mostrá-la muda.
   */
  import { CHOICE_ADD_VERSION, CHOICE_CANCEL, CHOICE_CREATE_NEW, validateChoice } from "./choice-validation";

  import type { ChoiceKind, ChoiceValues } from "./choice-validation";
  import type { SimilarBook } from "./duplicates";

  let {
    similar,
    onchoose,
  }: {
    similar: SimilarBook[];
    onchoose: (values: ChoiceValues) => void;
  } = $props();

  let kind = $state<ChoiceKind>(CHOICE_CREATE_NEW);
  let hymnbookSlug = $state("");
  let versionName = $state("");

  const hasSimilar = $derived(similar.length > 0);

  /**
   * Só `add_version` leva hinário/versão adiante — nas outras escolhas os
   * campos são ruído, e mandá-los faria a URL do próximo passo mentir.
   */
  const values = $derived<ChoiceValues>(
    kind === CHOICE_ADD_VERSION
      ? { kind, hymnbookSlug, versionName: versionName.trim() }
      : { kind, hymnbookSlug: "", versionName: "" },
  );

  const blockedReason = $derived(validateChoice(values));

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (blockedReason) return;
    onchoose(values);
  }
</script>

<form onsubmit={handleSubmit} data-testid="disambiguation-choice">
  <h2>Escolha uma ação</h2>

  <label class="option" data-selected={kind === CHOICE_CREATE_NEW}>
    <input
      type="radio"
      name="choice"
      value={CHOICE_CREATE_NEW}
      checked={kind === CHOICE_CREATE_NEW}
      onchange={() => (kind = CHOICE_CREATE_NEW)}
      data-testid="choice-create-new"
    />
    <span class="option-body">
      <strong>Criar novo hinário</strong>
      <span class="option-help">São hinários diferentes. Criar como um novo hinário separado.</span>
    </span>
  </label>

  {#if hasSimilar}
    <label class="option" data-selected={kind === CHOICE_ADD_VERSION}>
      <input
        type="radio"
        name="choice"
        value={CHOICE_ADD_VERSION}
        checked={kind === CHOICE_ADD_VERSION}
        onchange={() => (kind = CHOICE_ADD_VERSION)}
        data-testid="choice-add-version"
      />
      <span class="option-body">
        <strong>Adicionar como nova versão</strong>
        <span class="option-help">É o mesmo hinário, mas uma versão diferente.</span>

        {#if kind === CHOICE_ADD_VERSION}
          <span class="version-fields">
            <span class="field">
              <span class="field-label">Selecione o hinário</span>
              <select bind:value={hymnbookSlug} data-testid="choice-hymnbook">
                <option value="">— Escolha um hinário —</option>
                {#each similar as item (item.hymnbook.id)}
                  <option value={item.hymnbook.slug}>{item.hymnbook.name}</option>
                {/each}
              </select>
            </span>
            <span class="field">
              <span class="field-label">Nome da versão</span>
              <input
                type="text"
                placeholder="Ex: Edição 2020"
                bind:value={versionName}
                data-testid="choice-version-name"
              />
            </span>
          </span>
        {/if}
      </span>
    </label>
  {/if}

  <label class="option" data-selected={kind === CHOICE_CANCEL}>
    <input
      type="radio"
      name="choice"
      value={CHOICE_CANCEL}
      checked={kind === CHOICE_CANCEL}
      onchange={() => (kind = CHOICE_CANCEL)}
      data-testid="choice-cancel"
    />
    <span class="option-body">
      <strong>Cancelar envio</strong>
      <span class="option-help">Não enviar este hinário agora.</span>
    </span>
  </label>

  {#if blockedReason}
    <p class="hint" data-testid="choice-hint">{blockedReason}</p>
  {/if}

  <button type="submit" disabled={blockedReason !== null} data-testid="choice-submit">
    Continuar
  </button>
</form>

<style>
  form {
    display: grid;
    gap: 0.75rem;
    margin-top: 2rem;
  }
  h2 {
    font-family: var(--font-display);
    font-size: 1.5rem;
    margin: 0 0 0.25rem;
  }
  .option {
    align-items: flex-start;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    display: flex;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
  }
  .option[data-selected="true"] {
    border-color: var(--color-accent);
  }
  .option-body {
    display: grid;
    gap: 0.25rem;
  }
  .option-help {
    color: var(--color-text-soft);
    font-size: 0.875rem;
  }
  .version-fields {
    display: grid;
    gap: 0.625rem;
    margin-top: 0.75rem;
  }
  .field {
    display: grid;
    gap: 0.25rem;
  }
  .field-label {
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.625rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  select,
  input[type="text"] {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text);
    font: inherit;
    padding: 0.5rem 0.625rem;
    width: 100%;
  }
  .hint {
    color: var(--color-status-mid);
    font-size: 0.8125rem;
    margin: 0;
  }
  button {
    background: var(--color-accent);
    border: none;
    border-radius: var(--radius-pill);
    color: var(--color-bg);
    cursor: pointer;
    font: inherit;
    justify-self: start;
    padding: 0.625rem 1.5rem;
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
</style>
