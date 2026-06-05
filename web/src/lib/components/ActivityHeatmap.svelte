<script lang="ts">
  /**
   * Marco 4.H — Ciclo 4H.4.
   *
   * Heatmap de atividade (53 colunas × 7 linhas = 371 células), com cor
   * proporcional ao count do bucket. Paridade visual com
   * `api_user_heatmap` (apps/users/api_views.py) e o template legado em
   * `templates/users/profile.html` (semanas em colunas, dias em linhas).
   *
   * Recebe `buckets`: array de `{ date, count }` ordenado por data. Se
   * tiver menos de 371 itens, as cells extras ficam neutras.
   *
   * Cor: gradiente da cor de fundo (count=0) até a cor de destaque
   * (count=max). Usamos opacidade ao invés de escala discreta — fica
   * mais suave e independe do tema (dark/light).
   */

  export interface HeatmapBucket {
    date: string;
    count: number;
  }

  const COLS = 53;
  const ROWS = 7;
  const CELL = 12; // px (lado do quadradinho)
  const GAP = 2; // px (espaçamento)
  const STRIDE = CELL + GAP;
  const WIDTH = COLS * STRIDE - GAP;
  const HEIGHT = ROWS * STRIDE - GAP;

  let { buckets }: { buckets: HeatmapBucket[] } = $props();

  const maxCount = $derived(buckets.reduce((m, b) => (b.count > m ? b.count : m), 0));

  /**
   * Distribui buckets pela grid: coluna = floor(i / 7), linha = i % 7.
   * Layout idêntico ao template legado (grid-flow-col grid-rows-7).
   */
  function colorFor(count: number, max: number): string {
    if (count <= 0 || max <= 0) {
      return "rgba(20, 33, 58, 0.08)"; // neutro (paridade com profile.html)
    }
    const ratio = count / max;
    const opacity = 0.25 + ratio * 0.75;
    return `rgba(181, 141, 62, ${opacity.toFixed(2)})`;
  }
</script>

<svg
  class="heatmap"
  data-testid="activity-heatmap"
  viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
  width={WIDTH}
  height={HEIGHT}
  role="img"
  aria-label="Heatmap de atividade editorial dos últimos 365 dias"
>
  {#each Array(COLS * ROWS) as _, i (i)}
    {@const col = Math.floor(i / ROWS)}
    {@const row = i % ROWS}
    {@const bucket = buckets[i]}
    {@const count = bucket?.count ?? 0}
    {@const label = bucket ? `${bucket.date}: ${count} revisão${count === 1 ? "" : "ões"}` : ""}
    <rect
      data-bucket-cell
      x={col * STRIDE}
      y={row * STRIDE}
      width={CELL}
      height={CELL}
      rx={2}
      ry={2}
      fill={colorFor(count, maxCount)}
      aria-label={label}
      title={label}
    ></rect>
  {/each}
</svg>

<style>
  .heatmap {
    display: block;
    max-width: 100%;
    overflow: visible;
  }
</style>
