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
   *
   * Fase 2 da paridade visual (2026-08-31): os ícones passaram de emoji
   * (`☾`/`☀`) para os SVGs de `static/js/dark-mode.js`, e o botão ganhou a
   * forma do monolito (círculo de 36px, hover em `bg-ink/5`). O emoji não era
   * só divergência de estilo — o próprio monolito já o abandonou, e o
   * comentário lá diz por quê: "usar emojis (☾ / ☀) renderizava em amarelo no
   * macOS". A SPA tinha herdado o problema que o Django já tinha consertado.
   *
   * Lua no tema claro, sol no escuro — o ícone mostra o DESTINO do clique, não
   * o estado atual. Mesma convenção do monolito.
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
  class="w-9 h-9 rounded-full hover:bg-ink/5 dark:hover:bg-white/10 inline-flex items-center justify-center text-ink dark:text-cream"
  onclick={handleClick}
>
  <svg
    data-theme-icon
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    {#if current === "dark"}
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    {:else}
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    {/if}
  </svg>
</button>
