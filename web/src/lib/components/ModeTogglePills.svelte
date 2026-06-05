<script lang="ts">
  /**
   * Marco 4.D — Ciclo 4D.10.
   *
   * Pills de alternância entre modos (índice/corrido/carrossel). Decisão
   * herdada do monolito: pills são âncoras `<a href="?mode=...">` (NÃO
   * botões), preservando o comportamento URL-driven, back/forward navegável
   * e deep-linkable. Modo ativo recebe `aria-current="page"`.
   */

  type Mode = "indice" | "corrido" | "carrossel";

  let { mode }: { mode: Mode } = $props();

  const PILLS: ReadonlyArray<{ value: Mode; label: string }> = [
    { value: "indice", label: "Índice" },
    { value: "corrido", label: "Corrido" },
    { value: "carrossel", label: "Carrossel" },
  ];
</script>

<nav class="mode-toggle-pills" aria-label="Modo de leitura" data-testid="mode-toggle-pills">
  {#each PILLS as p (p.value)}
    <a
      href={`?mode=${p.value}`}
      class="mode-toggle-pill"
      class:is-active={mode === p.value}
      aria-current={mode === p.value ? "page" : undefined}
    >
      {p.label}
    </a>
  {/each}
</nav>

<style>
  .mode-toggle-pills {
    align-items: center;
    display: flex;
    gap: 0.25rem;
    padding: 0.25rem;
  }
  .mode-toggle-pill {
    border-radius: 999px;
    color: var(--color-text);
    font-family: var(--font-sans, system-ui, sans-serif);
    font-size: 0.875rem;
    padding: 0.375rem 0.875rem;
    text-decoration: none;
    transition: background 160ms, color 160ms;
  }
  .mode-toggle-pill:hover {
    background: var(--color-border, rgba(0, 0, 0, 0.06));
  }
  .mode-toggle-pill.is-active {
    background: var(--color-accent, #b08c4a);
    color: var(--color-on-accent, #fff);
  }
</style>
