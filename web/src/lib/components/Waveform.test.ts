/**
 * Marco 4.F — Ciclos 4F.4 e 4F.5.
 *
 * `Waveform.svelte` renderiza a fila de picos como barras SVG, espelhando
 * o visual de `static/js/audio-player.js` (Marco 2). Recebe:
 *
 *   - `peaks: number[]` — uma amplitude por barra, valor em [0, 1].
 *   - `progress: number` — fração da reprodução em [0, 1]; barras antes
 *     dessa fração recebem a classe `played`.
 *   - `onSeek: (ratio: number) => void` — callback ao clicar; recebe a
 *     fração horizontal clicada (multiplicada por duration no chamador).
 *
 * 4F.4 — renderiza N rects, classe `played` aplicada nas primeiras `N*progress`.
 * 4F.5 — clicar invoca `onSeek` com `clickX / width`.
 */

import { fireEvent, render } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import Waveform from "./Waveform.svelte";

describe("Waveform — renderização (4F.4)", () => {
  it("renderiza N barras SVG a partir de peaks", () => {
    const peaks = [0.1, 0.4, 0.9, 0.5];
    const { container } = render(Waveform, {
      props: { peaks, progress: 0 },
    });
    const bars = container.querySelectorAll("rect[data-bar]");
    expect(bars.length).toBe(peaks.length);
  });

  it("aplica a classe 'played' nas barras antes de progress", () => {
    const peaks = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    const { container } = render(Waveform, {
      props: { peaks, progress: 0.5 },
    });
    const bars = Array.from(container.querySelectorAll("rect[data-bar]"));
    const playedCount = bars.filter((b) => b.classList.contains("played")).length;
    expect(playedCount).toBe(5);
  });

  it("nenhuma barra 'played' quando progress=0", () => {
    const peaks = [0.1, 0.2, 0.3];
    const { container } = render(Waveform, {
      props: { peaks, progress: 0 },
    });
    const played = container.querySelectorAll("rect[data-bar].played");
    expect(played.length).toBe(0);
  });

  it("todas as barras 'played' quando progress=1", () => {
    const peaks = [0.1, 0.2, 0.3];
    const { container } = render(Waveform, {
      props: { peaks, progress: 1 },
    });
    const played = container.querySelectorAll("rect[data-bar].played");
    expect(played.length).toBe(peaks.length);
  });
});

describe("Waveform — seek (4F.5)", () => {
  it("clique invoca onSeek com a fração horizontal clicada", async () => {
    const onSeek = vi.fn();
    const peaks = [0.1, 0.2, 0.3, 0.4];
    const { container } = render(Waveform, {
      props: { peaks, progress: 0, onSeek },
    });
    const svg = container.querySelector("svg")!;
    // jsdom retorna 0 em getBoundingClientRect por default — stubamos.
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 200,
      bottom: 36,
      width: 200,
      height: 36,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    await fireEvent.click(svg, { clientX: 50 });

    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek.mock.calls[0][0]).toBeCloseTo(0.25, 5);
  });

  it("não quebra se onSeek não for passado", async () => {
    const peaks = [0.1, 0.2];
    const { container } = render(Waveform, {
      props: { peaks, progress: 0 },
    });
    const svg = container.querySelector("svg")!;
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 100,
      bottom: 36,
      width: 100,
      height: 36,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    await expect(fireEvent.click(svg, { clientX: 50 })).resolves.not.toThrow();
  });
});
