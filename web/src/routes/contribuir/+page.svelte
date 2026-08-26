<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<section data-testid="contribuir-page">
  <p class="eyebrow">Contribuir · novo hinário</p>
  <h1>Subir um PDF para OCR</h1>
  <p class="lead">Vamos extrair os hinos automaticamente. Você confere antes de salvar.</p>
  {#if data.currentUser}
    <p class="hint" data-testid="contribuir-user">Enviando como {data.currentUser.username}.</p>
  {/if}
</section>

<style>
  .eyebrow {
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    letter-spacing: 0.12em;
    margin: 0;
    text-transform: uppercase;
  }
  h1 {
    font-family: var(--font-display);
    font-size: 2.25rem;
    margin: 0.5rem 0 0;
  }
  .lead {
    color: var(--color-text-soft);
    margin: 0.5rem 0 0;
  }
  .hint {
    color: var(--color-text-muted);
    font-size: 0.875rem;
  }
</style>
