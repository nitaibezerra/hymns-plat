<script lang="ts">
  /**
   * Marco 4.E — Ciclo 4E.4.
   *
   * "Este número aparece também em…" — lista de outros hinos com o mesmo
   * número em hinários visíveis pelo usuário (gating já aplicado no
   * resolver `siblingsWithSameNumber`).
   *
   * O schema vigente (4.A) não expõe `hymnBook` em `HymnType`, então
   * a UI mostra `title` (que tipicamente já carrega o nome do hinário
   * no monolito quando há ambiguidade). O link aponta pro detalhe do
   * irmão (`/hinos/<id>`).
   */
  interface SiblingRef {
    id: string;
    number: number;
    title: string;
  }

  let { siblings = [] }: { siblings?: SiblingRef[] } = $props();
</script>

<section class="siblings" data-testid="siblings">
  <h2 class="siblings-title">Este número aparece também em</h2>
  <ul class="siblings-list">
    {#each siblings as sib (sib.id)}
      <li class="sibling-card" data-testid="sibling-card">
        <a class="sibling-link" href={`/hinos/${sib.id}`}>
          <span class="sibling-number">{String(sib.number).padStart(2, "0")}</span>
          <span class="sibling-title">{sib.title}</span>
        </a>
      </li>
    {/each}
  </ul>
</section>

<style>
  .siblings {
    background: var(--color-surface-soft);
    border-radius: 0.75rem;
    padding: 1.25rem;
  }
  .siblings-title {
    font-family: var(--font-display);
    font-size: 1.25rem;
    margin: 0 0 0.75rem 0;
  }
  .siblings-list {
    display: grid;
    gap: 0.5rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .sibling-card {
    border: 1px solid var(--color-border-soft);
    border-radius: 0.5rem;
    background: var(--color-bg);
  }
  .sibling-link {
    align-items: center;
    color: var(--color-text);
    display: flex;
    gap: 0.75rem;
    padding: 0.625rem 0.875rem;
    text-decoration: none;
  }
  .sibling-link:hover {
    background: var(--color-surface-soft);
  }
  .sibling-number {
    color: var(--color-text-soft);
    font-family: var(--font-sans);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .sibling-title {
    font-family: var(--font-display);
    font-size: 1rem;
  }
</style>
