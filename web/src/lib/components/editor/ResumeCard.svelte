<script lang="ts">
  /**
   * Marco 5.B — Ciclo 5B.4.
   *
   * "Continuar revisão": a faixa invertida (tinta no fundo, papel na frente)
   * que devolve o editor exatamente pro hino em que ele parou. Paridade com
   * o bloco `{% if resume %}` do template Django.
   *
   * O card TODO é o `<a>` — retomar o trabalho não deveria exigir mira. O
   * `href` vem de fora porque a rota de revisão do hino pertence ao 5.C;
   * aqui só apresentamos.
   */
  export interface ResumeHymn {
    id: string;
    number: number;
    title: string;
    hymnBook: { name: string; slug: string };
  }

  let {
    hymn,
    href,
  }: {
    hymn: ResumeHymn;
    href: string;
  } = $props();
</script>

<a class="resume-card" {href} data-testid="resume-card">
  <span class="resume-glyph" aria-hidden="true">↩</span>

  <span class="resume-body">
    <span class="resume-title">Continuar revisão</span>
    <span class="resume-detail">
      {hymn.hymnBook.name} · você parou no hino {hymn.number} · "{hymn.title}"
    </span>
  </span>

  <span class="resume-cta" data-testid="resume-cta">Retomar →</span>
</a>

<style>
  .resume-card {
    align-items: center;
    background: var(--color-text);
    border-radius: var(--radius-lg);
    color: var(--color-bg);
    display: flex;
    gap: 1rem;
    padding: 1rem 1.25rem;
    text-decoration: none;
    transition:
      background 160ms ease,
      transform 160ms ease;
  }
  .resume-card:hover,
  .resume-card:focus-visible {
    background: var(--color-text-soft);
    transform: translateY(-1px);
  }
  .resume-glyph {
    align-items: center;
    border: 1px solid color-mix(in srgb, var(--color-bg) 35%, transparent);
    border-radius: var(--radius-pill);
    display: inline-flex;
    flex-shrink: 0;
    height: 2.5rem;
    justify-content: center;
    width: 2.5rem;
  }
  .resume-body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
  }
  .resume-title {
    font-weight: 500;
  }
  .resume-detail {
    color: color-mix(in srgb, var(--color-bg) 72%, var(--color-text));
    font-family: var(--font-mono, var(--font-sans));
    font-size: 0.6875rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .resume-cta {
    flex-shrink: 0;
    font-family: var(--font-mono, var(--font-sans));
    font-size: 0.75rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
</style>
