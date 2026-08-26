<script module lang="ts">
  /**
   * Valores canônicos de estilo — espelho de `Hymn.CANONICAL_STYLES`
   * (`apps/hymns/models.py`). Nenhum campo do schema GraphQL expõe a tupla,
   * então ela é duplicada aqui e pinada por `StylePills.test.ts`.
   */
  export const CANONICAL_STYLES = ["Marcha", "Valsa", "Mazurca"] as const;
</script>

<script lang="ts">
  /**
   * Sub-marco 5.C — Ciclo 5C.6.
   *
   * Pílulas de estilo musical. O campo continua livre (`Hymn.style` é
   * `CharField` sem choices): as pílulas só preenchem, nunca restringem — e
   * clicar na pílula ativa limpa o campo, que é como o editor desmarca.
   *
   * `suggestions` recebe `HymnType.commonStyles` (top-N usados no hinário) e
   * entra como segunda fileira, sem repetir o que já é canônico.
   */
  let {
    value = $bindable(""),
    suggestions = [],
  }: { value?: string; suggestions?: string[] } = $props();

  let extras = $derived(
    Array.from(new Set(suggestions.filter((item) => item && !CANONICAL_STYLES.includes(item as never)))),
  );

  function pick(candidate: string) {
    value = value === candidate ? "" : candidate;
  }
</script>

<div class="pill-row" data-testid="style-pills">
  {#each CANONICAL_STYLES as style (style)}
    <button
      class="pill"
      type="button"
      data-testid="style-pill"
      data-active={value === style ? "true" : "false"}
      aria-pressed={value === style}
      onclick={() => pick(style)}
    >
      {style}
    </button>
  {/each}
</div>

{#if extras.length > 0}
  <div class="pill-row">
    <span class="pill-row-label">Neste hinário</span>
    {#each extras as style (style)}
      <button
        class="pill is-suggestion"
        type="button"
        data-testid="style-suggestion"
        data-active={value === style ? "true" : "false"}
        aria-pressed={value === style}
        onclick={() => pick(style)}
      >
        {style}
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
    font-family: var(--font-sans);
    font-size: 0.75rem;
    padding: 3px 11px;
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
