<script lang="ts">
  /**
   * Marco 4.B — Ciclo 4B.8.
   *
   * Shell visual do app. Header (com currentUser) + content-area + footer +
   * slot fixed-bottom pro player global (4F). O conteúdo de cada rota
   * entra via {@render children()}.
   *
   * Slots/data-testid documentados:
   *   - content-area: wrapper das páginas (cards de listagem entram aqui).
   *   - player-slot:  bottom fixo para o player global; vazio neste marco.
   */
  import "../app.css";

  import type { Snippet } from "svelte";

  import Footer from "$lib/components/Footer.svelte";
  import Header from "$lib/components/Header.svelte";

  import type { LayoutData } from "./+layout";

  let {
    children,
    data,
  }: {
    children?: Snippet;
    data: LayoutData;
  } = $props();
</script>

<div class="app-shell">
  <Header currentUser={data.currentUser} />

  <main class="content-area" data-testid="content-area">
    {#if children}{@render children()}{/if}
  </main>

  <Footer />

  <aside class="player-slot" data-testid="player-slot" aria-label="Player de áudio"></aside>
</div>

<style>
  .app-shell {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }
  .content-area {
    flex: 1;
    margin: 0 auto;
    max-width: 72rem;
    padding: 1.5rem 1.25rem;
    width: 100%;
  }
  .player-slot {
    bottom: 0;
    left: 0;
    pointer-events: none;
    position: fixed;
    right: 0;
    z-index: 50;
  }
  .player-slot:empty {
    display: none;
  }
</style>
