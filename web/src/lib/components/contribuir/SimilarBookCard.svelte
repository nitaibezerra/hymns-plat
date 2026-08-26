<script lang="ts">
  /**
   * Sub-marco 5.F — Ciclo 5F.12.
   *
   * Porta do cartão de hinário similar de
   * `templates/users/upload_disambiguate.html`: nome linkado pro detalhe, dono,
   * total de hinos e os dois scores (nome e conteúdo) em porcentagem.
   *
   * Os dois scores ficam juntos de propósito: é a informação que faz o usuário
   * decidir entre "é o mesmo hinário, outra versão" e "é outro hinário".
   */
  import { scoreToPercent } from "./duplicates";

  import type { SimilarBook } from "./duplicates";

  let { similar }: { similar: SimilarBook } = $props();

  const namePct = $derived(scoreToPercent(similar.nameScore));
  const contentPct = $derived(scoreToPercent(similar.contentScore));
</script>

<article data-testid="similar-book-card">
  <div class="identity">
    <h3><a href={`/hinarios/${similar.hymnbook.slug}/`}>{similar.hymnbook.name}</a></h3>
    <p class="meta">{similar.hymnbook.ownerName} · {similar.hymnbook.hymnsTotal} hinos</p>
  </div>
  <div class="scores">
    <span class="score" data-testid="similar-name-score">Nome: {namePct}%</span>
    <span class="score" data-testid="similar-content-score">Conteúdo: {contentPct}%</span>
  </div>
</article>

<style>
  article {
    align-items: flex-start;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    display: flex;
    gap: 1rem;
    justify-content: space-between;
    padding: 1rem 1.25rem;
  }
  .identity {
    min-width: 0;
  }
  h3 {
    font-family: var(--font-display);
    font-size: 1.25rem;
    margin: 0;
  }
  h3 a {
    color: var(--color-text);
    text-decoration: none;
  }
  h3 a:hover {
    text-decoration: underline;
  }
  .meta {
    color: var(--color-text-soft);
    font-size: 0.875rem;
    margin: 0.25rem 0 0;
  }
  .scores {
    display: grid;
    gap: 0.25rem;
    justify-items: end;
  }
  .score {
    background: var(--color-bg-deep);
    border-radius: var(--radius-sm);
    color: var(--color-text-soft);
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    letter-spacing: 0.04em;
    padding: 0.25rem 0.5rem;
    white-space: nowrap;
  }
</style>
