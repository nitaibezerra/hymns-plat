<script lang="ts">
  /**
   * Marco 4.F — Ciclos 4F.4 e 4F.5.
   *
   * Waveform como SVG puro. Recebe `peaks` (lista de amplitudes em [0, 1])
   * e desenha uma barra por pico. As primeiras `peaks.length * progress`
   * barras ganham a classe `played` (animação visual da camada tocada,
   * paridade visual com `static/js/audio-player.js`).
   *
   * Clique no SVG calcula a fração `clickX/width` e chama `onSeek(ratio)`.
   * O chamador (`AudioPlayer`) multiplica `ratio` pela `duration` pra
   * obter o instante em segundos.
   *
   * Decisão: progress vem como prop, não como derived do store — o
   * componente é dumb e reutilizável (o store global poderia ser injetado
   * em outro contexto, ex. preview de áudio em formulário).
   */

  type Props = {
    peaks: number[];
    progress: number;
    onSeek?: (ratio: number) => void;
  };

  let { peaks, progress, onSeek }: Props = $props();

  // Constantes de layout — espelham `audio-player.js` (240x36 viewBox).
  const VIEW_WIDTH = 240;
  const VIEW_HEIGHT = 36;

  type Bar = {
    x: number;
    y: number;
    w: number;
    h: number;
    isPlayed: boolean;
  };

  let bars = $derived.by<Bar[]>(() => {
    const total = peaks.length;
    if (total === 0) return [];
    const slot = VIEW_WIDTH / total;
    const barW = Math.max(1.2, slot * 0.55);
    const playedThreshold = total * progress;
    const out: Bar[] = new Array(total);
    for (let i = 0; i < total; i++) {
      const h = Math.max(2, peaks[i] * 32);
      const y = (VIEW_HEIGHT - h) / 2;
      const x = i * slot + (slot - barW) / 2;
      out[i] = { x, y, w: barW, h, isPlayed: i < playedThreshold };
    }
    return out;
  });

  function handleClick(event: MouseEvent) {
    if (!onSeek) return;
    const target = event.currentTarget as SVGSVGElement;
    const rect = target.getBoundingClientRect();
    if (rect.width === 0) return;
    const ratio = (event.clientX - rect.left) / rect.width;
    const clamped = Math.max(0, Math.min(1, ratio));
    onSeek(clamped);
  }
</script>

<svg
  viewBox="0 0 {VIEW_WIDTH} {VIEW_HEIGHT}"
  preserveAspectRatio="none"
  class="waveform"
  role="presentation"
  data-testid="waveform-svg"
  onclick={handleClick}
>
  {#each bars as bar, i (i)}
    <rect
      data-bar
      class={bar.isPlayed ? "played" : ""}
      x={bar.x.toFixed(2)}
      y={bar.y.toFixed(2)}
      width={bar.w.toFixed(2)}
      height={bar.h.toFixed(2)}
      rx="0.8"
    />
  {/each}
</svg>

<style>
  .waveform {
    cursor: pointer;
    display: block;
    height: 100%;
    width: 100%;
  }
  rect {
    fill: var(--color-text-soft, currentColor);
    opacity: 0.35;
    transition: opacity 0.12s ease;
  }
  rect.played {
    fill: var(--color-accent, currentColor);
    opacity: 1;
  }
</style>
