<script lang="ts">
  /**
   * Sub-marco 5.E — Ciclos 5E.1, 5E.2 e 5E.3.
   *
   * Tela 07c · Revisão ágil. Duas colunas, como o template Django: prévia à
   * esquerda ("como o leitor vai ver"), os dois parâmetros objetivos à
   * direita.
   */
  import HymnBody from "$lib/components/HymnBody.svelte";
  import QuickReviewPills from "$lib/components/editor/QuickReviewPills.svelte";
  import type { QuickReviewValues } from "$lib/components/editor/QuickReviewPills.svelte";
  import {
    fetchNextIncompleteHymn,
    quickReviewHymn,
  } from "$lib/graphql/operations/quick-review";
  import { goto } from "$app/navigation";

  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  /**
   * Rascunho local dos dois campos. Nasce do que está gravado no hino e é
   * re-semeado sempre que a load troca de hino (navegar por `?h=` mantém o
   * componente montado).
   */
  let values = $state<QuickReviewValues>({ style: "", repetitions: "" });
  let seededFor = $state<string | null>(null);

  $effect(() => {
    const current = data.current;
    if (!current || seededFor === current.id) return;
    seededFor = current.id;
    values = { style: current.style, repetitions: current.repetitions };
  });

  let saving = $state(false);
  let error = $state<string | null>(null);
  /** Virou true quando o último incompleto foi salvo nesta sessão (5E.4). */
  let finished = $state(false);

  const detailHref = $derived(`/editor/hinarios/${data.hymnbook.slug}/`);
  const quickHref = $derived(`/editor/hinarios/${data.hymnbook.slug}/revisao-agil/`);
  const done = $derived(finished || data.allComplete);

  /**
   * 5E.5 — anterior/próximo são vizinhos na LISTA, e viram `<a href>` de
   * verdade: navegação por URL, não por JS. Assim o editor pode abrir em nova
   * aba, voltar pelo histórico e o SSR renderiza o hino certo direto.
   *
   * Sem wrap-around, igual ao Django: nas pontas o botão fica presente mas
   * inerte (sem `href`), pra grade não pular de lugar.
   */
  const index = $derived(data.current ? data.hymns.indexOf(data.current) : -1);
  const prevHymn = $derived(index > 0 ? data.hymns[index - 1] : null);
  const nextHymn = $derived(
    index >= 0 && index + 1 < data.hymns.length ? data.hymns[index + 1] : null,
  );

  /** "02 DE 40" — dois dígitos como o `stringformat:"02d"` do template. */
  const pad = (n: number) => String(n).padStart(2, "0");
  const progressPct = $derived(data.total > 0 ? (data.position / data.total) * 100 : 0);

  /**
   * Grava os dois campos e pula pro próximo incompleto.
   *
   * `quickReviewHymn` só escreve `style` e `repetitions` — não mexe em
   * `review_status`, `last_reviewed_at` nem `last_reviewed_by` (regra pinada
   * por teste no backend). Por isso o botão diz "salvar e ir", não "concluir".
   *
   * `invalidateAll` força a load a rodar de novo no destino: sem isso o
   * SvelteKit reusaria o `data` da navegação anterior e a prévia mostraria o
   * hino errado.
   */
  async function submit() {
    const current = data.current;
    if (saving || !current) return;

    saving = true;
    error = null;
    const result = await quickReviewHymn(fetch, current.id, values.style, values.repetitions);
    if (!result.ok) {
      error = result.message;
      saving = false;
      return;
    }

    const next = await fetchNextIncompleteHymn(fetch, data.hymnbook.slug);
    saving = false;
    if (next.error) {
      error = next.error;
      return;
    }
    if (!next.hymn) {
      // Acabou o hinário. O Django redireciona pro detalhe com um
      // `messages.info`, mas a SPA não tem flash bag: um redirect aqui
      // engoliria a mensagem. Mostramos a conclusão na própria tela, com o
      // link de volta em destaque.
      finished = true;
      return;
    }
    await goto(`${quickHref}?h=${next.hymn.number}`, { invalidateAll: true });
  }

  /**
   * ⏎ submete, como no monolito. Fica na página (e não nas pílulas) porque é
   * atalho de navegação, não de seleção.
   *
   * Com o foco num campo do form o handler se cala: ali o próprio `<form>` já
   * dispara o submit implícito do HTML, e tratar as duas coisas gravaria
   * duas vezes.
   */
  function handleKeydown(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target instanceof HTMLElement) {
      if (target.isContentEditable) return;
      if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)) return;
    }

    // ←/→ vão pros MESMOS destinos dos links anterior/próximo — o atalho é
    // enfeite por cima de `<a href>` reais, não a única forma de navegar.
    // Sem wrap-around: nas pontas o atalho é mudo, como o link inerte.
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const destination = event.key === "ArrowLeft" ? prevHymn : nextHymn;
      if (!destination) return;
      event.preventDefault();
      void goto(`${quickHref}?h=${destination.number}`, { invalidateAll: true });
      return;
    }

    if (event.key !== "Enter") return;
    event.preventDefault();
    void submit();
  }

  function handleFormSubmit(event: SubmitEvent) {
    event.preventDefault();
    void submit();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<section class="quick-review" data-testid="quick-review-page">
  <header class="topbar">
    <a class="back" href={detailHref}>← {data.hymnbook.name}</a>
    <div class="headline">
      <p class="screen-name">Revisão ágil · Estilo &amp; Repetições</p>
      {#if data.total > 0}
        <p class="position" data-testid="quick-review-position">
          {pad(data.position)} DE {pad(data.total)}
        </p>
      {/if}
    </div>
    {#if data.current}
      <a class="back full-review" href={`/editor/hinos/${data.current.id}/revisar/`} data-testid="quick-review-full">
        Ir para revisão completa →
      </a>
    {/if}
  </header>

  {#if data.total > 0}
    <div
      class="progress"
      role="progressbar"
      aria-label="Progresso da revisão ágil"
      aria-valuenow={data.position}
      aria-valuemin="0"
      aria-valuemax={data.total}
      data-testid="quick-review-progress"
    >
      <div class="progress-fill" style={`width: ${progressPct}%`}></div>
    </div>
  {/if}

  {#if data.hymns.length === 0}
    <div class="panel" data-testid="quick-review-empty">
      <p class="panel-message">Hinário sem hinos para revisar.</p>
      <a class="panel-back" href={detailHref} data-testid="quick-review-empty-back">
        Voltar para o hinário
      </a>
    </div>
  {:else if done}
    <div class="panel" data-testid="quick-review-done">
      <p class="panel-message">
        Você completou estilo e repetições de todos os hinos deste hinário.
      </p>
      <a class="panel-back" href={detailHref} data-testid="quick-review-done-back">
        Voltar para o hinário
      </a>
    </div>
  {:else if data.current}
    <div class="columns">
      <section class="preview" data-testid="quick-review-preview">
        <p class="eyebrow">Prévia · como o leitor vai ver</p>
        <article class="preview-card">
          <h1 class="preview-title" data-testid="quick-review-title">
            {data.current.number} - {data.current.title}
          </h1>
          <HymnBody body={data.current.body} />
        </article>
      </section>

      <form class="params" data-testid="quick-review-form" onsubmit={handleFormSubmit}>
        <div class="params-head">
          <p class="eyebrow">Parâmetros objetivos</p>
          <span class="eyebrow">Atalhos de teclado ativos</span>
        </div>

        <QuickReviewPills
          style={values.style}
          repetitions={values.repetitions}
          shortcutsEnabled={!saving}
          onchange={(next) => (values = next)}
        />

        <p class="disclaimer" data-testid="quick-review-disclaimer">
          <strong>Esta tela não conclui a revisão.</strong>
          Para marcar o hino como revisado é preciso passar pela revisão completa
          (texto + áudio). Pressione <kbd>⏎</kbd> ou clique em "Salvar e ir" para gravar.
        </p>

        {#if error}
          <p class="form-error" role="alert" data-testid="quick-review-error">{error}</p>
        {/if}

        <nav class="steps" aria-label="Navegar entre hinos">
          <a
            class="step"
            href={prevHymn ? `${quickHref}?h=${prevHymn.number}` : undefined}
            aria-disabled={prevHymn ? undefined : "true"}
            data-testid="quick-review-prev"
          >
            <kbd>←</kbd> Anterior
          </a>
          <a
            class="step"
            href={nextHymn ? `${quickHref}?h=${nextHymn.number}` : undefined}
            aria-disabled={nextHymn ? undefined : "true"}
            data-testid="quick-review-next"
          >
            Próximo <kbd>→</kbd>
          </a>
        </nav>

        <button class="submit" type="submit" disabled={saving} data-testid="quick-review-submit">
          {saving ? "Salvando…" : "Salvar e ir para o próximo"}
          <kbd>⏎</kbd>
        </button>
      </form>
    </div>
  {/if}
</section>

<style>
  .quick-review {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .topbar {
    align-items: baseline;
    border-bottom: 1px solid var(--color-border-soft);
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: space-between;
    padding-bottom: 0.75rem;
  }
  .back {
    color: var(--color-text-soft);
    font-family: var(--font-mono, monospace);
    font-size: 0.75rem;
    letter-spacing: 0.12em;
    text-decoration: none;
    text-transform: uppercase;
  }
  .back:hover {
    color: var(--color-accent);
  }
  .screen-name {
    font-family: var(--font-display, serif);
    font-size: 1.25rem;
    margin: 0;
  }
  .eyebrow {
    color: var(--color-text-soft);
    font-family: var(--font-mono, monospace);
    font-size: 0.6875rem;
    letter-spacing: 0.12em;
    margin: 0 0 0.75rem;
    text-transform: uppercase;
  }
  .preview-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border-soft);
    border-radius: 0.75rem;
    padding: 1.5rem;
  }
  .preview-title {
    font-family: var(--font-display, serif);
    font-size: 1.5rem;
    margin: 0 0 1.25rem;
    text-align: center;
  }
  .columns {
    align-items: start;
    display: grid;
    gap: 2rem;
  }
  @media (min-width: 60rem) {
    .columns {
      grid-template-columns: 1fr 1fr;
    }
  }
  .params {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .params-head {
    align-items: baseline;
    display: flex;
    gap: 1rem;
    justify-content: space-between;
  }
  .params-head .eyebrow {
    margin: 0;
  }
  .disclaimer {
    background: var(--color-surface-soft, transparent);
    border: 1px solid var(--color-border-soft);
    border-radius: 0.5rem;
    color: var(--color-text-soft);
    font-size: 0.875rem;
    margin: 0;
    padding: 0.75rem 1rem;
  }
  kbd {
    border: 1px solid currentcolor;
    border-radius: 0.25rem;
    font-family: var(--font-mono, monospace);
    font-size: 0.6875rem;
    opacity: 0.7;
    padding: 0.0625rem 0.3125rem;
  }
  .form-error {
    border: 1px solid var(--color-border-soft);
    border-radius: 0.5rem;
    margin: 0;
    padding: 0.625rem 0.875rem;
  }
  .submit {
    align-items: center;
    background: var(--color-accent);
    border: 0;
    border-radius: var(--radius-pill, 9999px);
    color: var(--color-bg);
    cursor: pointer;
    display: flex;
    font-family: var(--font-sans, sans-serif);
    font-size: 0.875rem;
    gap: 0.5rem;
    justify-content: center;
    padding: 0.75rem 1.25rem;
  }
  .submit[disabled] {
    cursor: progress;
    opacity: 0.6;
  }
  .panel {
    align-items: start;
    background: var(--color-surface);
    border: 1px solid var(--color-border-soft);
    border-radius: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 2rem 1.5rem;
    text-align: center;
  }
  .panel-message {
    font-family: var(--font-display, serif);
    font-size: 1.25rem;
    margin: 0;
  }
  .panel-back {
    background: var(--color-accent);
    border-radius: var(--radius-pill, 9999px);
    color: var(--color-bg);
    font-size: 0.875rem;
    padding: 0.625rem 1.25rem;
    text-decoration: none;
  }
  .position {
    color: var(--color-text-soft);
    font-family: var(--font-mono, monospace);
    font-size: 0.6875rem;
    letter-spacing: 0.12em;
    margin: 0.125rem 0 0;
  }
  .full-review {
    margin-left: auto;
  }
  .progress {
    background: var(--color-border-soft);
    border-radius: 9999px;
    height: 0.25rem;
    overflow: hidden;
  }
  .progress-fill {
    background: var(--color-accent);
    height: 100%;
    max-width: 100%;
  }
  .steps {
    display: grid;
    gap: 0.5rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .step {
    align-items: center;
    border: 1px solid var(--color-border-soft);
    border-radius: var(--radius-pill, 9999px);
    color: var(--color-text-soft);
    display: flex;
    font-size: 0.8125rem;
    gap: 0.375rem;
    justify-content: center;
    padding: 0.5rem 1rem;
    text-decoration: none;
  }
  .step[href]:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
  .step[aria-disabled="true"] {
    opacity: 0.4;
    pointer-events: none;
  }
</style>
