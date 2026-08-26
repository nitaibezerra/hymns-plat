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

describe("sort multi-critério vindo da URL (5B.5)", () => {
  it("traduz ?sort=review:asc,audio:desc em SortInput[] na ordem clicada", async () => {
    const fetchFn = fakeFetch(dashboardPayload());
    await _loadEditorDashboard({
      fetch: fetchFn,
      url: editorUrl("?sort=review:asc,audio:desc"),
    });

    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.variables.sort).toEqual([
      { column: "review", direction: "asc" },
      { column: "audio", direction: "desc" },
    ]);
  });

  it("sem ?sort= manda null — o argumento é opcional no schema", async () => {
    const fetchFn = fakeFetch(dashboardPayload());
    await _loadEditorDashboard({ fetch: fetchFn, url: editorUrl() });
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.variables.sort).toBeNull();
  });

  it("?sort= malformado não derruba a página — cai no default", async () => {
    const fetchFn = fakeFetch(dashboardPayload());
    const result = await _loadEditorDashboard({
      fetch: fetchFn,
      url: editorUrl("?sort=review_pct:crescente"),
    });
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.variables.sort).toBeNull();
    expect(result.sort).toEqual([]);
  });

  it("devolve os pares parseados pra tela pintar o estado das chips", async () => {
    const fetchFn = fakeFetch(dashboardPayload());
    const result = await _loadEditorDashboard({
      fetch: fetchFn,
      url: editorUrl("?sort=audio:desc"),
    });
    expect(result.sort).toEqual([["audio", "desc"]]);
  });

  it("a tela mostra a fileira de chips com o estado atual e a contagem", () => {
    render(Page, { props: { data: buildData({ sort: [["review", "asc"]] }) } });
    expect(screen.getByTestId("sort-chips")).toBeInTheDocument();
    expect(screen.getByTestId("sort-chip-review")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("sort-count")).toHaveTextContent("1 hinário");
  });
});

describe("barras de progresso no card (5B.7)", () => {
  it("mostra as 4 barras: revisão formal + estilo/repetições/áudios", () => {
    render(Page, { props: { data: buildData() } });
    const card = screen.getByTestId("queue-card-o-cruzeiro");
    expect(card.querySelectorAll("[data-testid='review-progress-bar']")).toHaveLength(4);
    expect(card).toHaveTextContent(/revisados/i);
    expect(card).toHaveTextContent(/estilo/i);
    expect(card).toHaveTextContent(/repetições/i);
    expect(card).toHaveTextContent(/áudios/i);
  });

  it("usa os percentuais de reviewProgress SEM recalcular a partir de stats", () => {
    // stats diz 12/30 (=40%) mas o backend calculou 77% — a tela obedece o
    // backend, que é a fonte única desses percentuais desde o 5.A½.
    const book = bookPayload({
      reviewProgress: { reviewPct: 77, stylePct: 60, repsPct: 20, audioPct: 10 },
      stats: { hymnsTotal: 30, hymnsReviewed: 12, audiosApproved: 3 },
    });
    render(Page, { props: { data: buildData({ hymnbooks: [book] }) } });

    const card = screen.getByTestId("queue-card-o-cruzeiro");
    const bars = card.querySelectorAll("[data-testid='review-progress-bar']");
    expect(bars[0].textContent).toContain("77%");
    expect(bars[0].textContent).not.toContain("40%");
  });

  it("a barra de revisão traz a contagem absoluta ao lado do percentual", () => {
    render(Page, { props: { data: buildData() } });
    const card = screen.getByTestId("queue-card-o-cruzeiro");
    expect(card.querySelector("[data-testid='progress-count']")).toHaveTextContent("12 de 30");
  });

  it("a barra de revisão é o tom primário; as de completude, o secundário", () => {
    render(Page, { props: { data: buildData() } });
    const card = screen.getByTestId("queue-card-o-cruzeiro");
    const bars = Array.from(card.querySelectorAll("[data-testid='review-progress-bar']"));
    expect(bars[0].className).toMatch(/is-review/);
    expect(bars.slice(1).every((b) => b.className.includes("is-content"))).toBe(true);
  });

  it("as duas seções são rotuladas como no template Django", () => {
    render(Page, { props: { data: buildData() } });
    const card = screen.getByTestId("queue-card-o-cruzeiro");
    expect(card).toHaveTextContent(/revisão formal/i);
    expect(card).toHaveTextContent(/completude de conteúdo/i);
  });
});

describe("filtro de prioridade vindo da URL (5B.6)", () => {
  it("?priority=P1 vai como argumento pra query", async () => {
    const fetchFn = fakeFetch(dashboardPayload());
    const result = await _loadEditorDashboard({ fetch: fetchFn, url: editorUrl("?priority=P1") });

    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.variables.priority).toBe("P1");
    expect(result.priority).toBe("P1");
  });

  it("prioridade desconhecida cai pra 'all' — o argumento é String! e não aceita lixo", async () => {
    const fetchFn = fakeFetch(dashboardPayload());
    const result = await _loadEditorDashboard({
      fetch: fetchFn,
      url: editorUrl("?priority=urgentissimo"),
    });
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.variables.priority).toBe("all");
    expect(result.priority).toBe("all");
  });

  it("sort e prioridade convivem na mesma URL", async () => {
    const fetchFn = fakeFetch(dashboardPayload());
    await _loadEditorDashboard({
      fetch: fetchFn,
      url: editorUrl("?priority=P2&sort=audio:asc"),
    });
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.variables.priority).toBe("P2");
    expect(body.variables.sort).toEqual([{ column: "audio", direction: "asc" }]);
  });

  it("a tela mostra a fileira de prioridade com a chip ativa", () => {
    render(Page, { props: { data: buildData({ priority: "P1" }) } });
    expect(screen.getByTestId("priority-chips")).toBeInTheDocument();
    expect(screen.getByTestId("priority-chip-P1")).toHaveAttribute("aria-current", "true");
  });
});

describe("card de retomada no dashboard (5B.4)", () => {
  const resumeHymn = {
    id: "h9",
    number: 7,
    title: "Estrela Brilhante",
    hymnBook: { name: "O Cruzeiro", slug: "o-cruzeiro" },
  };

  it("aparece quando resumeHymn não é nulo, apontando pra tela de revisão do hino", () => {
    const data = buildData();
    data.stats.resumeHymn = resumeHymn;
    render(Page, { props: { data } });

    const card = screen.getByTestId("resume-card");
    expect(card).toHaveAttribute("href", "/editor/hinos/h9/revisar/");
    expect(card).toHaveTextContent("Estrela Brilhante");
  });

  it("não aparece quando resumeHymn é nulo — nada a retomar, nada a mostrar", () => {
    render(Page, { props: { data: buildData() } });
    expect(screen.queryByTestId("resume-card")).not.toBeInTheDocument();
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
