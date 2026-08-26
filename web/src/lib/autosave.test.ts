/**
 * Sub-marco 5.C — Ciclo 5C.8 (parte isolada).
 *
 * O debounce do autosave vive fora do componente para poder ser testado com
 * timer falso, sem montar a tela de revisão inteira. A tela só orquestra:
 * `$effect` observa o formulário → `schedule()` → 2s de silêncio → mutation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTOSAVE_DELAY_MS, debounce, formatSavedAt } from "./autosave";

describe("debounce — 5C.8", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("não chama a função antes do atraso", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 2000);
    debounced();
    vi.advanceTimersByTime(1999);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("colapsa uma rajada de chamadas numa só", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 2000);
    for (let i = 0; i < 20; i += 1) {
      debounced();
      vi.advanceTimersByTime(100);
    }
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("dispara de novo depois de um novo período de silêncio", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 2000);
    debounced();
    vi.advanceTimersByTime(2000);
    debounced();
    vi.advanceTimersByTime(2000);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("passa os argumentos da última chamada", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 2000);
    debounced("a");
    debounced("b");
    vi.advanceTimersByTime(2000);
    expect(fn).toHaveBeenCalledWith("b");
  });

  it("`cancel()` descarta a chamada pendente", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 2000);
    debounced();
    expect(debounced.isPending()).toBe(true);
    debounced.cancel();
    expect(debounced.isPending()).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();
  });

  it("`flush()` executa a chamada pendente na hora", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 2000);
    debounced("x");
    debounced.flush();
    expect(fn).toHaveBeenCalledWith("x");
    expect(debounced.isPending()).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("`flush()` sem nada pendente é no-op", () => {
    const fn = vi.fn();
    debounce(fn, 2000).flush();
    expect(fn).not.toHaveBeenCalled();
  });

  it("o atraso do autosave é de 2s (paridade com o plano)", () => {
    expect(AUTOSAVE_DELAY_MS).toBe(2000);
  });
});

describe("formatSavedAt — 5C.8", () => {
  it("formata como `Salvo às HH:MM` com dois dígitos", () => {
    expect(formatSavedAt(new Date(2026, 7, 26, 9, 5))).toBe("Salvo às 09:05");
    expect(formatSavedAt(new Date(2026, 7, 26, 21, 42))).toBe("Salvo às 21:42");
  });

  it("meia-noite é 00:00, não 24:00", () => {
    expect(formatSavedAt(new Date(2026, 7, 26, 0, 0))).toBe("Salvo às 00:00");
  });
});
