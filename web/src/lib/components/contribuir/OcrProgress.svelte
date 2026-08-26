<script lang="ts">
  /**
   * Sub-marco 5.F — Ciclos 5F.9 e 5F.10.
   *
   * Porta do bloco de progresso de `templates/users/upload_processing.html`.
   * Componente burro: só desenha o snapshot que o polling entrega.
   *
   * Três estados de erro, deliberadamente distintos:
   *
   *   - `task.status === "failed"`: o OCR falhou. Mostra `errorMessage` e
   *     "Tentar novamente" (porta do bloco `{% if task.status == "failed" %}`
   *     de `upload_processing.html`).
   *   - `fatalError`: o polling parou por outro motivo definitivo (task
   *     inexistente ou sem permissão). Também é fim de linha — não pode
   *     dizer "continuando a tentar", que seria mentira.
   *   - `networkError`: soluço transitório. Aparece como aviso e **não** apaga
   *     a barra, porque o polling continua tentando.
   */
  import type { OcrTaskSnapshot } from "$lib/ocr-polling";

  let {
    task,
    networkError = null,
    fatalError = null,
  }: {
    task: OcrTaskSnapshot | null;
    networkError?: string | null;
    fatalError?: string | null;
  } = $props();

  const failed = $derived(task?.status === "failed");

  const progressText = $derived.by(() => {
    if (!task) return "Iniciando…";
    if (task.status === "processing" && task.totalPages > 0) {
      return `Página ${task.currentPage} de ${task.totalPages}`;
    }
    if (task.status === "completed") return "Extração concluída.";
    return "Aguardando…";
  });

  const pct = $derived(Math.max(0, Math.min(100, task?.progressPct ?? 0)));
</script>

<div data-testid="ocr-progress">
  <p class="filename">
    Estamos extraindo os hinos do PDF <strong>{task?.pdfFilename || "enviado"}</strong> via OCR.
  </p>

  {#if failed}
    <div class="failed" role="alert" data-testid="ocr-failed">
      <p class="failed-title">A extração falhou.</p>
      <p class="failed-message">{task?.errorMessage || "Erro desconhecido."}</p>
      <a class="retry" href="/contribuir/">Tentar novamente</a>
    </div>
  {:else if fatalError}
    <div class="failed" role="alert" data-testid="ocr-fatal">
      <p class="failed-title">Não foi possível acompanhar a extração.</p>
      <p class="failed-message">{fatalError}</p>
      <a class="retry" href="/contribuir/">Tentar novamente</a>
    </div>
  {:else}
    <div class="panel">
      <p class="progress-text" data-testid="ocr-progress-text">{progressText}</p>
      <div
        class="track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="Progresso da extração"
      >
        <div class="fill" data-testid="ocr-progress-fill" style={`width: ${pct}%;`}></div>
      </div>
      <p class="hint">Esta página atualiza automaticamente.</p>
      {#if networkError}
        <p class="network-error" data-testid="ocr-network-error">
          Falha ao consultar o progresso ({networkError}). Continuando a tentar…
        </p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .filename {
    color: var(--color-text-soft);
    margin: 0 0 1.5rem;
  }
  .panel {
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: 2rem;
    text-align: center;
  }
  .progress-text {
    font-family: var(--font-display);
    font-size: 1.75rem;
    margin: 0;
  }
  .track {
    background: var(--color-bg-deep);
    border-radius: var(--radius-pill);
    height: 0.5rem;
    margin-top: 1.5rem;
    overflow: hidden;
  }
  .fill {
    background: var(--color-accent);
    height: 100%;
    transition: width 240ms ease;
  }
  .hint {
    color: var(--color-text-muted);
    font-size: 0.75rem;
    margin: 1rem 0 0;
  }
  .network-error {
    color: var(--color-status-mid);
    font-size: 0.8125rem;
    margin: 0.75rem 0 0;
  }
  .failed {
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-status-not);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
  }
  .failed-title {
    font-weight: 600;
    margin: 0;
  }
  .failed-message {
    color: var(--color-text-soft);
    font-size: 0.875rem;
    margin: 0.25rem 0 0;
  }
  .retry {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-pill);
    color: var(--color-text);
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    letter-spacing: 0.12em;
    margin-top: 1rem;
    padding: 0.375rem 1rem;
    text-decoration: none;
    text-transform: uppercase;
  }
</style>
