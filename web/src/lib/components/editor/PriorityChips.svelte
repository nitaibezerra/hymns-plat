<script lang="ts">
  /**
   * Marco 5.B — Ciclo 5B.6.
   *
   * Filtro de prioridade. Ao contrário do sort (combinável), aqui é
   * MUTUAMENTE EXCLUSIVO: uma chip ativa por vez, e "Todas" é o reset.
   *
   * O reset preserva o sort de propósito — o editor montou aquela ordem a
   * cliques, perder isso ao alargar o filtro seria hostil. Mesmo
   * comportamento da view Django, que reinjeta `encoded_sort` em todo href.
   *
   * `priority="all"` não vai pra querystring: é o default do argumento
   * `priority: String! = "all"` no schema, e com ele o backend promove a
   * prioridade a ORDER BY primário (P1 no topo) em vez de filtrar.
   */
  import { goto } from "$app/navigation";
  import { encodeSort, type SortPair } from "$lib/editor-sort";

  export interface PriorityOption {
    value: string;
    label: string;
    dot: string | null;
  }

  /** Ordem e rótulos idênticos aos do template Django. */
  const OPTIONS: readonly PriorityOption[] = [
    { value: "all", label: "Todas", dot: null },
    { value: "P1", label: "P1 Urgente", dot: "urgent" },
    { value: "P2", label: "P2 Atenção", dot: "attention" },
    { value: "P3", label: "P3", dot: null },
  ];

  let {
    priority = "all",
    pairs = [],
    basePath = "/editor/",
  }: {
    priority?: string;
    pairs?: SortPair[];
    basePath?: string;
  } = $props();

  const encodedSort = $derived(encodeSort(pairs));

  function hrefFor(value: string): string {
    const params: string[] = [];
    if (value !== "all") params.push(`priority=${value}`);
    if (encodedSort) params.push(`sort=${encodedSort}`);
    return params.length ? `${basePath}?${params.join("&")}` : basePath;
  }

  function isPlainClick(event: MouseEvent): boolean {
    return !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  }

  function handleClick(event: MouseEvent, href: string) {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    goto(href, { replaceState: true, noScroll: true, keepFocus: true });
  }
</script>

<div class="priority-row" data-testid="priority-chips">
  <span class="row-label">Prioridade:</span>

  {#each OPTIONS as option (option.value)}
    {@const href = hrefFor(option.value)}
    {@const active = option.value === priority}
    <a
      class="priority-chip"
      class:is-active={active}
      {href}
      data-testid={`priority-chip-${option.value}`}
      aria-current={active ? "true" : undefined}
      onclick={(event) => handleClick(event, href)}
    >
      {#if option.dot}
        <span class={`dot dot--${option.dot}`} data-dot={option.dot} aria-hidden="true"></span>
      {/if}
      {option.label}
    </a>
  {/each}
</div>

<style>
  .priority-row {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 0.625rem;
  }
  .row-label {
    color: var(--color-text-muted);
    font-family: var(--font-mono, var(--font-sans));
    font-size: 0.6875rem;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .priority-chip {
    align-items: center;
    border: 1px solid var(--color-border-soft);
    border-radius: var(--radius-pill);
    color: var(--color-text-soft);
    display: inline-flex;
    font-size: 0.8125rem;
    gap: 0.375rem;
    padding: 0.25rem 0.75rem;
    text-decoration: none;
    transition:
      background 140ms ease,
      border-color 140ms ease,
      color 140ms ease;
  }
  .priority-chip:hover,
  .priority-chip:focus-visible {
    border-color: var(--color-border);
    color: var(--color-text);
  }
  .priority-chip.is-active {
    background: var(--color-bg-deep);
    border-color: var(--color-border);
    color: var(--color-text);
    font-weight: 500;
  }
  .dot {
    border-radius: var(--radius-pill);
    height: 0.4375rem;
    width: 0.4375rem;
  }
  .dot--urgent {
    background: var(--color-status-not);
  }
  .dot--attention {
    background: var(--color-gold);
  }
</style>
