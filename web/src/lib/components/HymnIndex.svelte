<script lang="ts">
  /**
   * Marco 4.D — Ciclo 4D.2.
   * Fase 4 da paridade visual (2026-08-31) — porte do índice de
   * `templates/hymns/hymnbook_detail.html`.
   *
   * A lista era número + título em duas colunas. Ganhou tudo o que o monolito
   * tem em cada linha:
   *
   *   - agrupamento por SEÇÃO, com cabeçalho em `font-display text-firmament`
   *     (o `{% regroup hymns by section %}` de lá);
   *   - botão ▶ de 28px quando há gravação aprovada, `⊘` cinza quando não —
   *     o `hymns_with_audio` do monolito, aqui `hasApprovedAudio`;
   *   - régua pontilhada (`.dot-leader` + `.leader-fill`, do
   *     `components.css` portado) entre o título e o estilo;
   *   - tag de ESTILO à direita (VALSA / MARCHA / MAZURCA) em `label-mono`,
   *     que não existia.
   *
   * O ▶ toca de verdade. Buscar a URL do áudio de todos os hinos no load
   * seria N+1 — o índice de "O Cruzeirinho" tem 160 linhas — então a busca é
   * SOB DEMANDA, no clique: uma consulta por clique, nenhuma no carregamento.
   * Botão que parece ativo e não faz nada seria pior que indicador nenhum.
   */
  import { GRAPHQL_URL } from "$lib/config";
  import { gqlFetch } from "$lib/graphql/fetcher";
  import { HYMN_AUDIOS_QUERY } from "$lib/graphql/operations";
  import { audioPlayer, audioState, type AudioTrack } from "$lib/stores/audio";

  interface HymnSummary {
    id: string;
    number: number;
    title: string;
    style?: string;
    section?: string;
    hasApprovedAudio?: boolean;
  }

  let { hymns, hymnbookSlug = "" }: { hymns: HymnSummary[]; hymnbookSlug?: string } = $props();

  let player = $derived($audioState);

  /** Hino cuja busca de áudio está em voo, para não disparar duas vezes. */
  let carregando = $state<string | null>(null);

  function pad2(n: number): string {
    return n < 10 ? `0${n}` : String(n);
  }

  /**
   * Agrupa preservando a ORDEM de chegada, como o `regroup` do Django: ele
   * agrupa itens ADJACENTES, não reordena. Os hinos já vêm ordenados por
   * número, então a ordem das seções é a de primeira aparição.
   */
  const grupos = $derived.by(() => {
    const saida: Array<{ secao: string; itens: HymnSummary[] }> = [];
    for (const hino of hymns) {
      const secao = hino.section ?? "";
      const ultimo = saida[saida.length - 1];
      if (ultimo && ultimo.secao === secao) ultimo.itens.push(hino);
      else saida.push({ secao, itens: [hino] });
    }
    return saida;
  });

  function tocando(hymnId: string): boolean {
    return player.currentTrack?.id.startsWith(hymnId) === true && player.isPlaying;
  }

  async function tocar(hino: HymnSummary) {
    if (carregando) return;
    carregando = hino.id;
    try {
      const resposta = await gqlFetch<{
        hymn: { audios: Array<{ id: string; url: string; title: string }> } | null;
      }>(fetch, GRAPHQL_URL, HYMN_AUDIOS_QUERY, { pk: hino.id });
      const audio = resposta.data?.hymn?.audios?.[0];
      if (!audio) return;
      const faixa: AudioTrack = {
        id: audio.id,
        url: audio.url,
        title: audio.title || hino.title,
        hymnNumber: hino.number,
        hymnbookSlug,
      };
      audioPlayer.play(faixa);
    } finally {
      carregando = null;
    }
  }
</script>

{#if hymns.length === 0}
  <p data-testid="hymn-index-empty" class="text-ink-soft">Nenhum hino cadastrado.</p>
{:else}
  {#each grupos as grupo, i (grupo.secao + i)}
    {#if grupo.secao}
      <h3
        class="font-display text-2xl text-firmament max-w-4xl mx-auto mb-3 {i === 0
          ? ''
          : 'mt-10'}"
        data-section-header
      >
        {grupo.secao}
      </h3>
    {/if}
    <ol
      class="grid sm:grid-cols-2 gap-x-12 gap-y-2 font-serif max-w-4xl mx-auto"
      data-testid="hymn-index"
    >
      {#each grupo.itens as h (h.id)}
        <li class="flex items-center gap-2" data-testid="hymn-index-item">
          {#if h.hasApprovedAudio}
            <button
              type="button"
              onclick={() => tocar(h)}
              disabled={carregando === h.id}
              class="shrink-0 w-7 h-7 grid place-items-center rounded-full border border-firmament/30 text-firmament hover:bg-firmament hover:text-cream transition disabled:opacity-50"
              aria-label={tocando(h.id) ? `Pausar hino ${h.number}` : `Tocar hino ${h.number}`}
              data-testid="hymn-play"
            >
              {#if tocando(h.id)}
                <svg width="9" height="9" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                  <rect x="2" y="2" width="3" height="10" />
                  <rect x="9" y="2" width="3" height="10" />
                </svg>
              {:else}
                <svg width="9" height="9" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                  <path d="M3 1 L12 7 L3 13 Z" />
                </svg>
              {/if}
            </button>
          {:else}
            <span
              class="shrink-0 w-7 h-7 grid place-items-center text-ink-mute opacity-40"
              aria-label="Sem gravação"
              title="Sem gravação ainda"
              data-testid="hymn-no-audio"
            >
              ⊘
            </span>
          {/if}
          <a href={`/hinos/${h.id}`} class="dot-leader py-2 hover:text-gold flex-1 min-w-0">
            <span class="font-mono text-xs text-ink-soft pr-2">{pad2(h.number)}</span>
            <span class="text-lg">{h.title}</span>
            <span class="leader-fill"></span>
            {#if h.style}
              <span class="label-mono" data-testid="hymn-style">{h.style}</span>
            {/if}
          </a>
        </li>
      {/each}
    </ol>
  {/each}
{/if}
