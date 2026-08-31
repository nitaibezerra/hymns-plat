<script lang="ts">
  /**
   * Marco 4.D — Detalhe do hinário em 3 modos (índice/corrido/carrossel).
   * Fase 4 da paridade visual (2026-08-31) — porte do hero de
   * `templates/hymns/hymnbook_detail.html`.
   *
   * O que faltava: TODO o hero. O monolito abre com uma faixa de ~470px em
   * gradiente na cor do hinário, com card de capa 3/4 à esquerda e, à direita,
   * o nome em Cormorant 48–60px, o subtítulo em serifa itálica, a descrição, as
   * contagens e dois CTAs ("Tocar hinário", "Abrir hinário"). A SPA tinha o
   * nome em texto corrido de 16px. Era a pior rota medida: 59,42% de diff, com
   * 65,29% só na região do corpo.
   *
   * DIVERGÊNCIA ACEITA (decisão do usuário, 2026-08-31): as três pílulas de
   * modo (Índice/Corrido/Carrossel) continuam aqui. No monolito
   * `/hinarios/<slug>/` mostra SÓ o índice e a leitura vive em
   * `/hinarios/<slug>/ler/?modo=…`; manter `?mode=` nesta rota foi decisão
   * explícita. Elas ficam abaixo do hero, no lugar do bloco de ações de edição
   * que o monolito põe ali.
   *
   * O modo carrossel esconde hero e pílulas — decisão "Reader Focus" herdada
   * do monolito.
   */
  import HymnCarousel from "$lib/components/HymnCarousel.svelte";
  import HymnCorrido from "$lib/components/HymnCorrido.svelte";
  import HymnIndex from "$lib/components/HymnIndex.svelte";
  import ModeTogglePills from "$lib/components/ModeTogglePills.svelte";

  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let isCarousel = $derived(data.mode === "carrossel");
  /**
   * O hero é do ÍNDICE, não da leitura.
   *
   * Medido: aplicá-lo a todo modo que não fosse carrossel fez `hymnbook-corrido`
   * saltar de 1,50% pra 59,90% e o ratchet reprovou. No monolito são páginas
   * diferentes — `/hinarios/<slug>/` tem o hero, e `/hinarios/<slug>/ler/`
   * abre com um header minimalista de duas abas. Como esta rota concentra os
   * três modos (divergência aceita do `?mode=`), o hero tem que seguir o modo.
   */
  let mostraHero = $derived(data.mode === "indice");

  const accent = $derived(data.hymnbook?.displayAccent || "#1A2A4A");
  const gradienteHero = $derived(
    `background: linear-gradient(140deg, ${accent} 0%, color-mix(in srgb, ${accent} 55%, black) 100%);`,
  );
  /** Fundo do card de capa: mais escuro que a faixa, como no monolito. */
  const fundoDaCapa = $derived(`background: color-mix(in srgb, ${accent} 75%, black);`);

  const monograma = $derived((data.hymnbook?.name ?? "").slice(0, 1).toUpperCase());

  /**
   * Mesmo default do template: `description|default:"Hinário recebido por "…`.
   * Sem dono conhecido não inventamos frase — fica vazio.
   */
  const descricao = $derived(
    data.hymnbook?.description ||
      (data.hymnbook?.ownerName ? `Hinário recebido por ${data.hymnbook.ownerName}.` : ""),
  );

  const temAudio = $derived((data.hymnbook?.stats.audiosApproved ?? 0) > 0);
</script>

<div data-testid="hymnbook-detail">
  {#if data.error}
    <p class="max-w-6xl mx-auto px-6 py-10" data-testid="error">
      Falha ao carregar hinário: {data.error}
    </p>
  {:else if !data.hymnbook}
    <p class="max-w-6xl mx-auto px-6 py-10" data-testid="not-found">Hinário não encontrado.</p>
  {:else}
    {#if mostraHero}
      <section
        class="relative overflow-hidden text-cream"
        style={gradienteHero}
        data-testid="hymnbook-hero"
      >
        <div
          class="max-w-6xl mx-auto px-6 py-12 md:py-16 grid md:grid-cols-[260px_1fr] gap-10 items-end"
        >
          <div
            class="rounded-xl shadow-soft aspect-[3/4] relative overflow-hidden border border-cream/15"
            style={fundoDaCapa}
          >
            {#if data.hymnbook.coverImage}
              <img
                src={data.hymnbook.coverImage}
                alt="Capa de {data.hymnbook.name}"
                class="absolute inset-0 w-full h-full object-cover"
              />
            {:else}
              <span
                class="absolute inset-0 grid place-items-center font-display text-[12rem] leading-none text-cream/15"
                aria-hidden="true"
              >
                {monograma}
              </span>
              <div class="absolute bottom-4 left-4 right-4">
                <p class="font-display text-xl">{data.hymnbook.name}</p>
                {#if data.hymnbook.ownerName}
                  <p class="label-mono mt-1 text-cream/80">{data.hymnbook.ownerName}</p>
                {/if}
              </div>
            {/if}
          </div>

          <div>
            <h1 class="font-display text-5xl md:text-6xl leading-tight">{data.hymnbook.name}</h1>
            {#if data.hymnbook.introName && data.hymnbook.introName !== data.hymnbook.name}
              <p class="font-serif italic text-2xl text-cream/80 mt-2">
                {data.hymnbook.introName}
              </p>
            {/if}
            {#if descricao}
              <p class="mt-3 text-cream/80 max-w-2xl">{descricao}</p>
            {/if}

            <div class="mt-6 flex flex-wrap gap-x-6 gap-y-2 items-center">
              <span class="label-mono text-cream/80">{data.hymnbook.hymns.length} hinos</span>
              {#if data.hymnbook.stats.audiosApproved}
                <span class="label-mono text-cream/80">
                  {data.hymnbook.stats.audiosApproved} áudio{data.hymnbook.stats.audiosApproved ===
                  1
                    ? ""
                    : "s"}
                </span>
              {/if}
              <button
                type="button"
                disabled={!temAudio}
                aria-disabled={!temAudio}
                class="inline-flex items-center gap-2 rounded-full bg-gold-soft text-night px-4 py-1.5 text-sm font-medium hover:bg-gold disabled:opacity-40 disabled:cursor-not-allowed transition"
                title={temAudio ? "Tocar hinário do início" : "Sem gravações ainda"}
                data-testid="play-hymnbook"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                  <path d="M3 1 L12 7 L3 13 Z" />
                </svg>
                Tocar hinário
              </button>
              <a
                href="/hinarios/{data.hymnbook.slug}?mode=corrido"
                class="inline-flex items-center gap-2 rounded-full border border-gold-soft text-gold-soft hover:bg-gold-soft hover:text-night px-4 py-1.5 text-sm font-medium transition"
                title="Abrir hinário para leitura"
                data-testid="open-hymnbook"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2z" />
                  <path d="M22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z" />
                </svg>
                Abrir hinário
              </a>
            </div>
          </div>
        </div>
      </section>
    {/if}

    <section class="max-w-6xl mx-auto px-6 py-10">
      {#if !isCarousel}
        <div class="mb-8">
          <ModeTogglePills mode={data.mode} />
        </div>
      {/if}

      {#if data.mode === "indice"}
        <HymnIndex hymns={data.hymnbook.hymns} hymnbookSlug={data.hymnbook.slug} />
      {:else if data.mode === "corrido"}
        <HymnCorrido hymns={data.hymnbook.hymns} />
      {:else if data.mode === "carrossel"}
        <HymnCarousel hymns={data.hymnbook.hymns} hymnbookSlug={data.hymnbook.slug} />
      {/if}
    </section>
  {/if}
</div>
