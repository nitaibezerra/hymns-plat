<script module lang="ts">
  /**
   * Padrões canônicos de repetição — espelho de `Hymn.CANONICAL_REPETITIONS`
   * (`apps/hymns/models.py`). Duplicado aqui porque o schema GraphQL não
   * expõe a tupla; `RepetitionPills.test.ts` pina os valores.
   */
  export const CANONICAL_REPETITIONS = [
    "1-2,3-4",
    "1-2,3-4,1-4",
    "1-4",
    "3-4,1-4",
    "1-2,1-4",
  ] as const;
</script>

<script lang="ts">
  /**
   * Sub-marco 5.C — Ciclo 5C.7.
   *
   * Igual às pílulas de estilo, mas em mono: o padrão de repetição é
   * notação ("1-2,3-4"), não prosa. `suggestions` recebe
   * `HymnType.commonRepetitions` (top-N do hinário).
   */
  let {
    value = $bindable(""),
    suggestions = [],
  }: { value?: string; suggestions?: string[] } = $props();

  let extras = $derived(
    Array.from(
      new Set(suggestions.filter((item) => item && !CANONICAL_REPETITIONS.includes(item as never))),
    ),
  );

  function pick(candidate: string) {
    value = value === candidate ? "" : candidate;
  }
</script>

<div class="pill-row" data-testid="repetition-pills">
  {#each CANONICAL_REPETITIONS as pattern (pattern)}
    <button
      class="pill"
      type="button"
      data-testid="repetition-pill"
      data-active={value === pattern ? "true" : "false"}
      aria-pressed={value === pattern}
      onclick={() => pick(pattern)}
    >
      {pattern}
    </button>
  {/each}
</div>

{#if extras.length > 0}
  <div class="pill-row">
    <span class="pill-row-label">Neste hinário</span>
    {#each extras as pattern (pattern)}
      <button
        class="pill is-suggestion"
        type="button"
        data-testid="repetition-suggestion"
        data-active={value === pattern ? "true" : "false"}
        aria-pressed={value === pattern}
        onclick={() => pick(pattern)}
      >
        {pattern}
      </button>
    {/each}
  </div>
{/if}

<style>
  .pill-row {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-top: 0.375rem;
  }

  .pill-row-label {
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.5625rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .pill {
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-pill);
    color: var(--color-text-soft);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    padding: 3px 10px;
    transition:
      background 120ms,
      color 120ms;
  }

  .pill:hover {
    border-color: var(--color-gold);
  }

  .pill[data-active="true"] {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: var(--color-bg);
  }

  .pill.is-suggestion {
    border-style: dashed;
  }
</style>
