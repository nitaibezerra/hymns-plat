<script lang="ts">
  /**
   * Sub-marco 5.F — Ciclo 5F.14.
   *
   * Porta da tabela de `templates/users/upload_preview.html`: Nº, Título e a
   * confiança média do OCR por hino. A confiança é o que orienta o revisor a
   * decidir onde olhar primeiro, então fica visível já na conferência.
   *
   * `hymns` já vem recortado pela rota (5 primeiros); `totalHymns` é o total
   * extraído, usado só pro rodapé "… e mais N".
   */
  import { formatHymnNumber, formatOcrConfidence } from "./ocr-result";

  import type { OcrHymn } from "./ocr-result";

  let { hymns, totalHymns }: { hymns: OcrHymn[]; totalHymns: number } = $props();

  const remaining = $derived(Math.max(0, totalHymns - hymns.length));
</script>

<div data-testid="ocr-preview-table">
  <table>
    <thead>
      <tr>
        <th scope="col">Nº</th>
        <th scope="col">Título</th>
        <th scope="col" class="numeric">OCR</th>
      </tr>
    </thead>
    <tbody>
      {#each hymns as hymn, i (`${hymn.number ?? "s"}-${i}`)}
        <tr data-testid="ocr-preview-row">
          <td class="mono">{formatHymnNumber(hymn.number)}</td>
          <td>{hymn.title}</td>
          <td class="mono numeric">{formatOcrConfidence(hymn.ocrAvgConfidence)}</td>
        </tr>
      {/each}
    </tbody>
  </table>

  {#if remaining > 0}
    <p class="more" data-testid="ocr-preview-more">
      … e mais {remaining} {remaining === 1 ? "hino" : "hinos"}
    </p>
  {/if}
</div>

<style>
  table {
    border-collapse: collapse;
    font-size: 0.9375rem;
    width: 100%;
  }
  th {
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.625rem;
    font-weight: 500;
    letter-spacing: 0.12em;
    padding-bottom: 0.5rem;
    text-align: left;
    text-transform: uppercase;
  }
  th.numeric,
  td.numeric {
    text-align: right;
  }
  td {
    border-top: 1px solid var(--color-border-soft);
    padding: 0.5rem 0;
  }
  .mono {
    color: var(--color-text-soft);
    font-family: var(--font-mono);
    font-size: 0.75rem;
  }
  .more {
    color: var(--color-text-muted);
    font-size: 0.875rem;
    margin: 0.75rem 0 0;
    text-align: center;
  }
</style>
