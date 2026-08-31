<script lang="ts">
  /**
   * Marco 4.B — Ciclo 4B.8.
   * Marco 4.F — player-slot agora hospeda o `<AudioPlayer />` singleton.
   *
   * Shell visual do app. Header (com currentUser) + content-area + footer +
   * slot fixed-bottom com o player global persistente (4F).
   *
   * O `<AudioPlayer />` vive aqui porque o `+layout.svelte` é montado uma
   * única vez na navegação client-side do SvelteKit — então o `<audio>` HTML
   * element dentro do componente sobrevive a transições entre rotas. Esse
   * é o ganho central do refactor headless: o áudio não pausa quando o
   * usuário sai de `/hinos/X/` pra `/hinarios/`.
   *
   * Slots/data-testid documentados:
   *   - content-area: wrapper das páginas (cards de listagem entram aqui).
   *   - player-slot:  bottom fixo; o AudioPlayer se renderiza só quando há
   *     currentTrack e !isDismissed, então fica invisível até alguém tocar.
   */
  import "../app.css";

  import type { Snippet } from "svelte";

  import { page } from "$app/state";

  import AudioPlayer from "$lib/components/AudioPlayer.svelte";
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
  <Header
    currentUser={data.currentUser}
    pathname={page.url.pathname}
    editorPendingCount={data.editorPendingCount}
    isEditor={data.currentUser?.isEditor ?? false}
  />

  <!--
    `id="main"` é o destino do link "Pular para conteúdo" do header, e
    `min-h-[calc(100vh-12rem)]` é o do monolito (`templates/base.html`) — sem
    ele páginas curtas deixam o rodapé subir e a comparação de pixel pega a
    diferença de altura como se fosse divergência de conteúdo.
  -->
  <main
    id="main"
    class="content-area min-h-[calc(100vh-12rem)]"
    data-testid="content-area"
  >
    {#if children}{@render children()}{/if}
  </main>

  <Footer />

  <aside class="player-slot" data-testid="player-slot" aria-label="Player de áudio">
    <AudioPlayer />
  </aside>
</div>

<style>
  .app-shell {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }
  /*
   * Container das páginas. A largura já batia com o monolito por coincidência
   * (72rem == `max-w-6xl`, que é o que `home.html`, `hymnbook_list.html`,
   * `profile.html` e `hymn_detail.html` usam); o padding é que divergia. Agora
   * é `px-6 py-10`, o valor da maioria das páginas de lá.
   *
   * DÍVIDA PARA A FASE 4: no monolito o `<main>` não tem container nenhum —
   * cada página traz o seu, o que permite faixa de cor full-bleed (o hero da
   * home é `bg-cream-deep` de borda a borda, com o container POR DENTRO). Aqui
   * o container está no `<main>`, então nenhuma rota consegue sangrar. Enquanto
   * a home não for portada isso não custa nada; ao portá-la, o container sobe
   * pra dentro de cada rota.
   */
  .content-area {
    flex: 1;
    margin: 0 auto;
    max-width: 72rem;
    padding: 2.5rem 1.5rem;
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
  /*
   * O <AudioPlayer> só renderiza a barra quando há currentTrack, então
   * `:empty` virou `:not(:has(*))` — vazio quando o player não tem nada
   * pra mostrar. Mantém o slot sem ocupar espaço enquanto idle.
   */
  .player-slot:not(:has(*)) {
    display: none;
  }
  .player-slot :global(.audio-player-bar) {
    pointer-events: auto;
  }
</style>
