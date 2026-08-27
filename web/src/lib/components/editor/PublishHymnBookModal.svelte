<script lang="ts">
  /**
   * Sub-marco 5.D — Ciclos 5D.6 e 5D.7.
   *
   * Modal de publicação/despublicação do hinário.
   *
   * 5D.6 — ao abrir no modo "publicar", consulta `Query.publishReadiness` e
   * desenha o checklist. O botão respeita `canPublish` do backend: nenhuma
   * regra de prontidão é reimplementada aqui (a autoridade é
   * `apps/hymns/services/review.py::publish_readiness`).
   *
   * No modo "despublicar" não existe checklist — o `hymnbook_unpublish_view`
   * do Django também não checa nada além de permissão.
   */
  import {
    fetchPublishReadiness,
    publishHymnBook,
    unpublishHymnBook,
  } from "$lib/graphql/operations/crud";
  import type { PublishReadiness } from "$lib/graphql/operations/crud";

  export interface PublishableHymnBook {
    name: string;
    slug: string;
    isPublished: boolean;
  }

  let {
    open = false,
    hymnbook,
    onchanged,
    onclose,
  }: {
    open?: boolean;
    hymnbook: PublishableHymnBook;
    onchanged?: () => void;
    onclose?: () => void;
  } = $props();

  let readiness = $state<PublishReadiness | null>(null);
  let loading = $state(false);
  let readinessError = $state<string | null>(null);
  /** Slug já carregado, pra não refazer a query a cada re-render. */
  let loadedFor = $state<string | null>(null);

  const isUnpublishing = $derived(hymnbook.isPublished);

  $effect(() => {
    if (!open || isUnpublishing) return;
    if (loadedFor === hymnbook.slug) return;
    loadedFor = hymnbook.slug;
    void loadReadiness(hymnbook.slug);
  });

  async function loadReadiness(slug: string) {
    loading = true;
    readinessError = null;
    const result = await fetchPublishReadiness(fetch, slug);
    loading = false;
    readiness = result.readiness;
    readinessError = result.error;
  }

  let submitting = $state(false);
  let submitError = $state<string | null>(null);

  const canSubmit = $derived(
    submitting
      ? false
      : isUnpublishing
        ? true
        : !loading && readiness !== null && readiness.canPublish,
  );

  async function handleSubmit() {
    if (!canSubmit) return;
    submitting = true;
    submitError = null;
    const result = isUnpublishing
      ? await unpublishHymnBook(fetch, hymnbook.slug)
      : await publishHymnBook(fetch, hymnbook.slug);
    submitting = false;
    if (result.ok) {
      onchanged?.();
      return;
    }
    submitError = result.message;
  }
</script>

{#if open}
  <div
    class="modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="publish-hb-title"
    data-testid="publish-hymnbook-modal"
  >
    <h2 id="publish-hb-title" class="modal-title">
      {isUnpublishing ? "Despublicar hinário" : "Publicar hinário"}
    </h2>

    {#if isUnpublishing}
      <p>
        <strong>{hymnbook.name}</strong> volta a ficar visível apenas para
        editores. Você pode publicar de novo depois.
      </p>
    {:else}
      <p>
        Confira as pendências antes de publicar <strong>{hymnbook.name}</strong>.
      </p>

      {#if loading}
        <p data-testid="readiness-loading">Carregando checklist…</p>
      {/if}

      {#if readinessError}
        <p class="modal-error" role="alert" data-testid="readiness-error">{readinessError}</p>
      {/if}

      {#if readiness}
        <ul class="checks">
          {#each readiness.checks as check (check.key)}
            <li class="check" data-testid="readiness-check" data-ok={check.ok}>
              <span class="check-mark" aria-hidden="true">{check.ok ? "✓" : "✗"}</span>
              <span>{check.label}</span>
              <span class="sr-only">{check.ok ? "cumprido" : "pendente"}</span>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}

    {#if submitError}
      <p class="modal-error" role="alert" data-testid="publish-error">{submitError}</p>
    {/if}

    <div class="actions">
      <button
        type="button"
        disabled={!canSubmit}
        onclick={handleSubmit}
        data-testid="confirm-publish"
      >
        {#if submitting}
          {isUnpublishing ? "Despublicando…" : "Publicando…"}
        {:else}
          {isUnpublishing ? "Despublicar" : "Publicar"}
        {/if}
      </button>
      <button type="button" onclick={() => onclose?.()} data-testid="cancel-publish">
        Cancelar
      </button>
    </div>
  </div>
{/if}

<style>
  .modal {
    background: var(--color-surface);
    border: 1px solid var(--color-border-soft);
    border-radius: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    max-width: 32rem;
    padding: 1.25rem;
  }
  .modal-title {
    font-family: var(--font-display);
    font-size: 1.375rem;
    margin: 0;
  }
  .checks {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .check {
    align-items: center;
    display: flex;
    gap: 0.5rem;
  }
  .check-mark {
    font-variant-numeric: tabular-nums;
    width: 1rem;
  }
  .check[data-ok="false"] {
    font-weight: 600;
  }
  .sr-only {
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    height: 1px;
    overflow: hidden;
    position: absolute;
    white-space: nowrap;
    width: 1px;
  }
  .actions {
    display: flex;
    gap: 0.75rem;
  }
</style>
