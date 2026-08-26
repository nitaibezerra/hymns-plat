<script lang="ts">
  /**
   * Sub-marco 5.D — Ciclo 5D.10.
   *
   * `/editor/hinos/[pk]/editar/` — form de edição de hino.
   *
   * O tipo do `data` é local porque `/editor/+layout.ts` é de outra frente.
   */
  import { goto } from "$app/navigation";
  import HymnFormView from "$lib/components/editor/HymnFormView.svelte";
  import type { HymnFormValues } from "$lib/components/editor/HymnFormView.svelte";
  import { updateHymn } from "$lib/graphql/operations/crud";

  import type { EditarHymnData } from "./+page";

  let { data }: { data: EditarHymnData } = $props();

  let submitting = $state(false);
  let error = $state<string | null>(null);

  const initial = $derived({
    number: data.hymn?.number ?? 1,
    title: data.hymn?.title ?? "",
    // `body` é a letra (== `hymn.text` no resolver); volta como `input.text`.
    text: data.hymn?.body ?? "",
    style: data.hymn?.style ?? "",
    repetitions: data.hymn?.repetitions ?? "",
    extraInstructions: data.hymn?.extraInstructions ?? "",
    offeredTo: data.hymn?.offeredTo ?? "",
    section: data.hymn?.section ?? "",
  });

  async function handleSubmit(values: HymnFormValues) {
    submitting = true;
    error = null;
    const result = await updateHymn(fetch, data.pk, values);
    submitting = false;
    if (result.ok) {
      // Paridade com `hymn_edit_view`: volta pro detalhe do hino.
      await goto(`/hinos/${data.pk}`);
      return;
    }
    error = result.message;
  }
</script>

<section class="editor-page" data-testid="hymn-editar">
  {#if data.forbidden}
    <p data-testid="editor-forbidden">
      Você não tem acesso ao workspace do editor.
    </p>
  {:else if !data.hymn}
    <p data-testid="hymn-not-found">Hino não encontrado.</p>
  {:else}
    <nav class="breadcrumb">
      <a href="/editor/hinarios/{data.hymn.hymnBook.slug}/">
        ← {data.hymn.hymnBook.name}
      </a>
    </nav>

    <header>
      <p class="label-mono">Workspace editorial</p>
      <h1>Editar hino #{data.hymn.number}</h1>
    </header>

    <HymnFormView
      {initial}
      submitLabel="Salvar"
      {submitting}
      error={error ?? data.error}
      cancelHref="/hinos/{data.pk}"
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
