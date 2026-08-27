<script lang="ts">
  /**
   * Marco 4.D — Ciclos 4D.5 a 4D.9.
   *
   * "Reader Focus" — 1 slide por viewport (`w-screen`), hero+toggle escondidos
   * (responsabilidade do +page.svelte). Chrome fixa:
   *   - top progress bar  (4D.9) — width = (idx+1) / N * 100%
   *   - counter           (4D.5) — "idx+1 / N"
   *   - prev/next arrows  (4D.6/4D.7) — botões + ← →
   *   - bottom dots       (4D.7) — 1 dot por hino, click navega
   *
   * Teclado (4D.6): ← → navega, Esc → goto("?mode=indice").
   * `prefers-reduced-motion: reduce` (4D.8) desliga a transição CSS.
   */
  import { goto } from "$app/navigation";

  import HymnBody from "./HymnBody.svelte";

  interface HymnSummary {
    id: string;
    number: number;
    title: string;
    body: string | null;
  }

  let {
    hymns,
    hymnbookSlug: _hymnbookSlug,
  }: {
    hymns: HymnSummary[];
    hymnbookSlug: string;
  } = $props();

  let currentIndex = $state(0);
  let reducedMotion = $state(false);

  const total = $derived(hymns.length);
  const progressPercent = $derived(total === 0 ? 0 : ((currentIndex + 1) / total) * 100);
  const trackOffset = $derived(currentIndex * -100);

  function goTo(i: number): void {
    if (total === 0) return;
    const clamped = Math.max(0, Math.min(total - 1, i));
    currentIndex = clamped;
  }

  function next(): void {
    goTo(currentIndex + 1);
  }

  function prev(): void {
    goTo(currentIndex - 1);
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (
      target &&
      target.matches &&
      target.matches("input, textarea, select, [contenteditable]")
    ) {
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
    } else if (e.key === "Escape") {
      e.preventDefault();
      goto("?mode=indice");
    }
  }

  $effect(() => {
    // Detecta `prefers-reduced-motion` no mount; respeita decisão herdada do
    // monolito (`static/js/hymn-carousel.js` linha 5).
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });
</script>

{#if total === 0}
  <p data-testid="carousel-empty" class="carousel-empty">Nenhum hino cadastrado.</p>
{:else}
  <section
    class="carousel-root"
    data-testid="carousel-root"
    aria-roledescription="carousel"
    aria-label="Hinos do hinário"
  >
    <!-- Top progress bar (4D.9) -->
    <div class="carousel-progress-rail" aria-hidden="true">
      <div
        class="carousel-progress-fill"
        data-testid="carousel-progress"
        style={`width: ${progressPercent}%`}
      ></div>
    </div>

    <!-- Counter (4D.5) -->
    <div class="carousel-counter" data-testid="carousel-counter" aria-live="polite">
      <span class="carousel-counter-pill">{currentIndex + 1} / {total}</span>
    </div>

    <!-- Viewport + track -->
    <div class="carousel-viewport" data-testid="carousel-viewport">
      <div
        class="carousel-track"
        data-testid="carousel-track"
        data-reduced-motion={String(reducedMotion)}
        style={`transform: translateX(${trackOffset}%);`}
      >
        {#each hymns as h, i (h.id)}
          <article
            class="carousel-slide"
            data-testid="carousel-slide"
            aria-roledescription="slide"
            aria-label={`Hino ${h.number} — ${h.title}`}
            aria-current={i === currentIndex ? "true" : "false"}
          >
            <div class="carousel-slide-inner">
              <h2 class="carousel-slide-title">{h.number} — {h.title}</h2>
              <div class="carousel-body">
                <HymnBody body={h.body} />
              </div>
            </div>
          </article>
        {/each}
      </div>
    </div>

    <!-- Prev / Next arrows -->
    <button
      type="button"
      class="carousel-arrow carousel-arrow-prev"
      data-testid="carousel-prev"
      onclick={prev}
      disabled={currentIndex === 0}
      aria-label="Hino anterior"
    >
      ‹
    </button>
    <button
      type="button"
      class="carousel-arrow carousel-arrow-next"
      data-testid="carousel-next"
      onclick={next}
      disabled={currentIndex === total - 1}
      aria-label="Próximo hino"
    >
      ›
    </button>

    <!-- Bottom dots (4D.7) -->
    <div class="carousel-dots" role="tablist" aria-label="Navegação direta">
      {#each hymns as h, i (h.id)}
        <button
          type="button"
          class="carousel-dot"
          data-testid="carousel-dot"
          aria-current={i === currentIndex ? "true" : "false"}
          aria-label={`Ir para hino ${h.number}`}
          onclick={() => goTo(i)}
        ></button>
      {/each}
    </div>

    <p class="carousel-help label-mono">← → para navegar · Esc para sair</p>
  </section>
{/if}

<style>
  .carousel-root {
    position: relative;
    width: 100%;
    overflow: hidden;
  }
  .carousel-progress-rail {
    background: var(--color-border, rgba(0, 0, 0, 0.08));
    height: 3px;
    left: 0;
    position: fixed;
    right: 0;
    top: 0;
    z-index: 30;
  }
  .carousel-progress-fill {
    background: var(--color-accent, #b08c4a);
    height: 100%;
    transition: width 240ms ease;
  }
  .carousel-counter {
    display: flex;
    justify-content: center;
    margin: 1rem 0;
  }
  .carousel-counter-pill {
    background: var(--color-bg-soft, transparent);
    border: 1px solid var(--color-border, rgba(0, 0, 0, 0.12));
    border-radius: 999px;
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.75rem;
    padding: 0.25rem 0.75rem;
  }
  .carousel-viewport {
    overflow: hidden;
    width: 100%;
  }
  .carousel-track {
    align-items: stretch;
    display: flex;
    transition: transform 320ms ease;
    width: 100%;
  }
  .carousel-track[data-reduced-motion="true"] {
    transition: none;
  }
  .carousel-slide {
    flex: 0 0 100%;
    min-width: 0;
    width: 100vw;
  }
  .carousel-slide-inner {
    margin-inline: auto;
    max-width: 48rem;
    padding: 2.5rem 1.5rem;
    text-align: center;
  }
  .carousel-slide-title {
    font-family: var(--font-display, serif);
    font-size: 1.75rem;
    margin: 0 0 1.5rem;
  }
  /* `.carousel-body` espelha a regra do monolito
     `static/css/components.css` — block com `width: max-content`. */
  .carousel-body {
    text-align: center;
  }
  .carousel-arrow {
    align-items: center;
    background: var(--color-bg, #fff);
    border: 1px solid var(--color-border, rgba(0, 0, 0, 0.12));
    border-radius: 999px;
    color: var(--color-text);
    cursor: pointer;
    display: grid;
    font-size: 1.5rem;
    height: 2.75rem;
    place-items: center;
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 2.75rem;
    z-index: 10;
  }
  .carousel-arrow:disabled {
    cursor: not-allowed;
    opacity: 0.3;
  }
  .carousel-arrow-prev {
    left: 1rem;
  }
  .carousel-arrow-next {
    right: 1rem;
  }
  .carousel-dots {
    display: flex;
    gap: 0.375rem;
    justify-content: center;
    margin-top: 1rem;
  }
  .carousel-dot {
    background: var(--color-border, rgba(0, 0, 0, 0.2));
    border: none;
    border-radius: 999px;
    cursor: pointer;
    height: 8px;
    padding: 0;
    transition: background 160ms, width 160ms;
    width: 8px;
  }
  .carousel-dot[aria-current="true"] {
    background: var(--color-accent, #b08c4a);
    width: 24px;
  }
  .carousel-help {
    color: var(--color-text-soft, var(--color-text));
    font-size: 0.75rem;
    margin-top: 0.75rem;
    opacity: 0.7;
    text-align: center;
  }
  .carousel-empty {
    color: var(--color-text-soft, var(--color-text));
    opacity: 0.7;
    text-align: center;
  }
</style>
