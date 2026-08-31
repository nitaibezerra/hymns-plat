<script lang="ts">
  /**
   * Marco 4.C — Ciclo 4C.2.
   * Fase 4 da paridade visual (2026-08-31) — porte de
   * `templates/_partials/_hymnbook_card.html`.
   *
   * O componente de maior alavancagem depois da casca: alimenta as DUAS piores
   * rotas medidas — `hinarios-list` (47,95%) e `home` (8,87%) — com o mesmo
   * markup.
   *
   * Era uma caixa clara com borda fina, título e três métricas rotuladas
   * (Hinos / Revisados / Áudios). Virou o card do monolito:
   *
   *   - fundo em GRADIENTE diagonal na cor do hinário (`displayAccent`), com
   *     todo o texto em creme por cima;
   *   - variante desktop "Foto Soberana": `aspect-[3/4]` full-bleed, capa
   *     cobrindo tudo (ou monograma gigante quando não há capa), véu escuro
   *     subindo da base pra garantir legibilidade, e a tipografia sobreposta;
   *   - variante mobile: linha horizontal com avatar circular de 80px;
   *   - selo "EST. AAAA" flutuante e "RASCUNHO" no canto oposto;
   *   - autor em `label-mono`, e contagens "N HINOS · N ÁUDIOS" separadas por
   *     um ponto dourado.
   *
   * "Revisados" SAIU por decisão do usuário (2026-08-31): o monolito não expõe
   * progresso de revisão ao público nos cards, e a paridade é o critério.
   *
   * A ordem no DOM é desktop ANTES de mobile, como no monolito, pra que
   * seletores `.first` em E2E rodando em viewport desktop peguem o card
   * visível e não o escondido por `sm:hidden`.
   */
  export interface HymnbookCardStats {
    hymnsTotal: number;
    hymnsReviewed: number;
    audiosApproved: number;
  }

  export interface HymnbookCardData {
    id: string;
    name: string;
    slug: string;
    isPublished: boolean;
    stats: HymnbookCardStats;
    /** Nome de quem recebeu o hinário. Aparece sob o título. */
    ownerName?: string | null;
    /** ISO-8601; só o ano é usado, no selo "EST. AAAA". */
    createdAt?: string | null;
    /** URL absoluta da capa (resolvida pela API). Sem capa, vai monograma. */
    coverImage?: string | null;
    /**
     * Cor do gradiente, de `HymnBookType.displayAccent`.
     *
     * O fallback existe só pra não explodir com dado antigo em cache; em
     * operação a API sempre manda, porque o campo é derivado do slug. Se este
     * fallback aparecer na tela, é sinal de query desatualizada, não de
     * hinário sem cor.
     */
    displayAccent?: string | null;
  }

  let {
    hymnbook,
    showDraftBadge = false,
  }: {
    hymnbook: HymnbookCardData;
    showDraftBadge?: boolean;
  } = $props();

  const isDraft = $derived(!hymnbook.isPublished);
  const showBadge = $derived(isDraft && showDraftBadge);

  const accent = $derived(hymnbook.displayAccent || "#1A2A4A");
  const gradiente = $derived(
    `background: linear-gradient(140deg, ${accent} 0%, color-mix(in srgb, ${accent} 60%, black) 100%);`,
  );

  /** Inicial do nome, para o monograma. `|first|upper` no template Django. */
  const monograma = $derived(hymnbook.name.slice(0, 1).toUpperCase());

  /** Ano do selo "EST. AAAA". Vazio quando a API não mandou `createdAt`. */
  const ano = $derived(
    hymnbook.createdAt ? String(new Date(hymnbook.createdAt).getFullYear()) : "",
  );
</script>

<a
  href={`/hinarios/${hymnbook.slug}`}
  class="group block rounded-xl overflow-hidden shadow-soft border border-ink/10 transition-transform hover:-translate-y-0.5 text-cream"
  style={gradiente}
  data-testid="hymnbook-card"
>
  <!-- Desktop — "Foto Soberana". -->
  <article class="hidden sm:block relative aspect-[3/4] overflow-hidden">
    {#if hymnbook.coverImage}
      <img
        src={hymnbook.coverImage}
        alt="Capa de {hymnbook.name}"
        class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
      />
    {:else}
      <span
        class="absolute inset-0 grid place-items-center font-display text-[14rem] leading-none text-cream/20"
        aria-hidden="true"
      >
        {monograma}
      </span>
    {/if}

    <!-- Véu escuro subindo da base — é o que mantém o texto legível sobre
         qualquer capa. -->
    <div
      class="absolute inset-0 pointer-events-none"
      style="background: linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.45) 35%, rgba(0,0,0,0.10) 60%, transparent 80%);"
    ></div>

    {#if ano}
      <span
        class="absolute top-4 left-4 label-mono text-cream/85 bg-night/35 backdrop-blur border border-cream/20 rounded-full px-2.5 py-1"
        data-testid="est-badge"
      >
        EST. {ano}
      </span>
    {/if}
    {#if showBadge}
      <p
        class="label-mono absolute top-4 right-4 bg-night/55 backdrop-blur border border-cream/20 px-2.5 py-1 rounded-full text-cream/90"
        data-testid="draft-badge"
      >
        RASCUNHO
      </p>
    {/if}

    <div class="absolute left-0 right-0 bottom-0 p-5">
      <h3 class="font-display text-2xl leading-tight" style="text-shadow: 0 1px 2px rgba(0,0,0,0.35);">
        {hymnbook.name}
      </h3>
      {#if hymnbook.ownerName}
        <p class="label-mono mt-2 text-cream/85" data-testid="owner-name">{hymnbook.ownerName}</p>
      {/if}
      {#if hymnbook.stats.hymnsTotal}
        <div class="mt-2 flex gap-2.5 items-center label-mono text-cream/75">
          <span data-testid="stat-hymns-total">{hymnbook.stats.hymnsTotal} HINOS</span>
          {#if hymnbook.stats.audiosApproved}
            <span class="w-1 h-1 rounded-full" style="background: var(--color-gold);"></span>
            <span data-testid="stat-audios-approved">{hymnbook.stats.audiosApproved} ÁUDIOS</span>
          {/if}
        </div>
      {/if}
    </div>
  </article>

  <!-- Mobile. -->
  <article class="sm:hidden relative flex items-center gap-4 p-4">
    <div
      class="shrink-0 w-20 h-20 rounded-full overflow-hidden border border-cream/15 bg-cream/5 grid place-items-center"
    >
      {#if hymnbook.coverImage}
        <img
          src={hymnbook.coverImage}
          alt="Capa de {hymnbook.name}"
          class="w-full h-full object-cover"
          loading="lazy"
        />
      {:else}
        <span class="font-display text-4xl leading-none text-cream/40" aria-hidden="true">
          {monograma}
        </span>
      {/if}
    </div>
    <div class="flex-1 min-w-0">
      <h3 class="font-display text-xl leading-tight">{hymnbook.name}</h3>
      {#if hymnbook.ownerName}
        <p class="label-mono mt-1 text-cream/80 truncate">{hymnbook.ownerName}</p>
      {/if}
      {#if showBadge}
        <p class="label-mono mt-2 inline-block bg-cream/15 px-2 py-0.5 rounded-full text-cream/90">
          RASCUNHO
        </p>
      {/if}
    </div>
  </article>
</a>
