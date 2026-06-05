<script lang="ts">
  /**
   * Marco 4.B — placeholder do ciclo 4B.4 (Header).
   * O ciclo 4B.5 acrescenta a lógica de toggle de tema + persistência.
   */
</script>

<button
  type="button"
  data-testid="theme-toggle"
  aria-label="Alternar tema"
  class="theme-toggle"
>
  Tema
</button>

<style>
  .theme-toggle {
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text);
    cursor: pointer;
    font-family: var(--font-sans);
    font-size: 0.875rem;
    padding: 0.375rem 0.75rem;
  }
  .theme-toggle:hover {
    border-color: var(--color-accent);
  }
</style>
