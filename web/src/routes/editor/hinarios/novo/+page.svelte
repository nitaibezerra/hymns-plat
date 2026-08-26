<script lang="ts">
  /**
   * Sub-marco 5.D — Ciclos 5D.1 e 5D.2.
   *
   * `/editor/hinarios/novo/` — form de criação de hinário.
   *
   * O tipo do `data` é declarado localmente (e não via `PageData` de
   * `./$types`) porque `/editor/+layout.ts` pertence a outra frente: derivar
   * de `PageData` acoplaria esta rota ao shape do layout do vizinho e
   * quebraria os testes no merge.
   */
  import HymnBookFormView from "$lib/components/editor/HymnBookFormView.svelte";
  import type { HymnBookFormSubmit } from "$lib/components/editor/HymnBookFormView.svelte";

  import type { NovoHymnBookData } from "./+page";

  let { data }: { data: NovoHymnBookData } = $props();

  let submitting = $state(false);
  let error = $state<string | null>(null);

  async function handleSubmit(_payload: HymnBookFormSubmit) {
    // 5D.2 implementa a mutation.
    submitting = false;
  }
</script>

<section class="editor-page" data-testid="hymnbook-novo">
  <nav class="breadcrumb">
    <a href="/editor/">← Workspace editorial</a>
  </nav>

  {#if data.forbidden}
    <p data-testid="editor-forbidden">
      Você não tem acesso ao workspace do editor.
    </p>
  {:else}
    <header>
      <p class="label-mono">Workspace editorial</p>
      <h1>Novo hinário</h1>
    </header>

    <HymnBookFormView
      submitLabel="Criar"
      {submitting}
      error={error ?? data.error}
      cancelHref="/editor/"
      onsubmit={handleSubmit}
    />
  {/if}
</section>

<style>
  .editor-page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .label-mono {
    font-family: var(--font-sans);
    font-size: 0.6875rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
</style>
