<script lang="ts">
  /**
   * Sub-marco 5.D — Ciclos 5D.8 e 5D.9.
   *
   * `/editor/hinarios/[slug]/hinos/novo/` — form de criação de hino dentro do
   * hinário. O tipo do `data` é local porque `/editor/+layout.ts` é de outra
   * frente.
   */
  import { goto } from "$app/navigation";
  import HymnFormView from "$lib/components/editor/HymnFormView.svelte";
  import type { HymnFormValues } from "$lib/components/editor/HymnFormView.svelte";
  import { createHymn } from "$lib/graphql/operations/crud";

  import type { NovoHymnData } from "./+page";

  let { data }: { data: NovoHymnData } = $props();

  let submitting = $state(false);
  let error = $state<string | null>(null);

  const initial = $derived({
    number: data.suggestedNumber,
    title: "",
    text: "",
    style: "",
    repetitions: "",
    extraInstructions: "",
    offeredTo: "",
    section: "",
  });

  async function handleSubmit(values: HymnFormValues) {
    submitting = true;
    error = null;
    const result = await createHymn(fetch, data.slug, values);
    submitting = false;
    if (result.ok && result.data) {
      // Paridade com `hymn_create_view`: vai pro detalhe do hino criado.
      await goto(`/hinos/${result.data.id}`);
      return;
    }
    error = result.message;
  }
</script>

<section class="editor-page" data-testid="hymn-novo">
  <nav class="breadcrumb">
    <a href="/editor/hinarios/{data.slug}/">← Voltar ao hinário</a>
  </nav>

  {#if data.forbidden}
    <p data-testid="editor-forbidden">
      Você não tem acesso ao workspace do editor.
    </p>
  {:else if !data.hymnbook}
    <p data-testid="hymnbook-not-found">Hinário não encontrado.</p>
  {:else}
    <header>
      <p class="label-mono">Workspace editorial</p>
      <h1>Novo hino em {data.hymnbook.name}</h1>
    </header>

    <HymnFormView
      {initial}
      submitLabel="Criar"
      {submitting}
      error={error ?? data.error}
      cancelHref="/editor/hinarios/{data.slug}/"
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
