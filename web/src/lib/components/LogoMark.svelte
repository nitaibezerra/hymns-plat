<script lang="ts">
  /**
   * Marca gráfica do Hinaria — timão circular de 8 raios, em ouro.
   *
   * Porte verbatim de `templates/_partials/_logo_mark.html` do monolito
   * (Fase 2 da paridade visual). Geometrias idênticas de propósito: qualquer
   * ajuste aqui tem que sair no mesmo commit do de lá enquanto os dois
   * frontends coexistirem.
   */
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 32 32"
  width="28"
  height="28"
  aria-hidden="true"
  class="text-gold"
  data-testid="logo-mark"
>
  <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
    <circle cx="16" cy="16" r="6.5" />
    <circle cx="16" cy="16" r="2.2" fill="currentColor" stroke="none" />
    <!-- 8 raios externos saindo do anel para a borda -->
    <line x1="16" y1="2.5" x2="16" y2="9" />
    <line x1="16" y1="23" x2="16" y2="29.5" />
    <line x1="2.5" y1="16" x2="9" y2="16" />
    <line x1="23" y1="16" x2="29.5" y2="16" />
    <line x1="6.2" y1="6.2" x2="11" y2="11" />
    <line x1="21" y1="21" x2="25.8" y2="25.8" />
    <line x1="25.8" y1="6.2" x2="21" y2="11" />
    <line x1="11" y1="21" x2="6.2" y2="25.8" />
  </g>
</svg>
