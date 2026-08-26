<script lang="ts">
  /**
   * Sub-marco 5.D — Ciclo 5D.11.
   *
   * Confirmação da deleção de um hino. Diferente do hinário (5D.5), aqui não
   * exigimos digitar o título: o estrago é de um registro só e o editor
   * precisa de agilidade — mas o passo de confirmação continua explícito,
   * com número e título à vista.
   *
   * Não navega: avisa via `ondeleted` e quem embute decide pra onde ir.
   */
  import { deleteHymn } from "$lib/graphql/operations/crud";

  export interface DeletableHymn {
    id: string;
    number: number;
    title: string;
  }

  let {
    open = false,
    hymn,
    ondeleted,
    onclose,
  }: {
    open?: boolean;
    hymn: DeletableHymn;
    ondeleted?: () => void;
    onclose?: () => void;
  } = $props();

  let deleting = $state(false);
  let error = $state<string | null>(null);

  async function handleConfirm() {
    // Guarda contra duplo clique: a deleção não é idempotente do ponto de
    // vista da UI (o segundo request voltaria NotFound e piscaria um erro).
    if (deleting) return;
    deleting = true;
    error = null;
    const result = await deleteHymn(fetch, hymn.id);
    deleting = false;
    if (result.ok) {
      ondeleted?.();
      return;
    }
    error = result.message;
  }
</script>

{#if open}
  <div
    class="modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="delete-hymn-title"
    data-testid="delete-hymn-modal"
  >
    <h2 id="delete-hymn-title" class="modal-title">Deletar hino</h2>

    <p>
      Tem certeza que deseja deletar o hino
      <strong>#{hymn.number} — {hymn.title}</strong>?
    </p>
    <p class="warning">Esta ação é <strong>irreversível</strong>.</p>

    {#if error}
      <p class="modal-error" role="alert" data-testid="delete-hymn-error">{error}</p>
    {/if}

    <div class="actions">
      <button
        type="button"
        class="danger"
        disabled={deleting}
        onclick={handleConfirm}
        data-testid="confirm-delete-hymn"
      >
        {deleting ? "Deletando…" : "Sim, deletar"}
      </button>
      <button type="button" onclick={() => onclose?.()} data-testid="cancel-delete-hymn">
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
  .actions {
    display: flex;
    gap: 0.75rem;
  }
  .danger {
    font-weight: 600;
  }
</style>
