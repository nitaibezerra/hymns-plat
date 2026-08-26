<script module lang="ts">
  /**
   * Rótulos PT-BR dos campos de `_EDITORIAL_FIELDS` (`apps/hymns/signals.py`).
   * O `fieldDiff` chega com os nomes em snake_case do Django; campo
   * desconhecido cai no próprio nome (o histórico nunca fica ilegível se o
   * backend passar a auditar um campo novo).
   */
  const FIELD_LABELS: Record<string, string> = {
    title: "Título",
    text: "Letra",
    repetitions: "Repetições",
    extra_instructions: "Instruções",
    style: "Estilo",
    received_at: "Recebido em",
    offered_to: "Oferecido para",
    review_status: "Status de revisão",
    number: "Número",
  };

  const STATUS_LABELS: Record<string, string> = {
    not_reviewed: "Não revisado",
    in_review: "Em revisão",
    reviewed: "Revisado",
  };

  const MAX_VALUE_CHARS = 80;

  export interface RevisionEntry {
    id: string;
    previousStatus: string;
    newStatus: string;
    changeSummary: string;
    fieldDiff: Record<string, unknown> | null;
    revisedAt: string;
    revisedBy: { id: string; username: string } | null;
  }
</script>

<script lang="ts">
  /**
   * Sub-marco 5.C — Ciclo 5C.16.
   *
   * Histórico de revisões do hino: quem mudou o quê, quando, com o diff de
   * campos que o signal de auditoria gravou. Ordenado do mais recente para o
   * mais antigo — o resolver já devolve `-revised_at`, mas reordenamos aqui
   * para a UI não depender disso.
   */
  let {
    revisions = [],
    open = $bindable(false),
  }: { revisions?: RevisionEntry[]; open?: boolean } = $props();

  interface FieldChange {
    field: string;
    label: string;
    before: string;
    after: string;
  }

  function pad(value: number): string {
    return String(value).padStart(2, "0");
  }

  function formatWhen(iso: string): string {
    const when = new Date(iso);
    if (Number.isNaN(when.getTime())) return iso;
    return (
      `${pad(when.getDate())}/${pad(when.getMonth() + 1)}/${when.getFullYear()} · ` +
      `${pad(when.getHours())}:${pad(when.getMinutes())}`
    );
  }

  function statusLabel(raw: string): string {
    if (!raw) return "—";
    return STATUS_LABELS[raw] ?? raw;
  }

  function displayValue(raw: unknown): string {
    if (raw === null || raw === undefined || raw === "") return "(vazio)";
    const text = String(raw).replace(/\s+/g, " ").trim();
    if (text === "") return "(vazio)";
    return text.length > MAX_VALUE_CHARS ? `${text.slice(0, MAX_VALUE_CHARS)}…` : text;
  }

  function changesOf(revision: RevisionEntry): FieldChange[] {
    const diff = revision.fieldDiff;
    if (!diff || typeof diff !== "object") return [];
    return Object.entries(diff).map(([field, value]) => {
      const pair = (value ?? {}) as { old?: unknown; new?: unknown };
      return {
        field,
        label: FIELD_LABELS[field] ?? field,
        before: displayValue(pair.old),
        after: displayValue(pair.new),
      };
    });
  }

  let ordered = $derived(
    [...revisions].sort((a, b) => Date.parse(b.revisedAt) - Date.parse(a.revisedAt)),
  );

  function close() {
    open = false;
  }
</script>

{#if open}
  <section class="history" data-testid="revision-history-drawer">
    <header class="history-header">
      <p class="eyebrow">Histórico de revisões</p>
      <button class="close-btn" type="button" aria-label="Fechar histórico" onclick={close}>
        ✕
      </button>
    </header>

    {#if ordered.length === 0}
      <p class="history-empty" data-testid="revision-history-empty">Sem revisões registradas.</p>
    {:else}
      <ol class="history-list">
        {#each ordered as revision (revision.id)}
          <li class="history-item" data-testid="revision-item" data-revision-id={revision.id}>
            <div class="item-head">
              <span class="who">{revision.revisedBy?.username ?? "sistema"}</span>
              <span class="when">{formatWhen(revision.revisedAt)}</span>
            </div>
            <p class="status-line" data-testid="revision-status">
              {statusLabel(revision.previousStatus)} → {statusLabel(revision.newStatus)}
            </p>
            {#if revision.changeSummary}
              <p class="summary" data-testid="revision-summary">{revision.changeSummary}</p>
            {/if}
            {#each changesOf(revision) as change (change.field)}
              <p class="field-row" data-testid="revision-field" data-field={change.field}>
                <span class="field-label">{change.label}</span>
                <del>{change.before}</del>
                <span aria-hidden="true">→</span>
                <ins>{change.after}</ins>
              </p>
            {/each}
          </li>
        {/each}
      </ol>
    {/if}
  </section>
{/if}

<style>
  .history {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.25rem;
  }

  .history-header {
    align-items: baseline;
    display: flex;
    justify-content: space-between;
  }

  .eyebrow {
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.625rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .close-btn {
    background: transparent;
    border: 0;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 0.875rem;
  }

  .history-empty {
    color: var(--color-text-muted);
    font-family: var(--font-serif);
    font-size: 0.8125rem;
    font-style: italic;
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    list-style: none;
  }

  .history-item {
    border-left: 2px solid var(--color-border);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding-left: 0.75rem;
  }

  .item-head {
    display: flex;
    gap: 0.5rem;
    justify-content: space-between;
  }

  .who {
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    font-weight: 500;
  }

  .when,
  .status-line,
  .field-row {
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.6875rem;
  }

  .summary {
    font-family: var(--font-serif);
    font-size: 0.8125rem;
  }

  .field-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .field-label {
    color: var(--color-text-soft);
    text-transform: uppercase;
  }

  del {
    color: var(--color-status-not);
    text-decoration: line-through;
  }

  ins {
    color: var(--color-status-ok);
    text-decoration: none;
  }
</style>
