<script lang="ts">
  /**
   * Sub-marco 5.F — Ciclo 5F.6.
   *
   * Porta de `templates/_partials/_upload_stepper.html`: os 4 passos do
   * wizard de contribuição (UPLOAD · PROCESSANDO · CONFERIR · CONFIRMAR),
   * com o atual destacado e os anteriores marcados com ✓.
   *
   * Componente "burro": recebe só o número do passo (1..4). Quem decide o
   * passo é cada rota do wizard.
   */
  const STEP_LABELS = ["UPLOAD", "PROCESSANDO", "CONFERIR", "CONFIRMAR"];

  let { step }: { step: number } = $props();

  type StepState = "done" | "current" | "todo";

  function stateFor(index: number): StepState {
    const position = index + 1;
    if (position < step) return "done";
    if (position === step) return "current";
    return "todo";
  }
</script>

<ol data-testid="upload-stepper" aria-label="Progresso do envio">
  {#each STEP_LABELS as label, i (label)}
    {@const state = stateFor(i)}
    <li
      data-testid="upload-step"
      data-label={label}
      data-state={state}
      aria-current={state === "current" ? "step" : undefined}
    >
      <span class="marker" data-testid="upload-step-marker">
        {state === "done" ? "✓" : String(i + 1)}
      </span>
      <span class="label">{label}</span>
    </li>
  {/each}
</ol>

<style>
  ol {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(4, 1fr);
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    text-align: center;
  }
  .marker {
    align-items: center;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-pill);
    display: inline-flex;
    font-family: var(--font-mono);
    font-size: 0.875rem;
    height: 2.5rem;
    justify-content: center;
    width: 2.5rem;
  }
  li[data-state="done"] .marker {
    background: var(--color-accent-2);
    border-color: transparent;
    color: var(--color-bg);
  }
  li[data-state="current"] .marker {
    background: var(--color-gold);
    border-color: transparent;
    color: var(--color-bg-deep);
  }
  li[data-state="todo"] .marker {
    color: var(--color-text-muted);
  }
  .label {
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.625rem;
    letter-spacing: 0.12em;
  }
  li[data-state="current"] .label {
    color: var(--color-text);
  }
</style>
