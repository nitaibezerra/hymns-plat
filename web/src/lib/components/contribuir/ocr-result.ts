/**
 * Sub-marco 5.F — Ciclo 5F.14.
 *
 * Forma do `resultData` da `OCRTask` + formatadores da tabela de conferência.
 * Mora em `$lib` pra que componentes e rotas importem do mesmo lugar; a camada
 * de acesso (`routes/contribuir/ocr-task.ts`) reexporta daqui.
 *
 * O `resultData` vem no formato produzido por
 * `apps/hymns/services/ocr.py::run_ocr`:
 *
 *     {"hymn_book": {"name", "owner", "intro_name", "hymns": [...]}}
 *
 * Os hinos passam por `_hymn_to_dict`, que **remove** campos `None` e strings
 * vazias — por isso todo campo opcional é lido com fallback. E o próprio
 * `resultData` é nulável: task `pending`/`processing` não tem resultado.
 */

export interface OcrHymn {
  number: number | null;
  title: string;
  text: string;
  ocrAvgConfidence: number | null;
}

export interface OcrHymnBook {
  name: string;
  owner: string;
  introName: string;
  hymns: OcrHymn[];
}

/** Quantos hinos a conferência mostra (o Django mostrava os 5 primeiros). */
export const PREVIEW_HYMN_LIMIT = 5;

/** Porta do `stringformat:"02d"` do template: dois dígitos, sem truncar. */
export function formatHymnNumber(value: number | null): string {
  if (value === null) return "—";
  return String(value).padStart(2, "0");
}

/** Porta do `floatformat:0` + "%", com travessão quando não há confiança. */
export function formatOcrConfidence(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value)}%`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

/**
 * Normaliza o `resultData` cru em algo tipado. Devolve `null` quando o
 * resultado ainda não existe (task `pending`/`processing`) ou quando não tem a
 * forma esperada — quem chama decide o que fazer com o nulo.
 */
export function parseOcrResultData(raw: unknown): OcrHymnBook | null {
  const root = asRecord(raw);
  const book = root && asRecord(root.hymn_book);
  if (!book) return null;

  const rawHymns = Array.isArray(book.hymns) ? book.hymns : [];
  const hymns: OcrHymn[] = rawHymns.flatMap((entry) => {
    const hymn = asRecord(entry);
    if (!hymn) return [];
    return [
      {
        number: asNumberOrNull(hymn.number),
        title: asText(hymn.title),
        text: asText(hymn.text),
        ocrAvgConfidence: asNumberOrNull(hymn.ocr_avg_confidence),
      },
    ];
  });

  return {
    name: asText(book.name),
    owner: asText(book.owner),
    introName: asText(book.intro_name),
    hymns,
  };
}
