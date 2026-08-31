<script lang="ts">
  /**
   * Marco 4.C — Ciclo 4C.3.
   * Fase 4 da paridade visual (2026-08-31) — porte de `templates/hymns/home.html`.
   *
   * Estrutura, agora igual à do monolito:
   *
   *   - faixa de hero FULL-BLEED em `bg-cream-deep`, com grid de duas colunas
   *     (1.4fr para o texto, 1fr para o círculo decorativo desfocado);
   *   - H1 em `font-display text-5xl md:text-6xl` quebrado em TRÊS linhas, com
   *     "com firmeza." em itálico e opacidade reduzida;
   *   - campo de busca em pílula como CTA principal, no lugar dos dois botões
   *     "Explorar hinários" / "Buscar hinos" que a SPA tinha;
   *   - 4 stats com número em `font-display text-3xl text-gold`;
   *   - seção "Em destaque" com grid de 3 colunas.
   *
   * DIVERGÊNCIA ACEITA (decisão do usuário, 2026-08-31): os stats mantêm o
   * RÓTULO ACIMA do número. O monolito imprime número e depois rótulo
   * (`<dt>` número / `<dd>` rótulo). A tipografia é a mesma; só a ordem no DOM
   * difere. Registrado em `_plan/plano-paridade-visual-spa.md`.
   *
   * Por que esta página precisa que o `<main>` NÃO tenha container: o hero é
   * uma faixa de cor de borda a borda, com o container por dentro. Ver a lista
   * de rotas full-bleed em `+layout.svelte`.
   */
  import HymnbookCard from "$lib/components/HymnbookCard.svelte";

  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<div data-testid="home">
  <section
    class="bg-cream-deep dark:bg-night-deep border-b border-ink/10 dark:border-cream/10"
    data-testid="home-hero"
  >
    <div class="max-w-6xl mx-auto px-6 py-16 md:py-20 grid md:grid-cols-[1.4fr_1fr] gap-12">
      <div>
        <p class="label-mono mb-4">Hinaria · hinaria.com.br</p>
        <h1
          class="font-display text-5xl md:text-6xl leading-[1.05] tracking-tight"
          data-testid="home-hero-title"
        >
          Hinários para ouvir, <br /> estudar e cantar<br />
          <em class="text-ink/80 dark:text-cream/80">com firmeza.</em>
        </h1>
        <p class="mt-5 text-lg leading-relaxed text-ink-soft dark:text-cream/70 max-w-xl">
          Uma biblioteca aberta de hinos recebidos, com revisão editorial cuidadosa e três modos de
          leitura — pensada para uso durante os trabalhos.
        </p>

        <form action="/busca" method="get" class="mt-8 max-w-2xl" role="search">
          <div
            class="flex items-center gap-2 bg-cream dark:bg-night-deep border border-ink/15 dark:border-cream/20 rounded-full p-2 shadow-soft focus-within:ring-2 focus-within:ring-gold/50"
          >
            <span class="pl-3 text-ink/40" aria-hidden="true">⌕</span>
            <input
              type="search"
              name="q"
              placeholder="Buscar hinos, hinários ou trechos…"
              aria-label="Buscar hinos, hinários ou trechos"
              class="flex-1 bg-transparent px-2 py-2 focus:outline-none"
              autocomplete="off"
            />
            <button
              type="submit"
              class="bg-firmament text-cream rounded-full px-5 py-2 text-sm hover:bg-firmament-2"
            >
              Buscar
            </button>
          </div>
        </form>

        {#if data.stats}
          <dl class="mt-10 flex flex-wrap gap-x-12 gap-y-4" data-testid="global-stats">
            <div>
              <dt class="label-mono">Hinários</dt>
              <dd
                class="font-display text-3xl text-gold mt-1 ml-0"
                data-testid="stat-hymnbooks"
              >
                {data.stats.hymnbooks}
              </dd>
            </div>
            <div>
              <dt class="label-mono">Hinos</dt>
              <dd class="font-display text-3xl text-gold mt-1 ml-0" data-testid="stat-hymns">
                {data.stats.hymns}
              </dd>
            </div>
            <div>
              <dt class="label-mono">Áudios</dt>
              <dd class="font-display text-3xl text-gold mt-1 ml-0" data-testid="stat-audios">
                {data.stats.audios}
              </dd>
            </div>
            <div>
              <dt class="label-mono">Revisores ativos</dt>
              <dd class="font-display text-3xl text-gold mt-1 ml-0" data-testid="stat-reviewers">
                {data.stats.activeReviewers}
              </dd>
            </div>
          </dl>
        {:else if data.error}
          <p class="mt-10 text-rust" data-testid="error">Falha ao carregar stats: {data.error}</p>
        {/if}
      </div>

      <!-- Ornamento ambiental, sem conteúdo. Só aparece a partir de `md`. -->
      <aside class="hidden md:flex items-center justify-end" aria-hidden="true">
        <div
          class="w-72 h-72 rounded-full bg-gradient-to-br from-gold/40 to-ink/30 dark:from-gold/30 dark:to-night blur-xl"
        ></div>
      </aside>
    </div>
  </section>

  <section class="max-w-6xl mx-auto px-6 py-12" aria-labelledby="featured-heading">
    <header class="flex items-end justify-between mb-6">
      <h2 id="featured-heading" class="font-display text-3xl">Em destaque</h2>
      <a href="/hinarios" class="label-mono hover:text-gold">Ver todos →</a>
    </header>

    {#if data.featured.length > 0}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="home-featured-grid">
        {#each data.featured as hb (hb.id)}
          <HymnbookCard hymnbook={hb} />
        {/each}
      </div>
    {:else}
      <p class="text-ink-soft">Nenhum hinário publicado ainda.</p>
    {/if}
  </section>
</div>
