<script lang="ts">
  /**
   * Marco 4.B — Ciclo 4B.5.
   *
   * Botão que alterna entre tema claro e escuro. Lê preferência salva no
   * mount (`$effect`), aplica o atributo `data-theme` ao `<html>` e
   * persiste em `localStorage` na chave `hinaria-theme`.
   *
   * Helpers puros vivem em `$lib/stores/theme.ts` para facilitar testes
   * unitários e SSR safety.
   */
  import {
    applyTheme,
    initialTheme,
    toggleTheme,
    type Theme,
  } from "$lib/stores/theme";

  let current = $state<Theme>("light");

  $effect(() => {
    current = initialTheme();
    applyTheme(current);
  });

  function handleClick() {
    current = toggleTheme(current);
    applyTheme(current);
  }

  let label = $derived(current === "dark" ? "Tema claro" : "Tema escuro");
</script>

<button
  type="button"
  data-testid="theme-toggle"
  aria-label={label}
  class="theme-toggle"
  onclick={handleClick}
>
  {current === "dark" ? "☀" : "☾"}
</button>

<style>
  .theme-toggle {
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text);
    cursor: pointer;
    font-family: var(--font-sans);
    font-size: 1rem;
    line-height: 1;
    padding: 0.375rem 0.625rem;
  }
  .theme-toggle:hover {
    border-color: var(--color-accent);
  }
</style>
