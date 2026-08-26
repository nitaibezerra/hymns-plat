/**
 * Marco 5.B — Ciclos 5B.2 … 5B.7.
 *
 * Dashboard editorial: load + stats + card de retomada + chips de sort e
 * prioridade + fila de hinários com barras de progresso.
 *
 * Paridade de referência: `templates/hymns/editor/hymnbook_list.html`.
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import Page from "./+page.svelte";
import { _loadEditorDashboard } from "./+page";

import type { EditorDashboardData, EditorHymnbook } from "./+page";

const gotoMock = vi.fn();
vi.mock("$app/navigation", () => ({
  goto: (...args: unknown[]) => gotoMock(...args),
}));

function fakeFetch<T>(payload: T, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function editorUrl(search = "") {
  return new URL(`http://localhost/editor/${search}`);
}

function statsPayload(overrides: Record<string, unknown> = {}) {
  return {
    totalHinarios: 4,
    pendingHymns: 37,
    recentReviewed7d: 12,
    p1Count: 2,
    pendingAudiosCount: 5,
    resumeHymn: null,
    ...overrides,
  };
}

function bookPayload(overrides: Partial<EditorHymnbook> = {}): EditorHymnbook {
  return {
    id: "b1",
    name: "O Cruzeiro",
    slug: "o-cruzeiro",
    priority: "P1",
    isFeatured: false,
    isPublished: false,
    ownerName: "Mestre Irineu",
    createdAt: "2026-01-02T10:00:00Z",
    reviewProgress: { reviewPct: 40, stylePct: 60, repsPct: 20, audioPct: 10 },
    stats: { hymnsTotal: 30, hymnsReviewed: 12, audiosApproved: 3 },
    ...overrides,
  };
}

function dashboardPayload(
  books: EditorHymnbook[] = [bookPayload()],
  stats: Record<string, unknown> = statsPayload(),
) {
  return { data: { editorDashboardStats: stats, editorHymnbooks: books } };
}

describe("load do dashboard editorial (5B.2)", () => {
  it("pede editorDashboardStats e editorHymnbooks no mesmo documento", async () => {
    const fetchFn = fakeFetch(dashboardPayload());
    await _loadEditorDashboard({ fetch: fetchFn, url: editorUrl() });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.query).toMatch(/editorDashboardStats/);
    expect(body.query).toMatch(/editorHymnbooks\s*\(\s*sort\s*:\s*\$sort/);
  });

  it("manda priority='all' por default (o backend põe P1 primeiro)", async () => {
    const fetchFn = fakeFetch(dashboardPayload());
    await _loadEditorDashboard({ fetch: fetchFn, url: editorUrl() });
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.variables.priority).toBe("all");
  });

  it("devolve stats e fila de hinários prontos pra tela", async () => {
    const fetchFn = fakeFetch(dashboardPayload());
    const result = await _loadEditorDashboard({ fetch: fetchFn, url: editorUrl() });
    expect(result.stats.pendingHymns).toBe(37);
    expect(result.stats.p1Count).toBe(2);
    expect(result.hymnbooks).toHaveLength(1);
    expect(result.hymnbooks[0].name).toBe("O Cruzeiro");
    expect(result.error).toBeNull();
  });

  it("as 3 queries do workspace levantam erro pra não-editor: vira redirect, não tela vazia", async () => {
    const fetchFn = fakeFetch({
      data: null,
      errors: [{ message: "Você não tem permissão para realizar essa ação." }],
    });
    await expect(_loadEditorDashboard({ fetch: fetchFn, url: editorUrl() })).rejects.toMatchObject({
      status: 302,
      location: "/login?next=/editor/",
    });
  });

  it("erro técnico (HTTP 500) não redireciona — cai no campo error com stats zeradas", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    const result = await _loadEditorDashboard({ fetch: fetchFn, url: editorUrl() });
    expect(result.error).toMatch(/HTTP 500/);
    expect(result.hymnbooks).toEqual([]);
    expect(result.stats.pendingHymns).toBe(0);
  });
});

function buildData(overrides: Partial<EditorDashboardData> = {}): EditorDashboardData {
  return {
    stats: {
      totalHinarios: 4,
      pendingHymns: 37,
      recentReviewed7d: 12,
      p1Count: 2,
      pendingAudiosCount: 5,
      resumeHymn: null,
    },
    hymnbooks: [bookPayload()],
    sort: [],
    priority: "all",
    error: null,
    ...overrides,
  };
}

describe("render do dashboard editorial (5B.2)", () => {
  it("mostra o título 'Fila de revisão' com a face de display", () => {
    render(Page, { props: { data: buildData() } });
    const heading = screen.getByRole("heading", { level: 1, name: /fila de revisão/i });
    expect(heading).toBeInTheDocument();
    expect(heading.className).toMatch(/font-display/);
  });

  it("lista cada hinário com link pro detalhe do editor", () => {
    render(Page, { props: { data: buildData() } });
    const link = screen.getByRole("link", { name: /o cruzeiro/i });
    expect(link).toHaveAttribute("href", "/editor/hinarios/o-cruzeiro/");
  });

  it("mostra a autoria e a pílula de prioridade do hinário", () => {
    render(Page, { props: { data: buildData() } });
    const card = screen.getByTestId("queue-card-o-cruzeiro");
    expect(card).toHaveTextContent("Mestre Irineu");
    expect(card).toHaveTextContent(/P1 Urgente/i);
  });

  it("estado vazio explica que não há hinário na fila", () => {
    render(Page, { props: { data: buildData({ hymnbooks: [] }) } });
    expect(screen.getByTestId("queue-empty")).toHaveTextContent(/nenhum hinário/i);
  });

  it("estado vazio COM filtro de prioridade fala do filtro", () => {
    render(Page, { props: { data: buildData({ hymnbooks: [], priority: "P1" }) } });
    expect(screen.getByTestId("queue-empty")).toHaveTextContent(/prioridade/i);
  });

  it("erro do backend aparece como aviso em PT-BR", () => {
    render(Page, { props: { data: buildData({ error: "HTTP 500", hymnbooks: [] }) } });
    expect(screen.getByTestId("editor-error")).toHaveTextContent(/não foi possível carregar/i);
  });
});

describe("stats no dashboard (5B.3)", () => {
  it("o header hospeda a EditorStatsBar com os números do load", () => {
    render(Page, { props: { data: buildData() } });
    expect(screen.getByTestId("editor-stats-bar")).toBeInTheDocument();
    expect(screen.getByTestId("stat-value-pendentes")).toHaveTextContent("37");
    expect(screen.getByTestId("stat-value-p1")).toHaveTextContent("2");
  });
});
