/**
 * Marco 4.D — Testes de integração da página do hinário.
 *
 * Cobre os 3 modos (índice/corrido/carrossel) renderizados via `+page.svelte`.
 * Cada ciclo TDD vai adicionando blocos a este arquivo.
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import Page from "./+page.svelte";
import type { HymnbookDetailData } from "./+page";

const sampleData: HymnbookDetailData = {
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
});
