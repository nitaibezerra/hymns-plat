<script lang="ts">
  /**
   * Marco 5.B — Ciclo 5B.8.
   *
   * Lista de hinos de um hinário com badge de status, em paridade com o
   * `<ul>` de `templates/hymns/editor/hymnbook_detail.html`.
   *
   * Os rótulos são exatamente os de `Hymn.ReviewStatus` no Django ("Não
   * revisado" / "Em revisão" / "Revisado"): o editor transita entre o
   * monolito e esta tela, e vocabulário divergente o faria duvidar do dado.
   *
   * Status desconhecido cai em "Não revisado" em vez de renderizar vazio —
   * se o backend ganhar um estado novo antes desta tela, a lista continua
   * legível e o pior caso é um hino parecer mais atrasado do que está.
   */
  export interface HymnStatusItem {
    id: string;
    number: number;
    title: string;
    reviewStatus: string;
  }

  interface StatusPresentation {
    label: string;
    tone: string;
  }

  const STATUS: Record<string, StatusPresentation> = {
    REVIEWED: { label: "Revisado", tone: "is-reviewed" },
    IN_REVIEW: { label: "Em revisão", tone: "is-in-review" },
    NOT_REVIEWED: { label: "Não revisado", tone: "is-not-reviewed" },
  };

  const FALLBACK_STATUS = STATUS.NOT_REVIEWED;

  let {
    hymns = [],
    hrefFor,
  }: {
    hymns?: HymnStatusItem[];
    hrefFor: (pk: string) => string;
  } = $props();

  function presentation(status: string): StatusPresentation {
    return STATUS[status] ?? FALLBACK_STATUS;
  }

  function twoDigits(number: number): string {
    return String(number).padStart(2, "0");
  }
</script>

{#if hymns.length === 0}
  <p class="empty font-serif" data-testid="hymn-list-empty">
    Nenhum hino cadastrado neste hinário ainda.
  </p>
{:else}
  <ul class="hymn-list" data-testid="hymn-status-list">
    {#each hymns as hymn (hymn.id)}
      {@const status = presentation(hymn.reviewStatus)}
      <li class="hymn-row" data-testid={`hymn-row-${hymn.id}`}>
        <span class="hymn-number" data-testid={`hymn-number-${hymn.id}`}>
          {twoDigits(hymn.number)}
        </span>

        <span class="font-display hymn-title" data-testid={`hymn-title-${hymn.id}`}>
          {hymn.title}
        </span>

        <span
          class={`hymn-badge ${status.tone}`}
          data-testid={`hymn-badge-${hymn.id}`}
          data-status={hymn.reviewStatus}
        >
          <span aria-hidden="true">●</span> {status.label}
        </span>

        <a
          class="hymn-revise"
          href={hrefFor(hymn.id)}
          data-testid={`hymn-revise-${hymn.id}`}
          aria-label={`Revisar hino ${hymn.number} — ${hymn.title}`}
        >
          Revisar
        </a>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .empty {
    color: var(--color-text-muted);
    font-style: italic;
    margin: 0;
    padding: 2rem 0;
    text-align: center;
  }
  .hymn-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .hymn-row {
    align-items: center;
    border-top: 1px solid var(--color-border-soft);
    display: flex;
    gap: 1rem;
    padding: 0.75rem 0;
  }
  .hymn-row:first-child {
    border-top: 0;
  }
  .hymn-number {
    color: var(--color-text-muted);
    flex-shrink: 0;
    font-family: var(--font-mono, var(--font-sans));
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    text-align: right;
    width: 2rem;
  }
  .hymn-title {
    flex: 1;
    font-size: 1.125rem;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hymn-badge {
    flex-shrink: 0;
    font-family: var(--font-mono, var(--font-sans));
    font-size: 0.625rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .is-reviewed {
    color: var(--color-status-ok);
  }
  .is-in-review {
    color: var(--color-status-mid);
  }
  .is-not-reviewed {
    color: var(--color-status-not);
  }
  .hymn-revise {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-pill);
    color: var(--color-text-soft);
    flex-shrink: 0;
    font-family: var(--font-mono, var(--font-sans));
    font-size: 0.6875rem;
    letter-spacing: 0.12em;
    padding: 0.3125rem 0.75rem;
    text-decoration: none;
    text-transform: uppercase;
  }
  .hymn-revise:hover,
  .hymn-revise:focus-visible {
    background: var(--color-bg-deep);
    color: var(--color-text);
  }
</style>
