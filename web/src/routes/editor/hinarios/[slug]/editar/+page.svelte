<script lang="ts">
  /**
   * Sub-marco 5.D — Ciclos 5D.3 e 5D.4.
   *
   * `/editor/hinarios/[slug]/editar/` — form de edição pré-populado.
   *
   * O tipo do `data` é local (e não `PageData` de `./$types`) porque
   * `/editor/+layout.ts` é de outra frente.
   */
  import HymnBookFormView from "$lib/components/editor/HymnBookFormView.svelte";

  import type { EditarHymnBookData } from "./+page";

  let { data }: { data: EditarHymnBookData } = $props();

  let error = $state<string | null>(null);

  const initial = $derived({
    name: data.hymnbook?.name ?? "",
    introName: data.hymnbook?.introName ?? "",
    ownerName: data.hymnbook?.ownerName ?? "",
    description: data.hymnbook?.description ?? "",
  });
</script>

<section class="editor-page" data-testid="hymnbook-editar">
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
      <h1>Editar: {data.hymnbook.name}</h1>
    </header>

    <HymnBookFormView
      {initial}
      submitLabel="Salvar"
      error={error ?? data.error}
      coverUrl={data.hymnbook.coverImage}
      cancelHref="/editor/hinarios/{data.slug}/"
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
