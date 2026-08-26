/**
 * Sub-marco 5.C — Ciclo 5C.8.
 *
 * Debounce do autosave da tela de revisão, extraído do componente para ser
 * testável com timer falso (`vi.useFakeTimers`).
 *
 * Sem runes de propósito: este módulo é `.ts` puro, não `.svelte.ts`. Quem
 * guarda o estado reativo ("salvando…", "Salvo às 14:07") é a página; aqui
 * só existe a mecânica do atraso.
 */

/** 2s de silêncio antes de salvar — o número vem do plano (5C.8). */
export const AUTOSAVE_DELAY_MS = 2000;

export interface Debounced<TArgs extends unknown[]> {
  (...args: TArgs): void;
  /** Descarta a chamada pendente (ex.: ao desmontar ou ao salvar à mão). */
  cancel(): void;
  /** Executa a chamada pendente agora (ex.: antes de navegar). */
  flush(): void;
  isPending(): boolean;
}

export function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  delayMs: number,
): Debounced<TArgs> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: TArgs | null = null;

  function clear() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    lastArgs = null;
  }

  const wrapped = (...args: TArgs) => {
    lastArgs = args;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      const args_ = lastArgs;
      clear();
      if (args_) fn(...args_);
    }, delayMs);
  };

  return Object.assign(wrapped, {
    cancel: clear,
    flush() {
      if (timer === null) return;
      const args = lastArgs;
      clear();
      if (args) fn(...args);
    },
    isPending: () => timer !== null,
  });
}

/** Rótulo do indicador de autosave: "Salvo às HH:MM" (hora local, 24h). */
export function formatSavedAt(when: Date): string {
  const hours = String(when.getHours()).padStart(2, "0");
  const minutes = String(when.getMinutes()).padStart(2, "0");
  return `Salvo às ${hours}:${minutes}`;
}
