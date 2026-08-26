<script lang="ts">
  /**
   * Sub-marco 5.D — Ciclo 5D.5.
   *
   * Confirmação destrutiva do hinário. O template Django
   * (`hymnbook_confirm_delete.html`) pede só um clique porque vive numa
   * página própria; aqui o modal fica a um clique de distância no detalhe
   * editorial, então exigimos que o editor DIGITE o nome do hinário — a
   * deleção arrasta os hinos em cascade.
   *
   * O componente não navega: avisa via `ondeleted` e quem embute (o detalhe
   * editorial de 5.B) decide pra onde ir.
   */
  import { deleteHymnBook } from "$lib/graphql/operations/crud";

  export interface DeletableHymnBook {
    name: string;
    slug: string;
    hymnsTotal: number;
  }

  let {
    open = false,
    hymnbook,
    ondeleted,
    onclose,
  }: {
    open?: boolean;
    hymnbook: DeletableHymnBook;
    ondeleted?: () => void;
    onclose?: () => void;
  } = $props();

  let typedName = $state("");
  let deleting = $state(false);
  let error = $state<string | null>(null);

  const matches = $derived(typedName.trim() === hymnbook.name.trim());

  async function handleConfirm() {
    if (!matches || deleting) return;
    deleting = true;
    error = null;
    const result = await deleteHymnBook(fetch, hymnbook.slug);
    deleting = false;
    if (result.ok) {
      ondeleted?.();
      return;
    }
    error = result.message;
  }
</script>

{#if open}
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="delete-hb-title" data-testid="delete-hymnbook-modal">
    <h2 id="delete-hb-title" class="modal-title">Deletar hinário</h2>

    <p>
      Tem certeza que deseja deletar <strong>{hymnbook.name}</strong>?
    </p>
    <p class="warning">
      Esta ação é <strong>irreversível</strong>. Serão removidos também os
      {hymnbook.hymnsTotal} hino{hymnbook.hymnsTotal === 1 ? "" : "s"} deste hinário.
    </p>

    <label class="field" for="delete-hb-name">
      <span class="field-label">Digite o nome do hinário para confirmar</span>
      <input
        id="delete-hb-name"
        type="text"
        autocomplete="off"
        bind:value={typedName}
        data-testid="confirm-name-input"
      />
    </label>

    {#if error}
      <p class="modal-error" role="alert" data-testid="delete-error">{error}</p>
    {/if}

    <div class="actions">
      <button
        type="button"
        class="danger"
        disabled={!matches || deleting}
        onclick={handleConfirm}
        data-testid="confirm-delete"
      >
        {deleting ? "Deletando…" : "Sim, deletar"}
      </button>
      <button type="button" onclick={() => onclose?.()} data-testid="cancel-delete">
        Cancelar
      </button>
    </div>
  </div>
{/if}

<style>
  .modal {
    background: var(--color-surface);
    border: 1px solid var(--color-border-soft);
    border-radius: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    max-width: 32rem;
    padding: 1.25rem;
  }
  .modal-title {
    font-family: var(--font-display);
    font-size: 1.375rem;
    margin: 0;
  }
  .warning {
    border-left: 3px solid var(--color-border-soft);
    margin: 0;
    padding-left: 0.75rem;
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
  .danger {
    font-weight: 600;
  }
</style>
