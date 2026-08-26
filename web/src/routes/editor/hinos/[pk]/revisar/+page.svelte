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
  import { goto } from "$app/navigation";
  import { AUTOSAVE_DELAY_MS, debounce, formatSavedAt } from "$lib/autosave";
  import InlineDiff from "$lib/components/editor/InlineDiff.svelte";
  import OcrConfidenceBar from "$lib/components/editor/OcrConfidenceBar.svelte";
  import RepetitionPills from "$lib/components/editor/RepetitionPills.svelte";
  import StylePills from "$lib/components/editor/StylePills.svelte";
  import { GRAPHQL_URL } from "$lib/config";
  import { getCsrfTokenFromCookie } from "$lib/graphql/client";
  import { gqlFetch } from "$lib/graphql/fetcher";
  import {
    previewRenderUrl,
    SET_REVIEW_STATUS_MUTATION,
    UPDATE_HYMN_MUTATION,
  } from "$lib/graphql/operations/revise-hymn";

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

  let previewLines = $derived(form.text.split("\n"));

  /* ===== 5C.8 · autosave ===================================================
   *
   * Um `$effect` observa o formulário inteiro; qualquer mudança agenda o
   * `updateHymn` para 2s depois do último toque. Autosave **não redireciona**
   * (é o ponto do ciclo) e só troca o rótulo do rodapé.
   *
   * O gatilho é a comparação com o último snapshot persistido, não um "já
   * montei" — assim o mount nunca dispara mutation e a re-semeadura ao
   * avançar de hino também não.
   *
   * `reviewStatus` não cabe em `HymnUpdateInput`; quando o segmentado muda, o
   * autosave manda um `setReviewStatus` em seguida (a view Django salvava
   * `review_status` no mesmo POST de autosave — mantemos a paridade de
   * comportamento com duas mutations).
   */
  type AutosaveState = "idle" | "pending" | "saving" | "saved" | "error";

  function snapshotOf(value: FormState): string {
    return JSON.stringify([
      value.number,
      value.title,
      value.text,
      value.repetitions,
      value.style,
      value.offeredTo,
      value.section,
      value.extraInstructions,
      value.reviewStatus,
    ]);
  }

  // svelte-ignore state_referenced_locally
  let persistedSnapshot = snapshotOf(form);
  // svelte-ignore state_referenced_locally
  let persistedStatus: ReviewStatus = form.reviewStatus;

  let autosaveState = $state<AutosaveState>("idle");
  let autosaveMessage = $state("");
  let savedLabel = $state("");

  let autosaveLabel = $derived.by(() => {
    if (autosaveState === "pending") return "Alterações não salvas…";
    if (autosaveState === "saving") return "Salvando…";
    if (autosaveState === "error") return autosaveMessage || "Erro ao salvar.";
    if (autosaveState === "saved") return savedLabel;
    return "—";
  });

  function buildUpdateInput() {
    return {
      number: Number(form.number),
      title: form.title,
      text: form.text,
      repetitions: form.repetitions,
      style: form.style,
      offeredTo: form.offeredTo,
      section: form.section,
      extraInstructions: form.extraInstructions,
    };
  }

  interface MutationPayload {
    __typename: string;
    message?: string;
  }

  /**
   * Roda `updateHymn` e, quando o status mudou (ou quando o chamador força um,
   * caso do "Marcar revisado e avançar"), `setReviewStatus`. Devolve `ok`.
   */
  async function persistForm(options: { statusOverride?: ReviewStatus } = {}): Promise<boolean> {
    const hymn = data.hymn;
    if (!hymn) return false;

    const snapshot = snapshotOf(form);
    const status = options.statusOverride ?? form.reviewStatus;
    const forceStatus = options.statusOverride !== undefined;
    autosaveState = "saving";
    autosaveMessage = "";

    try {
      const response = await gqlFetch<{ updateHymn: MutationPayload }>(
        globalThis.fetch,
        GRAPHQL_URL,
        UPDATE_HYMN_MUTATION,
        { pk: hymn.id, input: buildUpdateInput() },
        { csrfToken: getCsrfTokenFromCookie() },
      );
      const payload = response.data?.updateHymn;
      if (response.errors?.length || !payload || payload.__typename !== "HymnType") {
        autosaveState = "error";
        autosaveMessage =
          response.errors?.[0]?.message ?? payload?.message ?? "Não foi possível salvar.";
        return false;
      }

      if (forceStatus || status !== persistedStatus) {
        const statusResponse = await gqlFetch<{ setReviewStatus: MutationPayload }>(
          globalThis.fetch,
          GRAPHQL_URL,
          SET_REVIEW_STATUS_MUTATION,
          { pk: hymn.id, status },
          { csrfToken: getCsrfTokenFromCookie() },
        );
        const statusPayload = statusResponse.data?.setReviewStatus;
        if (
          statusResponse.errors?.length ||
          !statusPayload ||
          statusPayload.__typename !== "HymnType"
        ) {
          autosaveState = "error";
          autosaveMessage =
            statusResponse.errors?.[0]?.message ??
            statusPayload?.message ??
            "Não foi possível salvar o status.";
          return false;
        }
        persistedStatus = status;
      }

      persistedSnapshot = snapshot;
      savedLabel = formatSavedAt(new Date());
      autosaveState = "saved";
      return true;
    } catch {
      autosaveState = "error";
      autosaveMessage = "Falha de rede ao salvar.";
      return false;
    }
  }

  const scheduleAutosave = debounce(() => {
    void persistForm();
  }, AUTOSAVE_DELAY_MS);

  $effect(() => {
    const id = data.hymn?.id ?? null;
    if (id === seededId) return;
    seededId = id;
    scheduleAutosave.cancel();
    const fresh = seedForm(data.hymn);
    persistedSnapshot = snapshotOf(fresh);
    persistedStatus = fresh.reviewStatus;
    autosaveState = "idle";
    autosaveMessage = "";
    savedLabel = "";
    Object.assign(form, fresh);
  });

  $effect(() => {
    const current = snapshotOf(form);
    if (current === persistedSnapshot) return;
    autosaveState = "pending";
    scheduleAutosave();
  });

  $effect(() => () => scheduleAutosave.cancel());

  /* ===== 5C.9 · prévia ao vivo ============================================
   *
   * A prévia não é reimplementada aqui: um POST em `/editor/preview/render/`
   * devolve o HTML do `render_hymn_body` do Django — a mesma fonte que
   * renderiza corrido/carrossel/detalhe, incluindo as barras de repetição.
   *
   * Enquanto a resposta não chega (ou se o endpoint falhar), a prévia cai num
   * render local linha-a-linha, avisado por `preview-fallback-note`.
   */
  const PREVIEW_DELAY_MS = 400;

  let previewHtml = $state<string | null>(null);
  let previewFailed = $state(false);

  async function renderPreview(text: string, repetitions: string) {
    try {
      const response = await globalThis.fetch(previewRenderUrl(GRAPHQL_URL), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(getCsrfTokenFromCookie() ? { "X-CSRFToken": getCsrfTokenFromCookie()! } : {}),
        },
        body: JSON.stringify({ text, repetitions }),
      });
      if (!response.ok) {
        previewFailed = true;
        return;
      }
      const payload = (await response.json()) as { html?: string };
      previewHtml = typeof payload.html === "string" ? payload.html : null;
      previewFailed = false;
    } catch {
      previewFailed = true;
    }
  }

  const schedulePreview = debounce((text: string, repetitions: string) => {
    void renderPreview(text, repetitions);
  }, PREVIEW_DELAY_MS);

  $effect(() => {
    schedulePreview(form.text, form.repetitions);
  });

  $effect(() => () => schedulePreview.cancel());

  /* ===== 5C.10 · Marcar revisado e avançar =================================
   *
   * Espelha `next_action=next` da view Django: salva os campos, força
   * `REVIEWED` (mesmo que o segmentado esteja em outro estado) e navega para
   * `nextPendingHymn`. O wrap-around já vem resolvido pelo resolver — ele
   * exclui o hino atual e cai no primeiro pendente quando não há um com
   * `number` maior. Sem pendentes, volta pro hinário, como o Django.
   */
  let isSubmitting = $state(false);

  async function saveAndAdvance() {
    const hymn = data.hymn;
    if (!hymn || isSubmitting) return;

    scheduleAutosave.cancel();
    isSubmitting = true;
    form.reviewStatus = "REVIEWED";
    const ok = await persistForm({ statusOverride: "REVIEWED" });
    isSubmitting = false;
    scheduleAutosave.cancel();
    if (!ok) return;

    const next = hymn.hymnBook.nextPendingHymn;
    await goto(
      next ? `/editor/hinos/${next.id}/revisar` : `/editor/hinarios/${hymn.hymnBook.slug}`,
    );
  }

  /**
   * 5C.11 — "Salvar rascunho" (`next_action=back` no Django): grava os campos
   * e volta pro hinário sem tocar no `review_status`.
   */
  async function saveAndBack() {
    const hymn = data.hymn;
    if (!hymn || isSubmitting) return;

    scheduleAutosave.cancel();
    isSubmitting = true;
    const ok = await persistForm();
    isSubmitting = false;
    scheduleAutosave.cancel();
    if (!ok) return;

    await goto(`/editor/hinarios/${hymn.hymnBook.slug}`);
  }
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
          <div class="field">
            <label class="field">
              <span class="eyebrow">Repetições</span>
              <input class="input input-mono" type="text" bind:value={form.repetitions} />
            </label>
            <RepetitionPills
              bind:value={form.repetitions}
              suggestions={data.hymn.commonRepetitions}
            />
          </div>
          <div class="field">
            <label class="field">
              <span class="eyebrow">Estilo</span>
              <input class="input" type="text" bind:value={form.style} />
            </label>
            <StylePills bind:value={form.style} suggestions={data.hymn.commonStyles} />
          </div>
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
            {#if previewHtml !== null}
              <!-- HTML vem do próprio backend Django (`render_hymn_body`), que
                   já escapa o texto do hino — é a fonte única do markup. -->
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html previewHtml}
            {:else}
              {#each previewLines as line, index (index)}
                <p class="preview-line">{line}</p>
              {/each}
            {/if}
          </div>
        </article>
        {#if previewHtml === null}
          <p class="preview-note" data-testid="preview-fallback-note">
            {previewFailed
              ? "Prévia simplificada (sem conexão com o servidor)."
              : "Prévia simplificada · aguardando renderização do servidor."}
          </p>
        {/if}

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

    <footer class="action-bar">
      <a class="btn-ghost" href="/editor/hinarios/{data.hymn.hymnBook.slug}">← Voltar</a>
      <span class="autosave-status" data-testid="autosave-status" data-state={autosaveState}>
        {autosaveLabel}
      </span>
      <button
        class="btn-ghost"
        type="button"
        data-testid="save-and-back"
        disabled={isSubmitting}
        onclick={saveAndBack}
      >
        Salvar rascunho
      </button>
      <button
        class="btn-primary"
        type="button"
        data-testid="save-and-advance"
        disabled={isSubmitting}
        onclick={saveAndAdvance}
      >
        Marcar revisado e avançar
      </button>
    </footer>
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

  .input-mono {
    font-family: var(--font-mono);
    font-size: 0.875rem;
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

  .preview-note {
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.6875rem;
  }

  .side-block {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .action-bar {
    align-items: center;
    background: var(--color-bg);
    border-top: 1px solid var(--color-border);
    bottom: 0;
    box-shadow: 0 -8px 20px var(--color-shadow);
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding: 0.875rem 1.5rem;
    position: sticky;
    z-index: 10;
  }

  .btn-ghost {
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-soft);
    cursor: pointer;
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    padding: 0.5rem 0.875rem;
  }

  .btn-ghost:hover {
    border-color: var(--color-gold);
  }

  .btn-primary {
    background: var(--color-accent);
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-md);
    color: var(--color-bg);
    cursor: pointer;
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    font-weight: 500;
    padding: 0.5rem 1rem;
  }

  .btn-primary:disabled {
    cursor: progress;
    opacity: 0.6;
  }

  .autosave-status {
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    letter-spacing: 0.06em;
    margin-left: auto;
  }

  .autosave-status[data-state="error"] {
    color: var(--color-status-not);
  }

  .autosave-status[data-state="saved"] {
    color: var(--color-status-ok);
  }
</style>
