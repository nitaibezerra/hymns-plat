<script lang="ts">
  /**
   * Marco 5.B — Ciclo 5B.8.
   *
   * Detalhe do hinário na visão do editor: migalha de volta pra fila,
   * cabeçalho com autoria e estado de publicação, barra de progresso de
   * revisão e a lista de hinos com badge de status.
   *
   * O botão "Próximo pendente" (5B.9) consome `HymnBookType.nextPendingHymn`
   * e navega com `goto`. É um `<button>`, não um `<a>`: o destino não é
   * derivável da URL desta página — quem escolhe o hino é o backend, que
   * conhece a regra de fila com wrap-around. Renderizar um link seria
   * prometer um endereço que o cliente não sabe montar.
   *
   * Paridade com `templates/hymns/editor/hymnbook_detail.html`.
   *
   * Frente 1 — Ciclo 1.2: esta tela passa a ser a porta de entrada das ações
   * de dono que o Django oferece em `templates/hymns/hymnbook_detail.html`
   * sob `{% if can_edit %}` ("+ Hino" e "Editar", pareados) e da publicação
   * que `editor/hymnbook_list.html` oferece por form POST. Antes do 1.2 as
   * rotas de CRUD e os modais de 5.D existiam sem ninguém apontar pra eles.
   *
   * **Gate de permissão.** O Django checa `can_edit_hymnbook` (editor ou
   * admin) e `can_publish_hymnbook` (perm `hymns.can_publish_hymnbook`, que
   * o grupo `editor` recebe na migration 0008). O guard de
   * `/editor/+layout.ts` já exige `UserType.isEditor` pra chegar aqui, e o
   * schema GraphQL não expõe nenhum campo mais fino que isso — não há
   * `canPublish` por hinário em `UserType`. Então o gate da SPA é o guard, e
   * a autoridade continua sendo o backend: a mutation devolve
   * `PermissionDeniedError` e o modal mostra a mensagem em vez de fingir
   * sucesso.
   */
  import { goto, invalidateAll } from "$app/navigation";
  import DeleteHymnBookModal from "$lib/components/editor/DeleteHymnBookModal.svelte";
  import HymnStatusList from "$lib/components/editor/HymnStatusList.svelte";
  import PublishHymnBookModal from "$lib/components/editor/PublishHymnBookModal.svelte";
  import ReviewProgressBar from "$lib/components/editor/ReviewProgressBar.svelte";

  import { _editorReviseHref } from "../../+layout";

  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const book = $derived(data.hymnbook);
  const next = $derived(book.nextPendingHymn);

  let publishOpen = $state(false);
  let deleteOpen = $state(false);

  function goToNextPending() {
    if (!next) return;
    goto(_editorReviseHref(next.id));
  }

  /**
   * Publicou/despublicou: o modal não navega (é contrato dele). Quem decide é
   * esta tela, e a decisão é ficar onde está e re-perguntar ao backend —
   * `isPublished`, o checklist e o progresso vêm todos da load, e reescrevê-los
   * no cliente seria manter uma segunda verdade.
   */
  function handlePublished() {
    publishOpen = false;
    void invalidateAll();
  }

  /**
   * Deletou: não há mais detalhe pra recarregar. Volta pra fila — o mesmo
   * destino do `hymnbook_delete_view` do Django (que redireciona pro list).
   */
  function handleDeleted() {
    deleteOpen = false;
    goto("/editor/");
  }
</script>

<section class="detail" data-testid="editor-hymnbook-detail">
  <nav class="breadcrumb">
    <a href="/editor/">← Fila de revisão</a>
  </nav>

  <header class="detail-header">
    <div class="detail-ident">
      <p class="eyebrow">Hinário em revisão</p>
      <h1 class="font-display detail-title">{book.name}</h1>
      <p class="detail-owner" data-testid="detail-owner">{book.ownerName}</p>
    </div>

    <div class="detail-actions">
      {#if !book.isPublished}
        <span class="draft-badge" data-testid="detail-draft-badge">Rascunho</span>
      {/if}

      {#if next}
        <button
          type="button"
          class="next-pending"
          data-testid="next-pending"
          title={`Hino ${next.number} — ${next.title}`}
          onclick={goToNextPending}
        >
          Próximo pendente →
        </button>
      {:else}
        <p class="all-reviewed" data-testid="all-reviewed">Tudo revisado ✓</p>
      {/if}
    </div>
  </header>

  <!--
    Ações de dono. Ordem por peso: as duas de conteúdo primeiro (mesma dupla
    do `{% if can_edit %}` do Django), depois a de publicação, e a destrutiva
    isolada à direita pra não encostar nas outras.
  -->
  <div class="owner-actions">
    <a
      class="owner-action"
      href={`/editor/hinarios/${book.slug}/hinos/novo/`}
      data-testid="new-hymn-link"
    >
      + Hino
    </a>
    <a
      class="owner-action"
      href={`/editor/hinarios/${book.slug}/editar/`}
      data-testid="edit-hymnbook-link"
    >
      Editar hinário
    </a>
    <button
      class="owner-action"
      type="button"
      data-testid="publish-hymnbook"
      onclick={() => (publishOpen = true)}
    >
      {book.isPublished ? "Despublicar" : "Publicar"}
    </button>
    <button
      class="owner-action owner-action--danger"
      type="button"
      data-testid="delete-hymnbook"
      onclick={() => (deleteOpen = true)}
    >
      Deletar
    </button>
  </div>

  <PublishHymnBookModal
    open={publishOpen}
    hymnbook={{ name: book.name, slug: book.slug, isPublished: book.isPublished }}
    onchanged={handlePublished}
    onclose={() => (publishOpen = false)}
  />

  <DeleteHymnBookModal
    open={deleteOpen}
    hymnbook={{ name: book.name, slug: book.slug, hymnsTotal: book.stats.hymnsTotal }}
    ondeleted={handleDeleted}
    onclose={() => (deleteOpen = false)}
  />

  <div class="detail-progress">
    <ReviewProgressBar
      label="Revisados"
      tone="review"
      pct={book.reviewProgress.reviewPct}
      count={`${book.stats.hymnsReviewed} de ${book.stats.hymnsTotal}`}
    />
  </div>

  <HymnStatusList hymns={book.hymns} hrefFor={_editorReviseHref} />
</section>

<style>
  .detail {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .breadcrumb a {
    color: var(--color-text-muted);
    font-family: var(--font-mono, var(--font-sans));
    font-size: 0.6875rem;
    letter-spacing: 0.14em;
    text-decoration: none;
    text-transform: uppercase;
  }
  .breadcrumb a:hover,
  .breadcrumb a:focus-visible {
    color: var(--color-gold);
  }
  .detail-header {
    align-items: flex-start;
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    justify-content: space-between;
  }
  .detail-ident {
    flex: 1;
    min-width: 0;
  }
  .eyebrow {
    color: var(--color-text-muted);
    font-family: var(--font-mono, var(--font-sans));
    font-size: 0.6875rem;
    font-weight: 500;
    letter-spacing: 0.14em;
    margin: 0;
    text-transform: uppercase;
  }
  .detail-title {
    font-size: clamp(1.875rem, 4vw, 2.5rem);
    font-weight: 600;
    line-height: 1.05;
    margin: 0.5rem 0 0;
  }
  .detail-owner {
    color: var(--color-text-soft);
    margin: 0.25rem 0 0;
  }
  .draft-badge {
    background: var(--color-bg-deep);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-pill);
    color: var(--color-text-soft);
    font-family: var(--font-sans);
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    padding: 0.25rem 0.625rem;
    text-transform: uppercase;
  }
  .detail-actions {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .next-pending {
    background: var(--color-accent);
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-pill);
    color: var(--color-bg);
    cursor: pointer;
    font-family: var(--font-sans);
    font-size: 0.875rem;
    padding: 0.5rem 1.125rem;
    transition:
      background 140ms ease,
      transform 100ms ease;
  }
  .next-pending:hover,
  .next-pending:focus-visible {
    background: var(--color-accent-2);
  }
  .next-pending:active {
    transform: translateY(1px);
  }
  .all-reviewed {
    color: var(--color-status-ok);
    font-family: var(--font-mono, var(--font-sans));
    font-size: 0.75rem;
    letter-spacing: 0.12em;
    margin: 0;
    text-transform: uppercase;
  }
  .detail-progress {
    border-bottom: 1px solid var(--color-border-soft);
    padding-bottom: 1.25rem;
  }
  .owner-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .owner-action {
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-pill);
    color: var(--color-text-soft);
    cursor: pointer;
    font-family: var(--font-mono, var(--font-sans));
    font-size: 0.6875rem;
    letter-spacing: 0.12em;
    padding: 0.375rem 0.875rem;
    text-decoration: none;
    text-transform: uppercase;
  }
  .owner-action:hover,
  .owner-action:focus-visible {
    background: var(--color-bg-deep);
    color: var(--color-text);
  }
  .owner-action--danger {
    color: var(--color-status-not);
    margin-left: auto;
  }
  .owner-action--danger:hover,
  .owner-action--danger:focus-visible {
    background: color-mix(in srgb, var(--color-status-not) 12%, transparent);
    border-color: color-mix(in srgb, var(--color-status-not) 45%, transparent);
    color: var(--color-status-not);
  }
</style>
