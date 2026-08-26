<script module lang="ts">
  /**
   * Constantes espelhadas de `apps/hymns/models.py`:
   * `HymnAudio.QUALITY_OBSERVATIONS` e `HymnAudio.MismatchReason.choices`.
   * O schema GraphQL não expõe nenhuma das duas listas; `AudioReviewDrawer.test.ts`
   * é o que pina os valores.
   */
  export const QUALITY_OBSERVATIONS = [
    "Ruído de fundo",
    "Voz baixa",
    "Cortes",
    "Excelente captação",
    "Mestre de cerimônias",
  ] as const;

  export const MISMATCH_REASONS = [
    { value: "other_hymn", label: "É outro hino" },
    { value: "incomplete", label: "Áudio cortado/incompleto" },
    { value: "wrong_lyrics", label: "Letra diferente" },
    { value: "inaudible", label: "Áudio inaudível" },
    { value: "other", label: "Outro" },
  ] as const;

  export interface AudioReviewTarget {
    id: string;
    url: string;
    title: string;
    waveformPeaks: number[];
    durationSeconds: number | null;
    isApproved: boolean;
    isMatch: boolean | null;
    qualityRating: number | null;
    qualityObservations: string[];
    mismatchReason: string;
  }
</script>

<script lang="ts">
  /**
   * Sub-marco 5.C — Ciclo 5C.13.
   *
   * Drawer de revisão de áudio, porte de `templates/hymns/editor/_audio_review.html`.
   *
   * O player não é reimplementado: `PlayButton` empurra a faixa pro player
   * global do shell (mesma escolha do `HymnAudioList`), então o áudio
   * sobrevive à navegação "Salvar e avançar".
   *
   * Nota importante do backend: `reviewAudio` **não** seta `is_approved=True`
   * (decisão deliberada, pinada por teste no backend). A UI diz isso em vez
   * de prometer aprovação.
   */
  import PlayButton from "$lib/components/PlayButton.svelte";
  import { GRAPHQL_URL } from "$lib/config";
  import { getCsrfTokenFromCookie } from "$lib/graphql/client";
  import { gqlFetch } from "$lib/graphql/fetcher";
  import { REVIEW_AUDIO_MUTATION } from "$lib/graphql/operations/revise-hymn";
  import type { AudioTrack } from "$lib/stores/audio";

  let {
    audio = null,
    hymnTitle = "",
    hymnNumber,
    open = $bindable(false),
    onreviewed,
  }: {
    audio?: AudioReviewTarget | null;
    hymnTitle?: string;
    hymnNumber?: number;
    open?: boolean;
    /** Avisa a tela para refletir a decisão salva sem recarregar o load. */
    onreviewed?: (audio: ReviewedAudio) => void;
  } = $props();

  interface ReviewedAudio {
    __typename: string;
    id: string;
    isMatch: boolean | null;
    qualityRating: number | null;
    qualityObservations: string[];
    mismatchReason: string;
    isApproved: boolean;
    message?: string;
  }

  let isMatch = $state<boolean | null>(null);
  let rating = $state<number | null>(null);
  let observations = $state<string[]>([]);
  let mismatchReason = $state("");

  let seededAudioId: string | null = null;

  $effect(() => {
    const id = audio?.id ?? null;
    if (id === seededAudioId) return;
    seededAudioId = id;
    isMatch = audio?.isMatch ?? null;
    rating = audio?.qualityRating ?? null;
    observations = [...(audio?.qualityObservations ?? [])];
    mismatchReason = audio?.mismatchReason ?? "";
  });

  let track = $derived<AudioTrack>({
    id: audio?.id ?? "",
    url: audio?.url ?? "",
    title: hymnTitle,
    hymnNumber,
    waveformPeaks: audio?.waveformPeaks ?? [],
    durationSeconds: audio?.durationSeconds ?? null,
  });

  function formatDuration(seconds: number | null | undefined): string {
    if (seconds == null) return "—";
    const total = Math.round(seconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  /** 5C.14 — divergência inutiliza a avaliação de qualidade. */
  let qualityDisabled = $derived(isMatch === false);

  function toggleObservation(value: string) {
    observations = observations.includes(value)
      ? observations.filter((item) => item !== value)
      : [...observations, value];
  }

  function close() {
    open = false;
  }

  /* ===== 5C.15 · submit ====================================================
   *
   * `reviewAudio` aceita a decisão parcial; quando o áudio é sinalizado como
   * divergente, mandamos a vertente de qualidade zerada — é o que o
   * `HymnAudio.save()` faria de todo jeito ("zera os campos da vertente
   * oposta"), e deixar valores velhos viajando só criaria confusão.
   */
  let isSaving = $state(false);
  let submitError = $state("");

  let canSubmit = $derived(audio !== null && isMatch !== null && !isSaving);

  function buildReviewInput() {
    if (isMatch === false) {
      return {
        isMatch: false,
        qualityRating: null,
        qualityObservations: [],
        mismatchReason,
      };
    }
    return {
      isMatch: true,
      qualityRating: rating,
      qualityObservations: [...observations],
      mismatchReason: "",
    };
  }

  async function submit() {
    if (!audio || isMatch === null || isSaving) return;
    isSaving = true;
    submitError = "";
    try {
      const response = await gqlFetch<{ reviewAudio: ReviewedAudio }>(
        globalThis.fetch,
        GRAPHQL_URL,
        REVIEW_AUDIO_MUTATION,
        { pk: audio.id, input: buildReviewInput() },
        { csrfToken: getCsrfTokenFromCookie() },
      );
      const payload = response.data?.reviewAudio;
      if (response.errors?.length || !payload || payload.__typename !== "HymnAudioType") {
        submitError =
          response.errors?.[0]?.message ?? payload?.message ?? "Não foi possível salvar a revisão.";
        return;
      }
      onreviewed?.(payload);
      close();
    } catch {
      submitError = "Falha de rede ao salvar a revisão.";
    } finally {
      isSaving = false;
    }
  }
</script>

{#if open}
  <section class="audio-review" data-testid="audio-review-drawer">
    {#if !audio}
      <p class="audio-empty" data-testid="audio-review-empty">Sem gravação para este hino.</p>
    {:else}
      <header class="drawer-header">
        <p class="eyebrow">Revisão de áudio</p>
        <span class="file-label" data-testid="audio-file-label">
          arquivo · {audio.title || "sem título"} · {formatDuration(audio.durationSeconds)}
        </span>
        <button
          class="close-btn"
          type="button"
          aria-label="Fechar revisão de áudio"
          onclick={close}
        >
          ✕
        </button>
      </header>

      <div class="player-row">
        <PlayButton {track} label="Tocar gravação de" />
      </div>

      <div class="match-question">
        <div>
          <p class="match-title" data-testid="match-question">
            É mesmo a gravação de "{hymnTitle}"?
          </p>
          <p class="match-help">Confirma se o áudio corresponde ao hino e à letra acima.</p>
        </div>
        <div class="yesno">
          <button
            class="yesno-btn is-yes"
            type="button"
            data-testid="audio-match-yes"
            aria-pressed={isMatch === true}
            onclick={() => (isMatch = true)}
          >
            ✓ Confere
          </button>
          <button
            class="yesno-btn is-no"
            type="button"
            data-testid="audio-match-no"
            aria-pressed={isMatch === false}
            onclick={() => (isMatch = false)}
          >
            ✗ Não confere
          </button>
        </div>
      </div>

      <!-- 5C.14 — divergência desabilita o bloco de qualidade inteiro. O
           template Django *esconde* o bloco; aqui ele fica visível e inerte,
           que é o comportamento pedido pelo ciclo (o editor continua vendo o
           que havia avaliado antes de sinalizar a divergência). -->
      <fieldset class="quality-block" disabled={isMatch === false}>
        <p class="block-title">Qualidade da gravação</p>
        <p class="block-help">Ajuda a priorizar uploads melhores no futuro.</p>
        <div class="stars">
          {#each [1, 2, 3, 4, 5] as value (value)}
            <button
              class="star"
              type="button"
              data-testid="quality-star"
              data-rating={value}
              data-active={rating !== null && value <= rating ? "true" : "false"}
              aria-pressed={rating !== null && value <= rating}
              disabled={qualityDisabled}
              onclick={() => (rating = rating === value ? null : value)}
            >
              {value}
            </button>
          {/each}
        </div>
        <span class="eyebrow">Observações</span>
        <div class="chips">
          {#each QUALITY_OBSERVATIONS as observation (observation)}
            <button
              class="chip"
              type="button"
              data-testid="observation-chip"
              data-active={observations.includes(observation) ? "true" : "false"}
              aria-pressed={observations.includes(observation)}
              disabled={qualityDisabled}
              onclick={() => toggleObservation(observation)}
            >
              {observation}
            </button>
          {/each}
        </div>
      </fieldset>

      {#if isMatch === false}
        <div class="mismatch-block" data-testid="mismatch-block">
          <p class="block-title">
            <strong>Áudio sinalizado.</strong> Vai para a fila de revisão de moderador. Marque o
            motivo:
          </p>
          <div class="chips">
            {#each MISMATCH_REASONS as reason (reason.value)}
              <button
                class="chip"
                type="button"
                data-testid="mismatch-chip"
                data-value={reason.value}
                data-active={mismatchReason === reason.value ? "true" : "false"}
                aria-pressed={mismatchReason === reason.value}
                onclick={() =>
                  (mismatchReason = mismatchReason === reason.value ? "" : reason.value)}
              >
                {reason.label}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <p class="audio-note" data-testid="audio-review-note">
        Registrar a revisão não aprova o áudio — a aprovação é um passo separado.
      </p>

      {#if submitError}
        <p class="audio-error" data-testid="audio-review-error">{submitError}</p>
      {/if}

      <div class="drawer-actions">
        <button class="btn-ghost" type="button" onclick={close}>Cancelar</button>
        <button
          class="btn-primary"
          type="button"
          data-testid="audio-review-submit"
          disabled={!canSubmit}
          onclick={submit}
        >
          {isSaving ? "Salvando…" : "Registrar revisão do áudio"}
        </button>
      </div>
    {/if}
  </section>
{/if}

<style>
  .audio-review {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    padding: 1.25rem;
  }

  .drawer-header {
    align-items: baseline;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: space-between;
  }

  .eyebrow {
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.625rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .file-label {
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.6875rem;
  }

  .close-btn {
    background: transparent;
    border: 0;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 0.875rem;
  }

  .match-question {
    align-items: center;
    border-top: 1px solid var(--color-border-soft);
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: space-between;
    padding-top: 0.875rem;
  }

  .match-title {
    font-family: var(--font-serif);
    font-size: 0.9375rem;
  }

  .match-help,
  .block-help {
    color: var(--color-text-muted);
    font-size: 0.75rem;
  }

  .block-title {
    font-family: var(--font-sans);
    font-size: 0.875rem;
    font-weight: 500;
  }

  .yesno {
    display: flex;
    gap: 0.5rem;
  }

  .yesno-btn {
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    padding: 0.375rem 0.75rem;
  }

  .yesno-btn.is-yes[aria-pressed="true"] {
    background: var(--color-status-ok);
    border-color: var(--color-status-ok);
    color: var(--color-bg);
  }

  .yesno-btn.is-no[aria-pressed="true"] {
    background: var(--color-status-not);
    border-color: var(--color-status-not);
    color: var(--color-bg);
  }

  .quality-block,
  .mismatch-block {
    border: 0;
    border-top: 1px solid var(--color-border-soft);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0;
    padding: 0.875rem 0 0;
  }

  .quality-block:disabled {
    opacity: 0.45;
  }

  .stars {
    display: flex;
    gap: 0.25rem;
  }

  .star {
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    height: 28px;
    width: 28px;
  }

  .star[data-active="true"] {
    background: var(--color-gold);
    border-color: var(--color-gold);
    color: var(--color-bg);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .chip {
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-pill);
    color: var(--color-text-soft);
    cursor: pointer;
    font-family: var(--font-sans);
    font-size: 0.75rem;
    padding: 3px 11px;
  }

  .chip[data-active="true"] {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: var(--color-bg);
  }

  .audio-empty,
  .audio-note {
    color: var(--color-text-muted);
    font-size: 0.75rem;
  }

  .audio-empty {
    font-family: var(--font-serif);
    font-style: italic;
  }

  .audio-error {
    color: var(--color-status-not);
    font-size: 0.75rem;
  }

  .drawer-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
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
    cursor: not-allowed;
    opacity: 0.5;
  }
</style>
