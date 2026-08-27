<script lang="ts">
  /**
   * Sub-marco 5.C — Ciclo 5C.2.
   *
   * Diff inline OCR × texto revisado. Consome `HymnType.inlineDiff` tal como
   * o backend devolve (`_compute_inline_diff`): duas camadas, linha e palavra.
   *
   * Paridade visual com `.diff-inline` de `static/css/components.css`:
   * mono 13px, linhas `add` em verde-musgo, `del` em vermelho tachado,
   * tokens `sub` mostrando OCR tachado seguido do texto revisado.
   *
   * Semântica HTML: `<del>`/`<ins>` em vez de dois `<span>` — leitores de
   * tela anunciam remoção/inserção sem depender de cor.
   */
  export interface InlineDiffTokenProp {
    kind: string;
    text: string | null;
    sub: string | null;
    add: string | null;
  }
  export interface InlineDiffLineProp {
    kind: string;
    tokens: InlineDiffTokenProp[];
  }
  export interface InlineDiffProp {
    changes: number;
    adds: number;
    dels: number;
    lines: InlineDiffLineProp[];
  }

  let { diff = null }: { diff?: InlineDiffProp | null } = $props();

  let lines = $derived(diff?.lines ?? []);

  /**
   * 5C.3 — pluralização PT-BR das badges de contagem. O Django resolve isso
   * com `|pluralize`; aqui a regra é explícita porque as três palavras têm
   * plurais diferentes ("substituições" muda a sílaba tônica).
   */
  function pluralize(count: number, singular: string, plural: string): string {
    return `${count} ${count === 1 ? singular : plural}`;
  }
</script>

{#if !diff || lines.length === 0}
  <p class="diff-empty" data-testid="diff-empty">Sem OCR para comparar.</p>
{:else}
  <div class="diff-inline" data-testid="inline-diff">
    <header class="diff-badges">
      <span class="diff-badge is-change" data-testid="diff-count-changes">
        {pluralize(diff.changes, "substituição", "substituições")}
      </span>
      <span class="diff-badge is-add" data-testid="diff-count-adds">
        {pluralize(diff.adds, "adição", "adições")}
      </span>
      <span class="diff-badge is-del" data-testid="diff-count-dels">
        {pluralize(diff.dels, "remoção", "remoções")}
      </span>
    </header>
    {#each lines as line, index (index)}
      <p class="diff-line" data-testid="diff-line" data-kind={line.kind}>
        {#each line.tokens as token, tokenIndex (tokenIndex)}
          {#if token.kind === "sub"}
            <span data-testid="diff-token" data-kind="sub">
              <del>{token.sub ?? ""}</del><ins>{token.add ?? ""}</ins>
            </span>
          {:else if token.kind === "del"}
            <del data-testid="diff-token" data-kind="del">{token.text ?? ""}</del>
          {:else if token.kind === "add"}
            <ins data-testid="diff-token" data-kind="add">{token.text ?? ""}</ins>
          {:else}
            <span data-testid="diff-token" data-kind="eq">{token.text ?? ""}</span>
          {/if}
        {/each}
      </p>
    {/each}
  </div>
{/if}

<style>
  .diff-empty {
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    padding: 1rem;
  }

  .diff-inline {
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    line-height: 1.7;
    padding: 1rem;
  }

  .diff-badges {
    border-bottom: 1px solid var(--color-border-soft);
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    padding-bottom: 0.625rem;
  }

  .diff-badge {
    border: 1px solid currentcolor;
    border-radius: var(--radius-pill);
    color: var(--color-text-muted);
    font-size: 0.6875rem;
    letter-spacing: 0.06em;
    padding: 2px 10px;
    text-transform: uppercase;
  }

  .diff-badge.is-change {
    color: var(--color-status-mid);
  }

  .diff-badge.is-add {
    color: var(--color-status-ok);
  }

  .diff-badge.is-del {
    color: var(--color-status-not);
  }

  .diff-line {
    border-radius: 3px;
    padding: 2px 6px;
    white-space: pre-wrap;
  }

  .diff-line[data-kind="add"] {
    background: rgba(74, 106, 58, 0.12);
    color: var(--color-status-ok);
  }

  .diff-line[data-kind="del"] {
    background: rgba(177, 62, 46, 0.1);
    color: var(--color-status-not);
    text-decoration: line-through;
  }

  del {
    background: rgba(177, 62, 46, 0.15);
    border-radius: 2px;
    color: var(--color-status-not);
    padding: 0 3px;
    text-decoration: line-through;
  }

  ins {
    background: rgba(74, 106, 58, 0.15);
    border-radius: 2px;
    color: var(--color-status-ok);
    margin-left: 2px;
    padding: 0 3px;
    text-decoration: none;
  }

  .diff-line[data-kind="del"] del,
  .diff-line[data-kind="add"] ins {
    background: transparent;
    padding: 0;
  }
</style>
