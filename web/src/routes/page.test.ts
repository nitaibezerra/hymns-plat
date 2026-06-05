/**
 * Marco 3 — Ciclo 3.4 (parte 2) + Marco 4.C — Ciclo 4C.1.
 *
 * A load function da home consome `globalStats` E `hourlyFeatured` do GraphQL
 * e expõe `stats` + `featured` + `error`. Quando a API responde 200 com dados,
 * `stats` e `featured` são preenchidos. Erros (HTTP ou GraphQL) caem em `error`.
 *
 * O `_loadHome` faz as duas queries em paralelo (`Promise.all`) — a home não
 * deve esperar uma terminar pra começar a outra.
 */

import { render, screen, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import { _loadHome } from "./+page";
import Page from "./+page.svelte";

interface RecordedRequest {
  body: string;
}

function makeFetchSequence(payloads: Array<{ payload: unknown; status?: number }>) {
  const calls: RecordedRequest[] = [];
  const fn = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = typeof init?.body === "string" ? init.body : "";
    calls.push({ body });
    const next = payloads.shift();
    if (!next) throw new Error("fetch chamado mais vezes que o esperado");
    return new Response(JSON.stringify(next.payload), {
      status: next.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  return { fn, calls };
}

const STATS_PAYLOAD = {
  data: { globalStats: { hymnbooks: 7, hymns: 200, audios: 50, activeReviewers: 3 } },
};

const FEATURED_PAYLOAD = {
  data: {
    hourlyFeatured: [
      {
        id: "1",
        name: "O Cruzeiro",
        slug: "cruzeiro",
        isPublished: true,
        stats: { hymnsTotal: 132, hymnsReviewed: 80, audiosApproved: 40 },
      },
      {
        id: "2",
        name: "O Justiceiro",
        slug: "justiceiro",
        isPublished: true,
        stats: { hymnsTotal: 56, hymnsReviewed: 50, audiosApproved: 20 },
      },
      {
        id: "3",
        name: "Nova Era",
        slug: "nova-era",
        isPublished: true,
        stats: { hymnsTotal: 99, hymnsReviewed: 30, audiosApproved: 12 },
      },
      {
        id: "4",
        name: "Estrela Brilhante",
        slug: "estrela-brilhante",
        isPublished: true,
        stats: { hymnsTotal: 70, hymnsReviewed: 70, audiosApproved: 70 },
      },
      {
        id: "5",
        name: "Mestre Irineu",
        slug: "mestre-irineu",
        isPublished: true,
        stats: { hymnsTotal: 30, hymnsReviewed: 30, audiosApproved: 30 },
      },
      {
        id: "6",
        name: "Padrinho Sebastião",
        slug: "padrinho-sebastiao",
        isPublished: true,
        stats: { hymnsTotal: 12, hymnsReviewed: 6, audiosApproved: 3 },
      },
    ],
  },
};

describe("home load function", () => {
  it("populates stats from a successful response", async () => {
    const { fn } = makeFetchSequence([
      { payload: STATS_PAYLOAD },
      { payload: FEATURED_PAYLOAD },
    ]);
    const result = await _loadHome({ fetch: fn });
    expect(result.stats).toEqual({ hymnbooks: 7, hymns: 200, audios: 50, activeReviewers: 3 });
    expect(result.error).toBeNull();
  });

  it("retorna até 6 hinários em destaque (hourlyFeatured)", async () => {
    const { fn, calls } = makeFetchSequence([
      { payload: STATS_PAYLOAD },
      { payload: FEATURED_PAYLOAD },
    ]);
    const result = await _loadHome({ fetch: fn });
    expect(result.featured).toHaveLength(6);
    expect(result.featured[0]).toMatchObject({
      id: "1",
      name: "O Cruzeiro",
      slug: "cruzeiro",
      stats: { hymnsTotal: 132, hymnsReviewed: 80, audiosApproved: 40 },
    });
    // Garante que as duas queries foram disparadas.
    const queries = calls.map((c) => c.body);
    expect(queries.some((b) => b.includes("GlobalStats"))).toBe(true);
    expect(queries.some((b) => b.includes("HourlyFeatured"))).toBe(true);
  });

  it("retorna featured=[] quando hourlyFeatured falha mas globalStats responde", async () => {
    const { fn } = makeFetchSequence([
      { payload: STATS_PAYLOAD },
      { payload: "", status: 500 },
    ]);
    const result = await _loadHome({ fetch: fn });
    expect(result.stats).not.toBeNull();
    expect(result.featured).toEqual([]);
  });

  it("propagates HTTP errors in `error`", async () => {
    const { fn } = makeFetchSequence([
      { payload: "", status: 500 },
      { payload: FEATURED_PAYLOAD },
    ]);
    const result = await _loadHome({ fetch: fn });
    expect(result.stats).toBeNull();
    expect(result.error).toMatch(/HTTP 500/);
  });
});

describe("+page.svelte (home)", () => {
  const baseData = {
    stats: { hymnbooks: 7, hymns: 200, audios: 50, activeReviewers: 3 },
    featured: FEATURED_PAYLOAD.data.hourlyFeatured,
    error: null,
  };

  it("renderiza bloco hero com slogan e CTA 'Explorar hinários'", () => {
    render(Page, { props: { data: baseData } });
    const hero = screen.getByTestId("home-hero");
    expect(hero).toBeInTheDocument();
    expect(hero.textContent).toMatch(/com firmeza/i);
    const cta = within(hero).getByRole("link", { name: /explorar hinários/i });
    expect(cta.getAttribute("href")).toBe("/hinarios");
  });

  it("aplica font-display no título do hero", () => {
    render(Page, { props: { data: baseData } });
    const heroTitle = screen.getByTestId("home-hero-title");
    expect(heroTitle.className).toMatch(/font-display/);
  });

  it("renderiza grid com os 6 hinários em destaque", () => {
    render(Page, { props: { data: baseData } });
    const grid = screen.getByTestId("home-featured-grid");
    const cards = within(grid).getAllByTestId("hymnbook-card");
    expect(cards).toHaveLength(6);
  });

  it("mostra os stats globais no hero", () => {
    render(Page, { props: { data: baseData } });
    const hero = screen.getByTestId("home-hero");
    expect(within(hero).getByTestId("stat-hymnbooks")).toHaveTextContent("7");
    expect(within(hero).getByTestId("stat-hymns")).toHaveTextContent("200");
    expect(within(hero).getByTestId("stat-audios")).toHaveTextContent("50");
    expect(within(hero).getByTestId("stat-reviewers")).toHaveTextContent("3");
  });

  it("mostra mensagem de erro quando stats falham", () => {
    render(Page, {
      props: {
        data: { stats: null, featured: [], error: "HTTP 500" },
      },
    });
    expect(screen.getByTestId("error")).toHaveTextContent(/HTTP 500/);
  });
});
