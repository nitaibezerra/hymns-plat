<script lang="ts">
  /**
   * Marco 4.E — detalhe de hino individual.
   *
   * Cobre os ciclos 4E.1..4E.6:
   *   - 4E.2: usa `HymnBody` pra renderizar a letra, vinda de
   *           `HymnType.body` (pedido pela HYMN_DETAIL_QUERY).
   *   - 4E.3: links "anterior/próximo no hinário" como `<a href="/hinos/<id>">`,
   *           omitidos quando o respectivo campo é null.
   *   - 4E.4: `SiblingHymnsList` pra disambiguação "este número aparece em…".
   *   - 4E.5: `HymnAudioList` pros áudios aprovados.
   *   - 4E.6: o componente de áudios mostra pendentes pro uploader/editor
   *           (gating via props `currentUser` do layout data + `isEditor`
   *           calculado na load function, que também é quem pede
   *           `approvedOnly: false` ao backend).
   *
   * `currentUser` é repassado do `+layout.ts` via `$page.data` — buscamos
   * pelo `$app/state`/`page` store. Pra manter teste/componente simples e
   * desacoplado do store, lemos o `currentUser` do `data` do próprio page
   * via fallback no `HymnAudioList`.
   */
  import HymnBody from "$lib/components/HymnBody.svelte";
  import HymnAudioList from "$lib/components/HymnAudioList.svelte";
  import SiblingHymnsList from "$lib/components/SiblingHymnsList.svelte";
  import AudioUploadDrawer from "$lib/components/editor/AudioUploadDrawer.svelte";
  import { invalidateAll } from "$app/navigation";

  import type { PageData } from "./$types";
  import type { LayoutUser } from "../../+layout";

  let { data }: { data: PageData } = $props();

  /**
   * Sub-marco 5.E — Ciclo 5E.6.
   *
   * Envio de gravação sem sair do detalhe do hino. Reusa o
   * `AudioUploadDrawer` do 5.D: ele não navega nem recarrega lista nenhuma —
   * avisa `onuploaded` e quem embute decide. Aqui a decisão é fechar o drawer
   * e invalidar a rota, pro áudio recém-enviado aparecer na lista (como
   * pendente, até a aprovação).
   */
  let uploadOpen = $state(false);
</script>

<section class="hymn-detail" data-testid="hymn-detail">
  {#if data.error}
    <p data-testid="error">Falha ao carregar hino: {data.error}</p>
  {:else if !data.hymn}
    <p data-testid="hymn-not-found">Hino não encontrado.</p>
  {:else}
    <nav class="hymn-nav" aria-label="Navegação entre hinos">
      {#if data.hymn.previousInBook}
        <a
          class="nav-link nav-link-prev"
          data-testid="nav-prev"
          href={`/hinos/${data.hymn.previousInBook.id}`}
          aria-label={`Hino anterior: ${data.hymn.previousInBook.number} ${data.hymn.previousInBook.title}`}
        >
          ← Anterior · {String(data.hymn.previousInBook.number).padStart(2, "0")}
        </a>
      {/if}
      {#if data.hymn.nextInBook}
        <a
          class="nav-link nav-link-next"
          data-testid="nav-next"
          href={`/hinos/${data.hymn.nextInBook.id}`}
          aria-label={`Próximo hino: ${data.hymn.nextInBook.number} ${data.hymn.nextInBook.title}`}
        >
          {String(data.hymn.nextInBook.number).padStart(2, "0")} · Próximo →
        </a>
      {/if}
    </nav>

    <article class="hymn-card">
      <h1 class="hymn-title" data-testid="hymn-title">
        {data.hymn.number} — {data.hymn.title}
      </h1>
      <HymnBody body={data.hymn.body} />
    </article>

    {#if data.hymn.siblingsWithSameNumber.length > 0}
      <SiblingHymnsList siblings={data.hymn.siblingsWithSameNumber} />
    {/if}

    {#if data.hymn.audios.length > 0}
      <HymnAudioList
        audios={data.hymn.audios}
        hymnTitle={data.hymn.title}
        hymnNumber={data.hymn.number}
        currentUser={(data.currentUser as LayoutUser | null) ?? null}
        isEditor={data.isEditor}
      />
    {/if}

    {#if data.isEditor}
      <section class="editor-actions">
        {#if uploadOpen}
          <AudioUploadDrawer
            open
            hymn={{ id: data.hymn.id, number: data.hymn.number, title: data.hymn.title }}
            onuploaded={() => {
              uploadOpen = false;
              void invalidateAll();
            }}
            onclose={() => (uploadOpen = false)}
          />
        {:else}
          <button
            type="button"
            class="upload-btn"
            data-testid="upload-audio-btn"
            onclick={() => (uploadOpen = true)}
          >
            Enviar gravação
          </button>
        {/if}
      </section>
    {/if}
  {/if}
</section>

<style>
  .hymn-detail {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .hymn-nav {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    font-size: 0.875rem;
  }
  .nav-link {
    color: var(--color-accent);
    text-decoration: none;
    padding: 0.5rem 1rem;
    border: 1px solid var(--color-border-soft);
    border-radius: 999px;
  }
  .nav-link:hover {
    background: var(--color-surface-soft);
  }
  .nav-link-next {
    margin-left: auto;
  }
  .hymn-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border-soft);
    border-radius: 0.75rem;
    padding: 2rem 1.5rem;
  }
  .hymn-title {
    font-family: var(--font-display);
    font-size: 1.875rem;
    text-align: center;
    margin: 0 0 1.5rem 0;
  }
  .editor-actions {
    display: flex;
    flex-direction: column;
  }
  .upload-btn {
    align-self: flex-start;
    background: transparent;
    border: 1px solid var(--color-border-soft);
    border-radius: 999px;
    color: var(--color-accent);
    cursor: pointer;
    font-family: var(--font-sans);
    font-size: 0.875rem;
    padding: 0.5rem 1rem;
  }
  .upload-btn:hover {
    background: var(--color-surface-soft);
  }
</style>
