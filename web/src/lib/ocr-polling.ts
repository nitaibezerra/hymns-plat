/**
 * Sub-marco 5.F — Ciclo 5F.9a.
 *
 * Polling da `OCRTask`, extraído da tela pra ser testável com timer fake.
 * Substitui o `setTimeout`/`fetch` inline de
 * `templates/users/upload_processing.html` (que batia no JSON
 * `contribuir/ocr-status/<id>/`); na SPA a fonte é `Query.ocrTask(id)`.
 *
 * Decisões que valem citar:
 *
 * - **Cadeia de `setTimeout`, não `setInterval`.** O próximo tick só é
 *   agendado depois que o anterior termina, então uma resposta lenta não
 *   acumula requisições sobrepostas. É o mesmo desenho do template Django.
 *
 * - **`resultData` é nulável.** `OCRTaskType.resultData` é `JSON` (nulável):
 *   uma task `pending`/`processing` não tem resultado, e existe uma janela
 *   em que o status já é `completed` mas o resultado ainda não foi gravado.
 *   Por isso "pronta" = `completed` **com** `resultData`, exatamente como o
 *   `if task.status == COMPLETED and task.result_data` da
 *   `upload_processing_view`. Pra não girar pra sempre nessa janela existe
 *   `emptyResultTolerance`.
 *
 * - **Erro não mata a tela.** Falha de rede/HTTP/GraphQL é reportada via
 *   `onError` e o polling continua; só `missing` (task inexistente ou sem
 *   permissão) e status terminal encerram.
 */

/** Mesmo intervalo do template Django que este módulo substitui. */
export const OCR_POLL_INTERVAL_MS = 1800;

/** Quantos ticks tolerar em `completed` sem `resultData` antes de desistir. */
const DEFAULT_EMPTY_RESULT_TOLERANCE = 5;

/** Status terminais de `apps/hymns/models.py::OCRTask`. */
const FINAL_STATUSES = ["completed", "failed"];

export interface OcrTaskSnapshot {
  id: string;
  status: string;
  currentPage: number;
  totalPages: number;
  progressPct: number;
  errorMessage: string;
  pdfFilename: string;
  resultData: unknown | null;
}

export type OcrFetchResult =
  | { kind: "task"; task: OcrTaskSnapshot }
  /** `Query.ocrTask` devolveu `null`: não existe ou o usuário não tem acesso. */
  | { kind: "missing" }
  /** Falha transitória (rede, HTTP, erro GraphQL) — vale tentar de novo. */
  | { kind: "error"; message: string };

export interface OcrPollingOptions {
  fetchTask: () => Promise<OcrFetchResult>;
  onUpdate?: (task: OcrTaskSnapshot) => void;
  onDone?: (task: OcrTaskSnapshot) => void;
  onMissing?: () => void;
  onError?: (message: string) => void;
  intervalMs?: number;
  emptyResultTolerance?: number;
}

export interface OcrPollingHandle {
  stop: () => void;
}

export function isOcrFinalStatus(status: string): boolean {
  return FINAL_STATUSES.includes(status);
}

/** `true` só quando dá pra seguir pro próximo passo do wizard. */
export function isOcrTaskReady(task: OcrTaskSnapshot): boolean {
  return task.status === "completed" && task.resultData !== null && task.resultData !== undefined;
}

export function startOcrPolling(options: OcrPollingOptions): OcrPollingHandle {
  const intervalMs = options.intervalMs ?? OCR_POLL_INTERVAL_MS;
  const tolerance = options.emptyResultTolerance ?? DEFAULT_EMPTY_RESULT_TOLERANCE;

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let emptyResultTicks = 0;

  function stop() {
    stopped = true;
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  }

  function scheduleNext() {
    if (stopped) return;
    timer = setTimeout(tick, intervalMs);
  }

  async function tick() {
    if (stopped) return;

    let result: OcrFetchResult;
    try {
      result = await options.fetchTask();
    } catch {
      result = { kind: "error", message: "Erro de rede ao consultar o progresso do OCR." };
    }
    // A resposta pode chegar depois de a tela ser desmontada.
    if (stopped) return;

    if (result.kind === "missing") {
      options.onMissing?.();
      stop();
      return;
    }

    if (result.kind === "error") {
      options.onError?.(result.message);
      scheduleNext();
      return;
    }

    const task = result.task;
    options.onUpdate?.(task);

    if (task.status === "failed" || isOcrTaskReady(task)) {
      options.onDone?.(task);
      stop();
      return;
    }

    if (task.status === "completed") {
      // `completed` sem `resultData`: janela transitória. Tolera alguns ticks
      // e então desiste, em vez de deixar o usuário num spinner eterno.
      emptyResultTicks += 1;
      if (emptyResultTicks >= tolerance) {
        options.onError?.(
          "O OCR terminou mas o resultado não ficou disponível. Tente enviar o PDF novamente.",
        );
        stop();
        return;
      }
    }

    scheduleNext();
  }

  // Primeira consulta imediata: o usuário não deve esperar 1,8 s por nada.
  void tick();

  return { stop };
}
