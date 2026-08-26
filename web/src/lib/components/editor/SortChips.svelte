<script lang="ts">
  /**
   * Marco 5.B — Ciclo 5B.5.
   *
   * As 4 chips de ordenação da fila, ciclando off → asc → desc → off.
   * Paridade com o `[data-sort-row]` do template Django, inclusive o
   * numerinho que revela a ordem do ORDER BY quando há sort combinado.
   *
   * Cada chip é um `<a href>` de verdade: a ordenação é um ESTADO DE URL,
   * então precisa ser compartilhável, abrível em nova aba e sobreviver a um
   * refresh. O clique simples é interceptado só pra trocar a navegação
   * completa por `goto(..., { replaceState: true })` — sem o replaceState, o
   * botão "voltar" viraria um desfazer-clique-por-clique, o que ninguém
   * espera de um filtro.
   *
   * Toda a regra do ciclo mora em `$lib/editor-sort` (porte de
   * `editor_views.py`); aqui só há apresentação e navegação.
   */
  import { goto } from "$app/navigation";
  import { buildSortChips, type SortPair } from "$lib/editor-sort";

  let {
    pairs = [],
    priority = "all",
    basePath = "/editor/",
    total = null,
  }: {
    pairs?: SortPair[];
    priority?: string;
    basePath?: string;
    total?: number | null;
  } = $props();

  const chips = $derived(buildSortChips(pairs));

  /** `?sort=…&priority=…`, omitindo o que está no default. */
  function hrefFor(nextSort: string): string {
    const params: string[] = [];
    if (nextSort) params.push(`sort=${nextSort}`);
    if (priority && priority !== "all") params.push(`priority=${priority}`);
    return params.length ? `${basePath}?${params.join("&")}` : basePath;
  }

  const SORT_TITLES: Record<string, (label: string) => string> = {
    off: (label) => `Ordenar por ${label} (do menor para o maior)`,
    asc: (label) => `${label} — do menor para o maior. Clique para inverter`,
    desc: (label) => `${label} — do maior para o menor. Clique para desativar`,
  };

  /**
   * Deixa o browser cuidar de ctrl/cmd/shift-clique e do botão do meio —
   * quem pede "abrir em outra aba" não quer navegação client-side.
   */
  function isPlainClick(event: MouseEvent): boolean {
    return !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  }

  function handleClick(event: MouseEvent, href: string) {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    goto(href, { replaceState: true, noScroll: true, keepFocus: true });
  }

  const countLabel = $derived(
    total === null ? "" : `${total} ${total === 1 ? "hinário" : "hinários"}`,
  );
</script>

<div class="sort-row" data-testid="sort-chips">
  <span class="row-label">Ordenar por:</span>

  {#each chips as chip (chip.key)}
    {@const href = hrefFor(chip.nextSort)}
    <a
      class="sort-chip"
      class:is-active={chip.state !== "off"}
      {href}
      data-testid={`sort-chip-${chip.key}`}
      data-sort-state={chip.state}
      aria-pressed={chip.state !== "off"}
      title={SORT_TITLES[chip.state](chip.label)}
      onclick={(event) => handleClick(event, href)}
    >
      <span>{chip.label}</span>
      {#if chip.state === "asc"}
        <span class="sort-dir" aria-hidden="true">↑</span>
      {:else if chip.state === "desc"}
        <span class="sort-dir" aria-hidden="true">↓</span>
      {/if}
      {#if chip.position !== null}
        <span class="sort-pos" data-testid={`sort-position-${chip.key}`} aria-hidden="true">
          {chip.position}
        </span>
      {/if}
    </a>
  {/each}

  {#if countLabel}
    <span class="row-label sort-count" data-testid="sort-count">{countLabel}</span>
  {/if}
</div>

<style>
  .sort-row {
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
  .sort-count {
    margin-left: auto;
  }
  .sort-chip {
    align-items: center;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-pill);
    color: var(--color-text-soft);
    display: inline-flex;
    font-size: 0.8125rem;
    gap: 0.375rem;
    padding: 0.3125rem 0.75rem;
    text-decoration: none;
    transition:
      background 140ms ease,
      border-color 140ms ease,
      color 140ms ease;
  }
  .sort-chip:hover,
  .sort-chip:focus-visible {
    border-color: var(--color-accent-3);
    color: var(--color-text);
  }
  .sort-chip.is-active {
    background: color-mix(in srgb, var(--color-accent) 14%, transparent);
    border-color: var(--color-accent);
    color: var(--color-accent);
    font-weight: 500;
  }
  .sort-dir {
    font-size: 0.75rem;
    line-height: 1;
  }
  .sort-pos {
    background: var(--color-accent);
    border-radius: var(--radius-pill);
    color: var(--color-bg);
    font-family: var(--font-mono, var(--font-sans));
    font-size: 0.625rem;
    line-height: 1;
    padding: 0.1875rem 0.3125rem;
  }
</style>
