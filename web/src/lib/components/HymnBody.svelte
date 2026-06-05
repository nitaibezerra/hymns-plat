<script lang="ts">
  /**
   * Marco 4.E — stub mínimo de `HymnBody`.
   *
   * Renderiza a letra do hino preservando quebras de linha (whitespace pre-wrap)
   * pra cobrir o caso do detalhe de hino enquanto o sub-marco 4.D (carrossel/
   * reading modes) ainda não foi mergeado.
   *
   * O 4.D vai sobrescrever este componente com a versão completa
   * (centragem `width: max-content`, headings de verso, tags HTML sanitizadas
   * etc.). Pra evitar conflito de merge, mantemos a interface enxuta:
   *   - `body: string`     — texto bruto do hino (pode vir vazio enquanto o
   *                          schema GraphQL não expõe `body`/`text`).
   *   - `class`/`testid`   — passthrough opcional, sem comportamento extra.
   */
  let {
    body = "",
    class: className = "",
  }: { body?: string; class?: string } = $props();
</script>

<div class="hymn-body {className}" data-testid="hymn-body">{body}</div>

<style>
  .hymn-body {
    font-family: var(--font-serif);
    font-size: 1.125rem;
    line-height: 1.6;
    white-space: pre-wrap;
    text-align: left;
    width: max-content;
    max-width: 100%;
    margin-left: auto;
    margin-right: auto;
  }
</style>
