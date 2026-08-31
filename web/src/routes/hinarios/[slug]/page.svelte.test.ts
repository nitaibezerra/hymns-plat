/**
 * Marco 4.D — Testes de integração da página do hinário.
 *
 * Cobre os 3 modos (índice/corrido/carrossel) renderizados via `+page.svelte`.
 * Cada ciclo TDD vai adicionando blocos a este arquivo.
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import Page from "./+page.svelte";
import type { HymnbookDetailData } from "./+page";

// HymnCarousel usa `goto` do SvelteKit; precisa de mock no ambiente jsdom.
vi.mock("$app/navigation", () => ({
  goto: vi.fn(),
}));

// `PageData` extends `LayoutData` em SvelteKit, então o componente espera
// `currentUser` também. O load function só define os campos do +page.ts;
// `currentUser` é injetado pelo runtime do SvelteKit.
const sampleData: HymnbookDetailData & { currentUser: null; editorPendingCount: number } = {
  currentUser: null,
  editorPendingCount: 0,
  hymnbook: {
    id: "hb-1",
    name: "O Justiceiro",
    slug: "justiceiro",
    isPublished: true,
    hymns: [
      { id: "h-1", number: 1, title: "Abertura", body: "Verso 1\nVerso 2" },
      { id: "h-2", number: 2, title: "Saudação", body: "Linha A\nLinha B" },
    ],
  },
  mode: "indice",
  error: null,
};

describe("/hinarios/[slug] página", () => {
  describe("modo índice (4D.2)", () => {
    it("renderiza lista de hinos como links para /hinos/[id]", () => {
      render(Page, { props: { data: sampleData } });
      const items = screen.getAllByTestId("hymn-index-item");
      expect(items).toHaveLength(2);
      const links = screen.getAllByRole("link", { name: /(abertura|saudação)/i });
      expect(links[0].getAttribute("href")).toBe("/hinos/h-1");
      expect(links[1].getAttribute("href")).toBe("/hinos/h-2");
    });
  });

  describe("modo corrido (4D.3)", () => {
    it("renderiza todos os hinos em coluna usando HymnBody", () => {
      render(Page, { props: { data: { ...sampleData, mode: "corrido" } } });
      const items = screen.getAllByTestId("hymn-corrido-item");
      expect(items).toHaveLength(2);
      expect(items[0].textContent ?? "").toContain("Verso 1");
      expect(items[0].textContent ?? "").toContain("Verso 2");
      expect(items[1].textContent ?? "").toContain("Linha A");
    });
  });

  describe("toggle pills (4D.10)", () => {
    it("são âncoras (não buttons) com href ?mode=...", () => {
      render(Page, { props: { data: sampleData } });
      const indice = screen.getByRole("link", { name: /índice/i });
      const corrido = screen.getByRole("link", { name: /corrido/i });
      const carrossel = screen.getByRole("link", { name: /carrossel/i });
      expect(indice.tagName).toBe("A");
      expect(corrido.tagName).toBe("A");
      expect(carrossel.tagName).toBe("A");
      expect(indice.getAttribute("href")).toBe("?mode=indice");
      expect(corrido.getAttribute("href")).toBe("?mode=corrido");
      expect(carrossel.getAttribute("href")).toBe("?mode=carrossel");
    });

    it("link do modo ativo tem aria-current='page'", () => {
      render(Page, { props: { data: { ...sampleData, mode: "corrido" } } });
      const corrido = screen.getByRole("link", { name: /corrido/i });
      const indice = screen.getByRole("link", { name: /índice/i });
      expect(corrido.getAttribute("aria-current")).toBe("page");
      expect(indice.getAttribute("aria-current")).toBeNull();
    });
  });
});
