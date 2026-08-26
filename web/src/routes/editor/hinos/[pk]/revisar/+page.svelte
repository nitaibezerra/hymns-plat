<script lang="ts">
  /**
   * Sub-marco 5.C — tela 07 · Revisar hino.
   *
   * Paridade com `templates/hymns/editor/revise_hymn.html`:
   * duas colunas (editor à esquerda, prévia + revisão de áudio à direita) e
   * barra de ações fixa no rodapé.
   *
   * Ciclo 5C.5: formulário com todos os campos de `HymnForm`
   * (`apps/hymns/forms.py`) ligados por `bind:value` a um único objeto
   * `$state` — é ele que o autosave (5C.8) serializa em `HymnUpdateInput`.
   *
   * Divergência documentada: `received_at` aparece somente-leitura porque
   * `HymnUpdateInput` não tem o campo (a view Django também o ignora — não
   * está em `editable_fields`). Enquanto o schema não expuser, editar aqui
   * seria mentira de UI.
   */
  import InlineDiff from "$lib/components/editor/InlineDiff.svelte";
  import OcrConfidenceBar from "$lib/components/editor/OcrConfidenceBar.svelte";

  import type { PageData } from "./$types";
  import type { ReviewStatus } from "./+page";

  let { data }: { data: PageData } = $props();

  const STATUS_OPTIONS: { value: ReviewStatus; label: string; slug: string }[] = [
    { value: "NOT_REVIEWED", label: "Não revisado", slug: "not_reviewed" },
    { value: "IN_REVIEW", label: "Em revisão", slug: "in_review" },
    { value: "REVIEWED", label: "Revisado", slug: "reviewed" },
  ];

  interface FormState {
    number: number;
    title: string;
    text: string;
    repetitions: string;
    style: string;
    offeredTo: string;
    section: string;
    extraInstructions: string;
    reviewStatus: ReviewStatus;
  }

  function seedForm(hymn: PageData["hymn"]): FormState {
    return {
      number: hymn?.number ?? 0,
      title: hymn?.title ?? "",
      text: hymn?.text ?? "",
      repetitions: hymn?.repetitions ?? "",
      style: hymn?.style ?? "",
      offeredTo: hymn?.offeredTo ?? "",
      section: hymn?.section ?? "",
      extraInstructions: hymn?.extraInstructions ?? "",
      reviewStatus: hymn?.reviewStatus ?? "NOT_REVIEWED",
    };
  }

  /**
   * Estado editável do formulário. Semeado direto do load para funcionar em
   * SSR (um `$effect` não roda no servidor), e re-semeado pelo efeito abaixo
   * quando o "Salvar e avançar" navega para outro hino reusando esta mesma
   * instância do componente.
   */
  // svelte-ignore state_referenced_locally
  let form = $state<FormState>(seedForm(data.hymn));
  // svelte-ignore state_referenced_locally
  let seededId: string | null = data.hymn?.id ?? null;

  $effect(() => {
    const id = data.hymn?.id ?? null;
    if (id === seededId) return;
    seededId = id;
    Object.assign(form, seedForm(data.hymn));
  });

  let previewLines = $derived(form.text.split("\n"));
</script>

<section data-testid="revise-hymn">
  {#if data.error}
    <p class="load-error" data-testid="error">Falha ao carregar hino: {data.error}</p>
  {:else if !data.hymn}
    <p class="load-error" data-testid="not-found">Hino não encontrado.</p>
  {:else}
    <header class="revise-header">
      <a class="back-link" href="/editor/hinarios/{data.hymn.hymnBook.slug}">
        ← {data.hymn.hymnBook.name}
      </a>
      <p class="revise-title" data-testid="revise-title">Revisar hino</p>
      <span class="status-pill" data-status={form.reviewStatus}>
        ● {STATUS_OPTIONS.find((option) => option.value === form.reviewStatus)?.label ?? "—"}
      </span>
    </header>

    <div class="revise-grid">
      <!-- ESQUERDA: editor de texto -->
      <section class="editor-pane">
        <p class="eyebrow">Editor · texto</p>

        <div class="title-row">
          <label class="field">
            <span class="eyebrow">Número</span>
            <input class="input-number" type="number" min="1" bind:value={form.number} />
          </label>
          <label class="field field-grow">
            <span class="eyebrow">Título</span>
            <input class="input-title" type="text" bind:value={form.title} />
          </label>
        </div>

        <label class="field">
          <span class="eyebrow">Letra</span>
          <textarea class="input-text" rows="14" bind:value={form.text}></textarea>
        </label>
        <p class="hint">Linha 1 de {previewLines.length} · destaque sincronizado com a prévia →</p>

        <div class="meta-grid">
          <label class="field">
            <span class="eyebrow">Repetições</span>
            <input class="input" type="text" bind:value={form.repetitions} />
          </label>
          <label class="field">
            <span class="eyebrow">Estilo</span>
            <input class="input" type="text" bind:value={form.style} />
          </label>
          <label class="field">
            <span class="eyebrow">Recebido em</span>
            <input
              class="input"
              type="text"
              readonly
              value={data.hymn.receivedAt ?? ""}
              placeholder="—"
              title="Ainda não editável pelo GraphQL (updateHymn não aceita received_at)."
            />
          </label>
          <label class="field">
            <span class="eyebrow">Oferecido para</span>
            <input class="input" type="text" bind:value={form.offeredTo} />
          </label>
          <label class="field">
            <span class="eyebrow">Seção</span>
            <input class="input" type="text" bind:value={form.section} />
          </label>
          <label class="field">
            <span class="eyebrow">Instruções</span>
            <textarea class="input" rows="2" bind:value={form.extraInstructions}></textarea>
          </label>
        </div>

        <fieldset class="status-block">
          <legend class="eyebrow">Status de revisão</legend>
          <div class="status-segmented">
            {#each STATUS_OPTIONS as option (option.value)}
              <label class="status-option" data-status={option.slug}>
                <input type="radio" value={option.value} bind:group={form.reviewStatus} />
                <span>{option.label}</span>
              </label>
            {/each}
          </div>
        </fieldset>
      </section>

      <!-- DIREITA: prévia + diff + OCR -->
      <section class="preview-pane">
        <p class="eyebrow">Prévia · como o leitor vai ver</p>
        <article class="preview-card">
          <h2 class="preview-title" data-testid="preview-title">
            {form.number} - {form.title}
          </h2>
          <div class="preview-body" data-testid="preview-body">
            {#each previewLines as line, index (index)}
              <p class="preview-line">{line}</p>
            {/each}
          </div>
        </article>

        <div class="side-block">
          <p class="eyebrow">Diff vs OCR</p>
          <InlineDiff diff={data.hymn.inlineDiff} />
        </div>

        <div class="side-block">
          <p class="eyebrow">Fidelidade do OCR</p>
          <OcrConfidenceBar confidences={data.hymn.ocrLineConfidences} />
        </div>
      </section>
    </div>
  {/if}
</section>

<style>
  .load-error {
    color: var(--color-status-not);
    font-family: var(--font-serif);
    padding: 2rem 1.5rem;
  }

  .revise-header {
    align-items: baseline;
    border-bottom: 1px solid var(--color-border);
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    justify-content: space-between;
    padding: 0.75rem 1.5rem;
  }

  .back-link {
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .revise-title {
    font-family: var(--font-display);
    font-size: 1.25rem;
  }

  .status-pill {
    border: 1px solid currentcolor;
    border-radius: var(--radius-pill);
    font-size: 0.6875rem;
    letter-spacing: 0.1em;
    padding: 2px 12px;
    text-transform: uppercase;
  }

  .status-pill[data-status="NOT_REVIEWED"] {
    color: var(--color-status-not);
  }

  .status-pill[data-status="IN_REVIEW"] {
    color: var(--color-status-mid);
  }

  .status-pill[data-status="REVIEWED"] {
    color: var(--color-status-ok);
  }

  .revise-grid {
    display: grid;
    gap: 0;
    grid-template-columns: 1fr;
  }

  @media (min-width: 1024px) {
    .revise-grid {
      grid-template-columns: 1fr 1fr;
    }

    .editor-pane {
      border-right: 1px solid var(--color-border);
    }
  }

  .editor-pane,
  .preview-pane {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 2rem 1.5rem;
  }

  .preview-pane {
    background: var(--color-bg-elevated);
  }

  .eyebrow {
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.625rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .field-grow {
    flex: 1;
  }

  .title-row {
    display: flex;
    gap: 0.75rem;
  }

  .input,
  .input-number,
  .input-title,
  .input-text {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text);
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    padding: 0.5rem 0.75rem;
    width: 100%;
  }

  .input-number {
    font-family: var(--font-display);
    font-size: 1.5rem;
    text-align: center;
    width: 88px;
  }

  .input-title {
    font-family: var(--font-display);
    font-size: 1.5rem;
  }

  .input-text {
    font-family: var(--font-serif);
    font-size: 1rem;
    line-height: 1.6;
    resize: vertical;
  }

  .hint {
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.6875rem;
  }

  .meta-grid {
    display: grid;
    gap: 0.75rem 0.75rem;
    grid-template-columns: 1fr 1fr;
  }

  .status-block {
    border: 0;
    margin: 0;
    padding: 0;
  }

  .status-segmented {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    display: grid;
    gap: 0.25rem;
    grid-template-columns: repeat(3, 1fr);
    margin-top: 0.5rem;
    padding: 0.25rem;
  }

  .status-option input {
    height: 1px;
    opacity: 0;
    position: absolute;
    width: 1px;
  }

  .status-option span {
    border-radius: var(--radius-sm);
    color: var(--color-text-soft);
    cursor: pointer;
    display: block;
    font-size: 0.8125rem;
    padding: 0.5rem 0;
    text-align: center;
  }

  .status-option[data-status="not_reviewed"] input:checked + span {
    background: var(--color-status-not);
    color: var(--color-bg);
  }

  .status-option[data-status="in_review"] input:checked + span {
    background: var(--color-status-mid);
    color: var(--color-bg);
  }

  .status-option[data-status="reviewed"] input:checked + span {
    background: var(--color-status-ok);
    color: var(--color-bg);
  }

  .status-option input:focus-visible + span {
    outline: 2px solid var(--color-gold);
    outline-offset: 2px;
  }

  .preview-card {
    background: var(--color-bg);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-2);
    padding: 2rem;
  }

  .preview-title {
    font-family: var(--font-serif);
    font-size: 1.125rem;
    margin-bottom: 1rem;
    text-align: center;
  }

  .preview-body {
    display: inline-grid;
    font-family: var(--font-serif);
    line-height: 1.7;
    width: max-content;
  }

  .preview-line {
    min-height: 1.7em;
    text-align: left;
  }

  .side-block {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
</style>
