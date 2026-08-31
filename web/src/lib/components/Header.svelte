<script lang="ts">
  /**
   * Marco 4.B — Ciclo 4B.4.
   * Fase 2 da paridade visual (2026-08-31) — porte de
   * `templates/_partials/_header.html` do monolito. Ver
   * `_plan/plano-paridade-visual-spa.md`.
   *
   * Header global do shell. É a peça de MAIOR alavancagem do plano: aparece
   * nas 11 rotas medidas, então um conserto aqui move 11 números de uma vez.
   * Medido antes deste porte: a região `header` divergia ~3,4% em quase toda
   * rota.
   *
   * O que mudou em relação à versão anterior, e por quê (tudo vindo do
   * monolito, não inventado aqui):
   *
   *   - marca "Hinaria" em `font-display` com o timão em ouro, no lugar de
   *     "hinária" em minúsculas sem símbolo;
   *   - link "Início", que faltava;
   *   - item ativo sublinhado em ouro com texto em firmamento;
   *   - busca embutida com o atalho `⌘K` — e o atalho FUNCIONA, porque dica de
   *     atalho que não faz nada é pior que dica nenhuma;
   *   - CTA "Fila de revisão" com contagem, para quem tem acesso editorial;
   *   - sino de notificações e avatar circular em musgo com DUAS iniciais
   *     (o monolito usa `username|slice:":2"|upper`);
   *   - "Entrar" como pílula preenchida em firmamento, não link de texto;
   *   - menu mobile com gaveta off-canvas, que não existia;
   *   - sticky com `backdrop-blur`.
   *
   * Este arquivo usa utilities do Tailwind em vez de CSS escopado, ao
   * contrário do resto do shell. É deliberado: as classes são as MESMAS do
   * template Django, então divergência fica visível na leitura lado a lado em
   * vez de escondida numa tradução para CSS escopado. Isso só passou a ser
   * possível na Fase 1 — antes dela a paleta do Tailwind não existia no bundle
   * e classes como `bg-cream` não geravam nada.
   */
  import LogoMark from "./LogoMark.svelte";
  import ThemeToggle from "./ThemeToggle.svelte";

  export interface HeaderUser {
    id: string;
    username: string;
    email: string | null;
  }

  let {
    currentUser = null,
    pathname = "/",
    editorPendingCount = 0,
    isEditor = false,
  }: {
    currentUser?: HeaderUser | null;
    /** Rota atual, para marcar o item ativo. Vem do `+layout.svelte`. */
    pathname?: string;
    /** Badge da CTA editorial (`Query.editorPendingBookCount`). */
    editorPendingCount?: number;
    isEditor?: boolean;
  } = $props();

  /**
   * Item ativo, com as mesmas regras do template Django: `Início` casa exato,
   * os outros casam por prefixo (`{% if books_url in request.path %}`), pra que
   * `/hinarios/lua-branca` também acenda "Hinários".
   */
  const ativo = $derived({
    inicio: pathname === "/",
    hinarios: pathname.startsWith("/hinarios"),
    busca: pathname.startsWith("/busca"),
    editor: pathname.startsWith("/editor"),
  });

  const CLASSE_ATIVO = "text-firmament dark:text-firmament border-b border-gold pb-1";

  let menuAberto = $state(false);
  let campoDeBusca = $state<HTMLInputElement | null>(null);

  /**
   * `⌘K` (ou `Ctrl+K`) foca a busca — paridade de comportamento com
   * `static/js/keyboard-shortcuts.js`. Só o atalho da busca vive aqui; `j`/`k`
   * e `⌘S` pertencem às telas que os usam.
   */
  function atalhoDeTeclado(evento: KeyboardEvent) {
    if (!(evento.metaKey || evento.ctrlKey)) return;
    if (evento.key !== "k" && evento.key !== "K") return;
    if (!campoDeBusca) return;
    evento.preventDefault();
    campoDeBusca.focus();
    campoDeBusca.select();
  }
</script>

<svelte:window onkeydown={atalhoDeTeclado} />

<a
  href="#main"
  class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 bg-ink text-cream px-3 py-2 rounded"
>
  Pular para conteúdo
</a>

<header
  class="border-b border-ink/10 dark:border-cream/10 sticky top-0 z-30 bg-cream/90 dark:bg-night/90 backdrop-blur"
  data-no-print
  data-testid="site-header"
>
  <div class="max-w-7xl mx-auto px-6 h-16 flex items-center gap-6">
    <a href="/" class="flex items-center gap-2.5 group" aria-label="Hinaria" data-testid="brand">
      <LogoMark />
      <span class="font-display text-2xl tracking-tight">Hinaria</span>
    </a>

    <nav class="hidden md:flex items-center gap-5 text-sm" aria-label="Principal">
      <a
        href="/"
        class="hover:text-ink dark:hover:text-cream {ativo.inicio ? CLASSE_ATIVO : ''}"
        aria-current={ativo.inicio ? "page" : undefined}
      >
        Início
      </a>
      <a
        href="/hinarios"
        class="hover:text-ink dark:hover:text-cream {ativo.hinarios ? CLASSE_ATIVO : ''}"
        aria-current={ativo.hinarios ? "page" : undefined}
      >
        Hinários
      </a>
      <a
        href="/busca"
        class="hover:text-ink dark:hover:text-cream {ativo.busca ? CLASSE_ATIVO : ''}"
        aria-current={ativo.busca ? "page" : undefined}
      >
        Buscar
      </a>
    </nav>

    <form action="/busca" method="get" class="ml-auto hidden md:block relative" role="search">
      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" aria-hidden="true">⌕</span>
      <input
        bind:this={campoDeBusca}
        type="search"
        name="q"
        placeholder="Buscar hinos…"
        aria-label="Buscar hinos"
        data-global-search
        class="w-64 pl-9 pr-12 py-2 rounded-full bg-ink/5 dark:bg-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
      />
      <kbd
        class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono uppercase tracking-widest text-ink/40"
      >
        ⌘K
      </kbd>
    </form>

    <div class="flex items-center gap-3 ml-auto md:ml-2">
      {#if isEditor}
        <a
          href="/editor"
          class="editor-cta hidden md:inline-flex {ativo.editor ? 'is-active' : ''}"
          aria-current={ativo.editor ? "page" : undefined}
          data-editor-cta
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M2.5 3.5 H13.5 M2.5 8 H13.5 M2.5 12.5 H9" />
            <circle cx="12" cy="12.5" r="2" />
          </svg>
          <span>Fila de revisão</span>
          {#if editorPendingCount}
            <span class="editor-cta-count" data-testid="editor-cta-count">{editorPendingCount}</span>
          {/if}
        </a>
      {/if}

      <button
        type="button"
        aria-label="Abrir menu"
        aria-expanded={menuAberto}
        aria-controls="mobile-menu"
        data-mobile-menu-toggle
        onclick={() => (menuAberto = true)}
        class="md:hidden w-9 h-9 rounded-full hover:bg-ink/5 dark:hover:bg-white/10 inline-flex items-center justify-center text-ink dark:text-cream"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>

      <ThemeToggle />

      {#if currentUser}
        <a
          href="/notificacoes"
          class="relative w-9 h-9 rounded-full hover:bg-ink/5 dark:hover:bg-white/10 inline-flex items-center justify-center text-ink dark:text-cream"
          aria-label="Notificações"
          data-testid="notifications-link"
        >
          <svg
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
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </a>
        <a
          href="/perfil/{currentUser.username}"
          class="w-9 h-9 rounded-full bg-moss text-cream flex items-center justify-center font-mono text-xs uppercase tracking-widest hover:opacity-90"
          aria-label="Perfil de {currentUser.username}"
          data-testid="user-avatar"
        >
          {currentUser.username.slice(0, 2).toUpperCase()}
        </a>
      {:else}
        <a
          href="/login"
          class="text-sm bg-firmament text-cream px-3 py-1.5 rounded-full hover:bg-firmament-2"
        >
          Entrar
        </a>
      {/if}
    </div>
  </div>
</header>

<!--
  Gaveta mobile (`md:hidden`). Vive FORA do `<header>` porque o header tem
  `backdrop-filter`, que cria um containing block e prende o `position: fixed`,
  impedindo o `inset-y-0` de chegar às bordas da viewport. Mesma razão
  documentada no template do monolito.
-->
<div
  data-mobile-menu-backdrop
  onclick={() => (menuAberto = false)}
  class="fixed inset-0 bg-ink/40 dark:bg-black/60 transition-opacity md:hidden z-40 {menuAberto
    ? 'opacity-100'
    : 'opacity-0 pointer-events-none'}"
  aria-hidden="true"
></div>
<aside
  id="mobile-menu"
  data-mobile-menu
  class="fixed inset-y-0 right-0 w-72 max-w-[85vw] bg-cream dark:bg-night-deep shadow-soft border-l border-ink/10 dark:border-cream/10 transition-transform md:hidden z-50 flex flex-col {menuAberto
    ? 'translate-x-0'
    : 'translate-x-full'}"
  aria-hidden={!menuAberto}
  tabindex="-1"
>
  <div
    class="flex items-center justify-between px-5 h-16 border-b border-ink/10 dark:border-cream/10"
  >
    <span class="font-display text-xl">Hinaria</span>
    <button
      type="button"
      aria-label="Fechar menu"
      data-mobile-menu-close
      onclick={() => (menuAberto = false)}
      class="w-9 h-9 rounded-full hover:bg-ink/5 dark:hover:bg-white/10 inline-flex items-center justify-center text-ink dark:text-cream"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  </div>
  <nav class="flex-1 overflow-y-auto py-2" aria-label="Menu mobile">
    <a
      href="/"
      class="block px-5 py-3 hover:bg-ink/5 dark:hover:bg-white/5 {ativo.inicio
        ? 'text-firmament dark:text-firmament'
        : ''}"
    >
      Início
    </a>
    <a
      href="/hinarios"
      class="block px-5 py-3 hover:bg-ink/5 dark:hover:bg-white/5 {ativo.hinarios
        ? 'text-firmament dark:text-firmament'
        : ''}"
    >
      Hinários
    </a>
    <a
      href="/busca"
      class="block px-5 py-3 hover:bg-ink/5 dark:hover:bg-white/5 {ativo.busca
        ? 'text-firmament dark:text-firmament'
        : ''}"
    >
      Buscar
    </a>
    {#if currentUser}
      {#if isEditor}
        <a
          href="/editor"
          class="block px-5 py-3 hover:bg-ink/5 dark:hover:bg-white/5 {ativo.editor
            ? 'text-firmament dark:text-firmament'
            : ''}"
        >
          Fila de revisão
          {#if editorPendingCount}
            <span class="editor-cta-count align-middle ml-1">{editorPendingCount}</span>
          {/if}
        </a>
      {/if}
      <hr class="border-ink/10 dark:border-cream/10 my-2" />
      <a href="/perfil/{currentUser.username}" class="block px-5 py-3 hover:bg-ink/5 dark:hover:bg-white/5">
        Meu perfil
      </a>
    {:else}
      <hr class="border-ink/10 dark:border-cream/10 my-2" />
      <a href="/login" class="block px-5 py-3 hover:bg-ink/5 dark:hover:bg-white/5">Entrar</a>
    {/if}
  </nav>
  <form
    action="/busca"
    method="get"
    class="p-4 border-t border-ink/10 dark:border-cream/10"
    role="search"
  >
    <input
      type="search"
      name="q"
      placeholder="Buscar hinos…"
      aria-label="Buscar hinos"
      class="w-full px-4 py-2 rounded-full bg-ink/5 dark:bg-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
    />
  </form>
</aside>
