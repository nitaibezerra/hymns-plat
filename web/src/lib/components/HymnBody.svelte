<script lang="ts">
  /**
   * Marco 4.D — Ciclo 4D.3.
   *
   * Renderiza a letra de um hino linha por linha. Wrapper recebe a classe
   * global `hymn-body-centered` que aplica `width: max-content` + `margin-
   * inline: auto` (look "página-de-cantador" — bloco horizontal centralizado
   * com versos alinhados à esquerda).
   *
   * Compartilhado por `HymnCorrido`, `HymnCarousel` e (em 4.E) o detalhe
   * individual do hino.
   */

  let { body }: { body: string | null | undefined } = $props();

  // `split("\n")` preserva linhas em branco (estrofes). Quando body é
  // null/undefined/"", renderiza sem itens.
  let lines = $derived.by(() => {
    if (!body) return [] as string[];
    return body.split("\n");
  });
</script>

<div data-testid="hymn-body" class="hymn-body hymn-body-centered">
  {#each lines as line, i (i)}
    <p data-testid="hymn-line" class="hymn-line">{line}</p>
  {/each}
</div>

<style>
  /* `width: max-content` + centralização ficam aqui (espelhando o monolito
     `static/css/components.css` `.hymn-body-centered`). Versos left-aligned. */
  .hymn-body {
    text-align: center;
  }
  .hymn-body :global(.hymn-line),
  .hymn-line {
    display: block;
    margin: 0;
    text-align: left;
  }
  :global(.hymn-body-centered) {
    text-align: center;
  }
  :global(.hymn-body-centered) > .hymn-line,
  :global(.hymn-body-centered) :global(.hymn-line) {
    display: block;
    margin: 0;
    text-align: left;
  }
  /* O bloco em si fica com largura do maior verso. */
  .hymn-body {
    display: block;
    margin-inline: auto;
    max-width: 100%;
    width: max-content;
  }
</style>
