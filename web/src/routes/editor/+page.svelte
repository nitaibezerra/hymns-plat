<script lang="ts">
  /**
   * Marco 5.B — Ciclo 5B.2.
   *
   * Dashboard editorial: "Fila de revisão". Paridade com
   * `templates/hymns/editor/hymnbook_list.html` — eyebrow mono, título em
   * `font-display`, autoria em `font-serif` itálico, grid de cards
   * verticais com pílula de prioridade.
   *
   * O número de ordem (01, 02, …) é a POSIÇÃO NA FILA, não o id do hinário:
   * ele muda quando o editor reordena, e é exatamente esse o recado — "este
   * é o próximo que você deveria pegar".
   */
  import EditorStatsBar from "$lib/components/editor/EditorStatsBar.svelte";
  import PriorityChips from "$lib/components/editor/PriorityChips.svelte";
  import ResumeCard from "$lib/components/editor/ResumeCard.svelte";
  import ReviewProgressBar from "$lib/components/editor/ReviewProgressBar.svelte";
  import SortChips from "$lib/components/editor/SortChips.svelte";

  import { _editorReviseHref } from "./+layout";

  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const PRIORITY_LABELS: Record<string, string> = {
    P1: "P1 Urgente",
    P2: "P2 Atenção",
    P3: "P3",
  };

  function priorityLabel(priority: string): string {
    return PRIORITY_LABELS[priority] ?? PRIORITY_LABELS.P3;
  }

  function priorityClass(priority: string): string {
    return `priority-pill priority-pill--${(priority || "P3").toLowerCase()}`;
  }

  /** "01", "02"… — posição na fila, com dois dígitos como no template. */
  function queueNumber(index: number): string {
    return String(index + 1).padStart(2, "0");
  }

  function uploadedAt(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return `subido em ${date.toLocaleDateString("pt-BR")}`;
  }
</script>

<section class="editor-page" data-testid="editor-dashboard">
  <header class="page-header">
    <div class="page-header-text">
      <p class="eyebrow">Workspace editorial</p>
      <h1 class="font-display page-title">Fila de revisão</h1>
      <p class="page-lede">
        Hinários aguardando revisão. Priorize pelo que está urgente, ou pelo que tem menos áudio
        aprovado.
      </p>
    </div>

    <div class="page-header-side">
      <EditorStatsBar stats={data.stats} />
      <!--
        Porta de entrada pra criação (1.1). Paridade com
        `templates/hymns/hymnbook_list.html`, que mostra "+ Novo hinário" sob
        `{% if perms.hymns.can_review_any_hymnbook %}`. Aqui não há `{% if %}`
        equivalente porque o guard de `/editor/+layout.ts` já barrou quem não
        é editor — a mesma permissão, checada uma vez na porta.
      -->
      <a class="new-hymnbook" href="/editor/hinarios/novo/" data-testid="new-hymnbook-link">
        + Novo hinário
      </a>
    </div>
  </header>

  <!--
    Áudios aguardando aprovação. O 5.B entregou isto como badge sem href
    porque `/editor/audios/pendentes/` ainda não existia; ela existe desde o
    5.D, então virou o link que o template Django sempre teve
    (`hymns:editor_pending_audios`), com a mesma linha de convite.
  -->
  {#if data.stats.pendingAudiosCount > 0}
    <a
      class="pending-audios"
      href="/editor/audios/pendentes/"
      data-testid="pending-audios-badge"
    >
      <span class="pending-audios-glyph" aria-hidden="true">♫</span>
      <span class="pending-audios-text">
        <span class="pending-audios-count">
          {data.stats.pendingAudiosCount}
          {data.stats.pendingAudiosCount === 1 ? "áudio" : "áudios"} aguardando aprovação
        </span>
        <span class="pending-audios-hint">
          Ouça e libere para aparecer no detalhe do hino
        </span>
      </span>
      <span class="pending-audios-cta">Revisar áudios →</span>
    </a>
  {/if}

  {#if data.stats.resumeHymn}
    <ResumeCard
      hymn={data.stats.resumeHymn}
      href={_editorReviseHref(data.stats.resumeHymn.id)}
    />
  {/if}

  {#if data.error}
    <p class="alert" role="alert" data-testid="editor-error">
      Não foi possível carregar a fila agora. Tente recarregar em instantes.
    </p>
  {/if}

  <div class="filters">
    <SortChips pairs={data.sort} priority={data.priority} total={data.hymnbooks.length} />
    <PriorityChips priority={data.priority} pairs={data.sort} />
  </div>

  <div class="queue-grid">
    {#each data.hymnbooks as book, index (book.id)}
      <article
        class="queue-card"
        class:queue-card--p1={book.priority === "P1"}
        data-testid={`queue-card-${book.slug}`}
        data-priority={book.priority}
      >
        <header class="queue-card-header">
          <div class="queue-card-num" class:is-lead={index === 0}>{queueNumber(index)}</div>
          <div class="queue-card-ident">
            <a class="font-display queue-card-title" href={`/editor/hinarios/${book.slug}/`}>
              {book.name}
            </a>
            <p class="font-serif queue-card-owner">
              {book.ownerName} · {uploadedAt(book.createdAt)}
            </p>
          </div>
          <span class={priorityClass(book.priority)} data-testid="priority-pill">
            {priorityLabel(book.priority)}
          </span>
        </header>

        <!--
          Duas seções, como no template Django: a flag formal de revisão
          (o que fecha o hinário) separada da completude de conteúdo (o que
          falta preencher). Misturar as quatro numa lista só apagaria essa
          diferença de peso.
        -->
        <div class="queue-card-metrics">
          <section class="metric-section">
            <h3 class="metric-eyebrow">Revisão formal</h3>
            <ReviewProgressBar
              label="Revisados"
              tone="review"
              pct={book.reviewProgress.reviewPct}
              count={`${book.stats.hymnsReviewed} de ${book.stats.hymnsTotal}`}
            />
          </section>

          <section class="metric-section">
            <h3 class="metric-eyebrow">Completude de conteúdo</h3>
            <ReviewProgressBar label="Estilo" pct={book.reviewProgress.stylePct} />
            <ReviewProgressBar label="Repetições" pct={book.reviewProgress.repsPct} />
            <ReviewProgressBar label="Áudios" pct={book.reviewProgress.audioPct} />
          </section>
        </div>
      </article>
    {:else}
      <div class="queue-empty font-serif" data-testid="queue-empty">
        {#if data.priority !== "all"}
          Nenhum hinário com essa prioridade.
        {:else}
          Nenhum hinário disponível na fila.
        {/if}
      </div>
    {/each}
  </div>
</section>

<style>
  .editor-page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .page-header {
    align-items: flex-end;
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
    justify-content: space-between;
  }
  .page-header-text {
    max-width: 34rem;
  }
  .page-header-side {
    align-items: flex-end;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-left: auto;
  }
  .new-hymnbook {
    background: var(--color-accent);
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-pill);
    color: var(--color-bg);
    font-family: var(--font-sans);
    font-size: 0.875rem;
    padding: 0.5rem 1.125rem;
    text-decoration: none;
    white-space: nowrap;
  }
  .new-hymnbook:hover,
  .new-hymnbook:focus-visible {
    background: var(--color-accent-2);
  }
  .eyebrow {
    color: var(--color-text-muted);
    font-family: var(--font-mono, var(--font-sans));
    font-size: 0.6875rem;
    font-weight: 500;
    letter-spacing: 0.14em;
    margin: 0;
    text-transform: uppercase;
  }
  .page-title {
    font-size: clamp(2rem, 4vw, 2.5rem);
    font-weight: 600;
    line-height: 1.05;
    margin: 0.5rem 0 0;
  }
  .page-lede {
    color: var(--color-text-soft);
    margin: 0.5rem 0 0;
  }
  .pending-audios {
    align-items: center;
    background: color-mix(in srgb, var(--color-gold) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-gold) 40%, transparent);
    border-radius: var(--radius-lg);
    color: var(--color-text);
    display: flex;
    gap: 0.75rem;
    margin: 0;
    padding: 0.75rem 1.125rem;
    text-decoration: none;
  }
  .pending-audios:hover,
  .pending-audios:focus-visible {
    background: color-mix(in srgb, var(--color-gold) 25%, transparent);
  }
  .pending-audios-text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
  }
  .pending-audios-count {
    font-weight: 500;
  }
  .pending-audios-hint {
    color: var(--color-text-muted);
    font-family: var(--font-mono, var(--font-sans));
    font-size: 0.6875rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .pending-audios-cta {
    color: var(--color-text-soft);
    flex-shrink: 0;
    font-family: var(--font-mono, var(--font-sans));
    font-size: 0.75rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .pending-audios-glyph {
    align-items: center;
    background: color-mix(in srgb, var(--color-gold) 30%, transparent);
    border-radius: var(--radius-pill);
    color: var(--color-gold);
    display: inline-flex;
    height: 2rem;
    justify-content: center;
    width: 2rem;
  }
  .alert {
    background: color-mix(in srgb, var(--color-status-not) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-status-not) 40%, transparent);
    border-radius: var(--radius-md);
    color: var(--color-text);
    margin: 0;
    padding: 0.75rem 1rem;
  }
  .filters {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .queue-grid {
    display: grid;
    gap: 1.25rem;
    grid-template-columns: 1fr;
  }
  @media (min-width: 48rem) {
    .queue-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  .queue-card {
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-1);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.25rem;
  }
  .queue-card--p1 {
    border-color: color-mix(in srgb, var(--color-status-not) 55%, var(--color-border));
  }
  .queue-card-header {
    align-items: flex-start;
    display: flex;
    gap: 0.875rem;
  }
  .queue-card-num {
    color: var(--color-text-muted);
    font-family: var(--font-mono, var(--font-sans));
    font-size: 0.875rem;
    letter-spacing: 0.06em;
    padding-top: 0.25rem;
  }
  .queue-card-num.is-lead {
    color: var(--color-gold);
  }
  .queue-card-ident {
    flex: 1;
    min-width: 0;
  }
  .queue-card-title {
    color: var(--color-text);
    display: inline-block;
    font-size: 1.375rem;
    font-weight: 600;
    line-height: 1.15;
    text-decoration: none;
  }
  .queue-card-title:hover,
  .queue-card-title:focus-visible {
    color: var(--color-accent);
    text-decoration: underline;
  }
  .queue-card-owner {
    color: var(--color-text-muted);
    font-size: 0.875rem;
    font-style: italic;
    margin: 0.125rem 0 0;
  }
  .queue-card-metrics {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .metric-section {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  .metric-eyebrow {
    color: var(--color-text-muted);
    font-family: var(--font-mono, var(--font-sans));
    font-size: 0.625rem;
    font-weight: 500;
    letter-spacing: 0.12em;
    margin: 0;
    text-transform: uppercase;
  }
  .priority-pill {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-pill);
    color: var(--color-text-soft);
    flex-shrink: 0;
    font-family: var(--font-sans);
    font-size: 0.625rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    padding: 0.25rem 0.625rem;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .priority-pill--p1 {
    background: color-mix(in srgb, var(--color-status-not) 16%, transparent);
    border-color: color-mix(in srgb, var(--color-status-not) 45%, transparent);
    color: var(--color-status-not);
  }
  .priority-pill--p2 {
    background: color-mix(in srgb, var(--color-gold) 16%, transparent);
    border-color: color-mix(in srgb, var(--color-gold) 45%, transparent);
    color: var(--color-gold);
  }
  .queue-empty {
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border-soft);
    border-radius: var(--radius-lg);
    color: var(--color-text-muted);
    font-style: italic;
    grid-column: 1 / -1;
    padding: 2.5rem;
    text-align: center;
  }
</style>
