<script lang="ts">
  /**
   * Sub-marco 5.E — Ciclo 5E.2.
   *
   * Pílulas da revisão ágil: 3 estilos (M/V/Z) + 4 presets de repetição
   * (1/2/3/4), com atalho de teclado em cada uma.
   *
   * Diferenças deliberadas em relação a `StylePills`/`RepetitionPills` do 5.C,
   * que são as pílulas da revisão COMPLETA:
   *   - a lista de repetições é o subconjunto de 4 na ordem dos atalhos
   *     (`quick_repetitions` de `editor_quick_review`), não a tupla canônica
   *     de 5 — a view do Django comenta exatamente esse motivo;
   *   - existe atalho de teclado, que é o ponto da tela;
   *   - os dois campos mudam juntos e o pai precisa dos dois numa tacada
   *     (`onchange`), porque o submit manda `style` e `repetitions` na mesma
   *     mutation.
   *
   * Os valores de estilo vêm de `CANONICAL_STYLES`, reexportado por
   * `StylePills.svelte` — espelho de `Hymn.CANONICAL_STYLES`. Não duplicamos
   * a lista aqui.
   *
   * Atalhos pausam quando o foco está num campo editável: sem isso, digitar
   * "Mazurca" no campo livre de estilo dispararia os presets a cada letra.
   */
  import { QUICK_REPETITIONS, STYLE_SHORTCUTS } from "$lib/graphql/operations/quick-review";

  import { CANONICAL_STYLES } from "./StylePills.svelte";

  export interface QuickReviewValues {
    style: string;
    repetitions: string;
  }

  let {
    style = "",
    repetitions = "",
    shortcutsEnabled = true,
    onchange,
  }: {
    style?: string;
    repetitions?: string;
    /** Desligado enquanto o submit está em voo, ou quando um modal abre. */
    shortcutsEnabled?: boolean;
    onchange?: (values: QuickReviewValues) => void;
  } = $props();

  /** Mapa tecla→ação, montado uma vez. Chaves em minúsculo. */
  const SHORTCUTS = new Map<string, { field: "style" | "repetitions"; value: string }>([
    ...CANONICAL_STYLES.map(
      (name) =>
        [STYLE_SHORTCUTS[name].toLowerCase(), { field: "style" as const, value: name }] as const,
    ),
    ...QUICK_REPETITIONS.map(
      (pattern, index) =>
        [String(index + 1), { field: "repetitions" as const, value: pattern }] as const,
    ),
  ]);

  function emit(next: QuickReviewValues) {
    onchange?.(next);
  }

  /** Clicar/atalhar a pílula ativa limpa o campo — é como o editor desmarca. */
  function pick(field: "style" | "repetitions", candidate: string) {
    const current = field === "style" ? style : repetitions;
    const value = current === candidate ? "" : candidate;
    emit(field === "style" ? { style: value, repetitions } : { style, repetitions: value });
  }

  /**
   * Um `<input>`, `<textarea>`, `<select>` ou qualquer nó `contenteditable`
   * com foco significa "o usuário está digitando" — atalhos calados.
   */
  function isTyping(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!shortcutsEnabled) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTyping(event.target)) return;

    const action = SHORTCUTS.get(event.key.toLowerCase());
    if (!action) return;
    event.preventDefault();
    pick(action.field, action.value);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="quick-fields" data-testid="quick-review-pills">
  <fieldset class="field-group">
    <legend class="eyebrow">Estilo</legend>
    <div class="tiles tiles-3">
      {#each CANONICAL_STYLES as name (name)}
        <button
          type="button"
          class="tile"
          data-testid="quick-style-tile"
          data-value={name}
          data-shortcut={STYLE_SHORTCUTS[name]}
          data-active={style === name ? "true" : "false"}
          aria-pressed={style === name}
          onclick={() => pick("style", name)}
        >
          <span class="tile-label">{name}</span>
          <span class="kbd" aria-hidden="true">{STYLE_SHORTCUTS[name]}</span>
        </button>
      {/each}
    </div>
    <label class="free-field">
      <span class="visually-hidden">Estilo (texto livre)</span>
      <input
        type="text"
        value={style}
        data-testid="quick-style-input"
        placeholder="Ou digite um estilo (ex.: Hino, Mestre)"
        oninput={(event) =>
          emit({ style: (event.currentTarget as HTMLInputElement).value, repetitions })}
      />
    </label>
  </fieldset>

  <fieldset class="field-group">
    <legend class="eyebrow">Repetições</legend>
    <div class="tiles tiles-2">
      {#each QUICK_REPETITIONS as pattern, index (pattern)}
        <button
          type="button"
          class="tile tile-mono"
          data-testid="quick-repetition-tile"
          data-value={pattern}
          data-shortcut={String(index + 1)}
          data-active={repetitions === pattern ? "true" : "false"}
          aria-pressed={repetitions === pattern}
          onclick={() => pick("repetitions", pattern)}
        >
          <span class="tile-label">{pattern}</span>
          <span class="kbd" aria-hidden="true">{index + 1}</span>
        </button>
      {/each}
    </div>
    <label class="free-field">
      <span class="visually-hidden">Repetições (texto livre)</span>
      <input
        type="text"
        class="mono"
        value={repetitions}
        data-testid="quick-repetitions-input"
        placeholder="Ou digite manualmente"
        oninput={(event) =>
          emit({ style, repetitions: (event.currentTarget as HTMLInputElement).value })}
      />
    </label>
  </fieldset>
</div>

<style>
  .quick-fields {
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
  }
  .field-group {
    border: 0;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    margin: 0;
    padding: 0;
  }
  .eyebrow {
    color: var(--color-text-soft);
    font-family: var(--font-mono, monospace);
    font-size: 0.6875rem;
    letter-spacing: 0.12em;
    padding: 0;
    text-transform: uppercase;
  }
  .tiles {
    display: grid;
    gap: 0.5rem;
  }
  .tiles-3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .tiles-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .tile {
    align-items: center;
    background: transparent;
    border: 1px solid var(--color-border-soft);
    border-radius: 0.5rem;
    color: var(--color-text-soft);
    cursor: pointer;
    display: flex;
    font-family: var(--font-sans, sans-serif);
    font-size: 0.875rem;
    gap: 0.5rem;
    justify-content: space-between;
    padding: 0.625rem 0.75rem;
    /* `prefers-reduced-motion` desliga a transição no bloco abaixo. */
    transition:
      background 120ms ease,
      border-color 120ms ease,
      color 120ms ease;
  }
  .tile-mono .tile-label {
    font-family: var(--font-mono, monospace);
    font-size: 0.8125rem;
  }
  .tile:hover {
    border-color: var(--color-accent);
  }
  .tile[data-active="true"] {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: var(--color-bg);
  }
  .kbd {
    border: 1px solid currentcolor;
    border-radius: 0.25rem;
    font-family: var(--font-mono, monospace);
    font-size: 0.625rem;
    line-height: 1;
    opacity: 0.7;
    padding: 0.1875rem 0.3125rem;
  }
  .free-field input {
    background: var(--color-surface);
    border: 1px solid var(--color-border-soft);
    border-radius: 0.5rem;
    font: inherit;
    padding: 0.5rem 0.75rem;
    width: 100%;
  }
  .free-field input.mono {
    font-family: var(--font-mono, monospace);
  }
  .visually-hidden {
    clip-path: inset(50%);
    height: 1px;
    overflow: hidden;
    position: absolute;
    white-space: nowrap;
    width: 1px;
  }
  @media (prefers-reduced-motion: reduce) {
    .tile {
      transition: none;
    }
  }
</style>
