/**
 * Marco 3 — Ciclo 3.5 + Marco 4.C — Ciclos 4C.4 e 4C.5.
 *
 * Load function da lista de hinários + página com busca local e badge
 * de rascunho para editores autenticados.
 */

import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import { _loadHymnbooks } from "./+page";
import Page from "./+page.svelte";

function fakeFetch<T>(payload: T, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

const STATS = { hymnsTotal: 10, hymnsReviewed: 5, audiosApproved: 2 };

/**
 * Campos do card portados na Fase 4 da paridade visual. Declarados aqui num
 * lugar só porque todas as fixtures os espalham — e o tipo os exige, o que é o
 * ponto: fixture que não reflete o dado real esconde divergência de contrato.
 */
const CARD = {
  ownerName: "Mestre Irineu",
  createdAt: "2026-01-01T00:00:00Z",
  coverImage: null,
  displayAccent: "#1F5C4D",
};

const SAMPLE_HYMNBOOKS = [
  { id: "1", name: "O Cruzeiro", slug: "cruzeiro", isPublished: true, ...CARD, stats: STATS },
  { id: "2", name: "O Justiceiro", slug: "justiceiro", isPublished: true, ...CARD, stats: STATS },
  { id: "3", name: "Nova Era", slug: "nova-era", isPublished: true, ...CARD, stats: STATS },
  { id: "4", name: "Estação", slug: "estacao", isPublished: true, ...CARD, stats: STATS },
];

describe("hinarios load function", () => {
  it("returns the list of hymnbooks", async () => {
    const fetchFn = fakeFetch({ data: { hymnbooks: SAMPLE_HYMNBOOKS } });
    const result = await _loadHymnbooks({ fetch: fetchFn });
    expect(result.hymnbooks).toHaveLength(4);
    expect(result.hymnbooks[0].slug).toBe("cruzeiro");
    expect(result.error).toBeNull();
  });

  it("returns empty list when response has no hymnbooks", async () => {
    const fetchFn = fakeFetch({ data: { hymnbooks: [] } });
    const result = await _loadHymnbooks({ fetch: fetchFn });
    expect(result.hymnbooks).toEqual([]);
  });

  it("propagates HTTP errors", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    const result = await _loadHymnbooks({ fetch: fetchFn });
    expect(result.hymnbooks).toEqual([]);
    expect(result.error).toMatch(/HTTP 500/);
  });
});

describe("+page.svelte (lista de hinários)", () => {
  const baseData = {
    hymnbooks: SAMPLE_HYMNBOOKS,
    error: null,
    currentUser: null,
    editorPendingCount: 0,
  };

  it("renderiza um card por hinário", () => {
    render(Page, { props: { data: baseData } });
    const grid = screen.getByTestId("hymnbooks-grid");
    expect(within(grid).getAllByTestId("hymnbook-card")).toHaveLength(4);
  });

  it("filtra cards por nome conforme o usuário digita (case-insensitive)", async () => {
    render(Page, { props: { data: baseData } });
    const input = screen.getByTestId("hymnbook-search");
    await fireEvent.input(input, { target: { value: "JUSTI" } });
    const cards = within(screen.getByTestId("hymnbooks-grid")).getAllByTestId("hymnbook-card");
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toMatch(/justiceiro/i);
  });

  it("filtro é accent-insensitive ('estacao' encontra 'Estação')", async () => {
    render(Page, { props: { data: baseData } });
    const input = screen.getByTestId("hymnbook-search");
    await fireEvent.input(input, { target: { value: "estacao" } });
    const cards = within(screen.getByTestId("hymnbooks-grid")).getAllByTestId("hymnbook-card");
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toMatch(/estação/i);
  });

  it("mostra estado vazio quando o filtro não casa com nada", async () => {
    render(Page, { props: { data: baseData } });
    const input = screen.getByTestId("hymnbook-search");
    await fireEvent.input(input, { target: { value: "xyzpancake" } });
    expect(screen.getByTestId("empty-filter")).toBeInTheDocument();
    expect(screen.queryAllByTestId("hymnbook-card")).toHaveLength(0);
  });
});

describe("+page.svelte — badge rascunho (ciclo 4C.5)", () => {
  // Hinário NÃO publicado só chega na lista se o resolver `hymnbooks` autorizou
  // (i.e. user é editor/admin). A page apenas decide se renderiza o badge —
  // não duplica a regra de visibilidade.
  const STATS = { hymnsTotal: 5, hymnsReviewed: 2, audiosApproved: 0 };
  const draftBook = {
    id: "9",
    name: "Rascunho do Daime",
    slug: "rascunho-daime",
    isPublished: false,
    ...CARD,
    stats: STATS,
  };
  const publishedBook = {
    id: "10",
    name: "O Cruzeiro",
    slug: "cruzeiro",
    isPublished: true,
    ...CARD,
    stats: STATS,
  };

  it("usuário anônimo NÃO vê badge mesmo se rascunho aparecer na lista", () => {
    render(Page, {
      props: {
        data: { hymnbooks: [draftBook, publishedBook], error: null, currentUser: null, editorPendingCount: 0 },
      },
    });
    expect(screen.queryByTestId("draft-badge")).toBeNull();
  });

  it("editor autenticado vê badge 'rascunho' nos hinários não publicados", () => {
    render(Page, {
      props: {
        data: {
          hymnbooks: [draftBook, publishedBook],
          error: null,
          currentUser: { id: "u1", username: "editor", email: "e@x.com", isEditor: true },
          editorPendingCount: 0,
        },
      },
    });
    const badges = screen.getAllByTestId("draft-badge");
    expect(badges).toHaveLength(1);
    expect(badges[0].textContent?.toLowerCase()).toContain("rascunho");
    // o badge está no card do draft, não no card publicado.
    const draftCard = badges[0].closest("[data-testid='hymnbook-card']");
    expect(draftCard?.textContent).toMatch(/rascunho do daime/i);
  });
});
