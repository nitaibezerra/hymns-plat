/**
 * Marco 4.D — Ciclos 4D.5 a 4D.9.
 *
 * HymnCarousel — "Reader Focus": 1 slide por viewport, hero+toggle escondidos
 * (responsabilidade do +page.svelte), chrome fixa: progress bar topo + counter
 * + prev/next arrows + dot pagination bottom. Comportamento teclado:
 *   ← →  navega entre slides
 *   Esc  volta pra ?mode=indice (via SvelteKit goto)
 * Respeita `prefers-reduced-motion`.
 */

import { render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HymnCarousel from "./HymnCarousel.svelte";

const hymns = [
  { id: "h-1", number: 1, title: "Abertura", body: "Verso 1\nVerso 2" },
  { id: "h-2", number: 2, title: "Saudação", body: "Linha A\nLinha B" },
  { id: "h-3", number: 3, title: "Estrela do Norte", body: "Brilha o sol" },
];

const gotoMock = vi.fn();
vi.mock("$app/navigation", () => ({
  goto: (...args: unknown[]) => gotoMock(...args),
}));

function setMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeEach(() => {
  gotoMock.mockReset();
  setMatchMedia(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HymnCarousel", () => {
  describe("layout (4D.5)", () => {
    it("renderiza um slide por hino com largura de viewport", () => {
      render(HymnCarousel, { props: { hymns, hymnbookSlug: "justiceiro" } });
      const slides = screen.getAllByTestId("carousel-slide");
      expect(slides).toHaveLength(3);
      for (const slide of slides) {
        expect(slide.className).toMatch(/carousel-slide/);
      }
    });

    it("counter mostra '1 / N' no slide atual", () => {
      render(HymnCarousel, { props: { hymns, hymnbookSlug: "justiceiro" } });
      const counter = screen.getByTestId("carousel-counter");
      expect(counter.textContent ?? "").toMatch(/1\s*\/\s*3/);
    });
  });
});
