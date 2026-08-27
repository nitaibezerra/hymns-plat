<script lang="ts">
  /**
   * Marco 5.B — Ciclo 5B.1.
   *
   * Shell do workspace editorial: uma faixa de identificação ("Workspace
   * editorial · @usuário") acima do conteúdo de cada rota `/editor/*`.
   *
   * Fica deliberadamente magro — o guard de verdade é o `+layout.ts`. Aqui
   * só marcamos visualmente que o usuário saiu do site público e entrou na
   * área de trabalho, com o mesmo `label-mono` (mono maiúsculo espaçado) que
   * o template Django usa como eyebrow.
   */
  import type { Snippet } from "svelte";

  import type { EditorLayoutData } from "./+layout";

  let {
    children,
    data,
  }: {
    children?: Snippet;
    data: EditorLayoutData;
  } = $props();
</script>

<div class="editor-shell" data-testid="editor-shell">
  <div class="editor-bar">
    <a class="editor-bar-home" href="/editor/">Workspace editorial</a>
    {#if data.editor}
      <span class="editor-bar-user" data-testid="editor-identity">@{data.editor.username}</span>
    {/if}
  </div>

  {#if children}{@render children()}{/if}
</div>

<style>
  .editor-shell {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .editor-bar {
    align-items: baseline;
    border-bottom: 1px solid var(--color-border-soft);
    display: flex;
    gap: 0.75rem;
    justify-content: space-between;
    padding-bottom: 0.625rem;
  }
  .editor-bar-home,
  .editor-bar-user {
    color: var(--color-text-muted);
    font-family: var(--font-mono, var(--font-sans));
    font-size: 0.6875rem;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .editor-bar-home {
    text-decoration: none;
  }
  .editor-bar-home:hover,
  .editor-bar-home:focus-visible {
    color: var(--color-gold);
  }
</style>
