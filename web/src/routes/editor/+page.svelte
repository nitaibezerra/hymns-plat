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
  import SortChips from "$lib/components/editor/SortChips.svelte";

  import { editorReviseHref } from "./+layout";

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

    <EditorStatsBar stats={data.stats} />
  </header>

  {#if data.stats.resumeHymn}
    <ResumeCard
      hymn={data.stats.resumeHymn}
      href={editorReviseHref(data.stats.resumeHymn.id)}
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

        <p class="queue-card-count">
          {book.stats.hymnsReviewed} de {book.stats.hymnsTotal} hinos revisados
        </p>
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
  .queue-card-count {
    color: var(--color-text-soft);
    font-size: 0.875rem;
    margin: 0;
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
