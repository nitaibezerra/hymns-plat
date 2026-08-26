/**
 * Marco 5.B — Ciclos 5B.8 e 5B.9.
 *
 * Detalhe do hinário na visão do editor: load + cabeçalho com progresso +
 * lista de hinos com badge de status + botão "Próximo pendente".
 *
 * Paridade de referência: `templates/hymns/editor/hymnbook_detail.html`.
 */

import { fireEvent, render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Page from "./+page.svelte";
import { _loadEditorHymnbookDetail } from "./+page";

import type { EditorHymnbookDetail } from "./+page";

const gotoMock = vi.fn();
vi.mock("$app/navigation", () => ({
  goto: (...args: unknown[]) => gotoMock(...args),
}));

beforeEach(() => {
  gotoMock.mockClear();
});

function fakeFetch<T>(payload: T, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function hymnbookPayload(overrides: Partial<EditorHymnbookDetail> = {}): EditorHymnbookDetail {
  return {
    id: "b1",
    name: "O Cruzeiro",
    slug: "o-cruzeiro",
    ownerName: "Mestre Irineu",
    priority: "P1",
    isPublished: false,
    reviewProgress: { reviewPct: 40, stylePct: 60, repsPct: 20, audioPct: 10 },
    stats: { hymnsTotal: 30, hymnsReviewed: 12, audiosApproved: 3 },
    nextPendingHymn: { id: "h2", number: 2, title: "Estrela Brilhante" },
    hymns: [
      { id: "h1", number: 1, title: "Sol Lua Estrela", reviewStatus: "REVIEWED" },
      { id: "h2", number: 2, title: "Estrela Brilhante", reviewStatus: "IN_REVIEW" },
    ],
    ...overrides,
  };
}

describe("load do detalhe do hinário (5B.8)", () => {
  it("consulta hymnbook(slug:) com o slug da rota", async () => {
    const fetchFn = fakeFetch({ data: { hymnbook: hymnbookPayload() } });
    await _loadEditorHymnbookDetail({ fetch: fetchFn, params: { slug: "o-cruzeiro" } });

    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.query).toMatch(/hymnbook\s*\(\s*slug\s*:\s*\$slug/);
    expect(body.variables).toEqual({ slug: "o-cruzeiro" });
  });

  it("pede os hinos com reviewStatus e o próximo pendente", async () => {
    const fetchFn = fakeFetch({ data: { hymnbook: hymnbookPayload() } });
    await _loadEditorHymnbookDetail({ fetch: fetchFn, params: { slug: "o-cruzeiro" } });

    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.query).toMatch(/reviewStatus/);
    expect(body.query).toMatch(/nextPendingHymn/);
    expect(body.query).toMatch(/reviewProgress/);
  });

  it("devolve o hinário pronto pra tela", async () => {
    const fetchFn = fakeFetch({ data: { hymnbook: hymnbookPayload() } });
    const result = await _loadEditorHymnbookDetail({
      fetch: fetchFn,
      params: { slug: "o-cruzeiro" },
    });
    expect(result.hymnbook?.name).toBe("O Cruzeiro");
    expect(result.hymnbook?.hymns).toHaveLength(2);
    expect(result.error).toBeNull();
  });

  it("slug inexistente é 404, não tela em branco", async () => {
    const fetchFn = fakeFetch({ data: { hymnbook: null } });
    await expect(
      _loadEditorHymnbookDetail({ fetch: fetchFn, params: { slug: "nao-existe" } }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("erro de permissão redireciona pro login preservando o destino", async () => {
    const fetchFn = fakeFetch({
      data: { hymnbook: null },
      errors: [{ message: "Você não tem permissão para realizar essa ação." }],
    });
    await expect(
      _loadEditorHymnbookDetail({ fetch: fetchFn, params: { slug: "o-cruzeiro" } }),
    ).rejects.toMatchObject({
      status: 302,
      location: "/login?next=/editor/hinarios/o-cruzeiro/",
    });
  });

  it("erro técnico vira 503 com mensagem em PT-BR (não 404 enganoso)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    await expect(
      _loadEditorHymnbookDetail({ fetch: fetchFn, params: { slug: "o-cruzeiro" } }),
    ).rejects.toMatchObject({ status: 503 });
  });
});

/**
 * `PageData` soma o que o layout do editor e o shell raiz carregam
 * (`editor`, `currentUser`) ao retorno do load desta rota.
 */
function buildData(overrides: Partial<EditorHymnbookDetail> = {}) {
  return {
    editor: null,
    currentUser: null,
    hymnbook: hymnbookPayload(overrides),
    error: null,
  };
}

describe("render do detalhe do hinário (5B.8)", () => {
  it("mostra o nome do hinário como h1 em font-display", () => {
    render(Page, { props: { data: buildData() } });
    const heading = screen.getByRole("heading", { level: 1, name: /o cruzeiro/i });
    expect(heading.className).toMatch(/font-display/);
  });

  it("volta pra fila de revisão pela migalha", () => {
    render(Page, { props: { data: buildData() } });
    const back = screen.getByRole("link", { name: /fila de revisão/i });
    expect(back).toHaveAttribute("href", "/editor/");
  });

  it("mostra a autoria do hinário", () => {
    render(Page, { props: { data: buildData() } });
    expect(screen.getByTestId("detail-owner")).toHaveTextContent("Mestre Irineu");
  });

  it("mostra o progresso de revisão do backend, com contagem absoluta", () => {
    render(Page, { props: { data: buildData() } });
    const bar = screen.getByTestId("review-progress-bar");
    expect(bar).toHaveTextContent("40%");
    expect(screen.getByTestId("progress-count")).toHaveTextContent("12 de 30");
  });

  it("badge 'Rascunho' quando o hinário ainda não foi publicado", () => {
    render(Page, { props: { data: buildData() } });
    expect(screen.getByTestId("detail-draft-badge")).toHaveTextContent(/rascunho/i);
  });

  it("hinário publicado não mostra badge de rascunho", () => {
    render(Page, { props: { data: buildData({ isPublished: true }) } });
    expect(screen.queryByTestId("detail-draft-badge")).not.toBeInTheDocument();
  });

  it("lista os hinos com badge de status", () => {
    render(Page, { props: { data: buildData() } });
    expect(screen.getAllByTestId(/^hymn-row-/)).toHaveLength(2);
    expect(screen.getByTestId("hymn-badge-h1")).toHaveTextContent("Revisado");
    expect(screen.getByTestId("hymn-badge-h2")).toHaveTextContent("Em revisão");
  });

  it("cada hino leva pra sua tela de revisão", () => {
    render(Page, { props: { data: buildData() } });
    expect(screen.getByTestId("hymn-revise-h1")).toHaveAttribute(
      "href",
      "/editor/hinos/h1/revisar/",
    );
  });
});

describe("botão 'Próximo pendente' (5B.9)", () => {
  it("navega pra revisão do hino que o backend indicou", async () => {
    render(Page, { props: { data: buildData() } });
    await fireEvent.click(screen.getByTestId("next-pending"));

    expect(gotoMock).toHaveBeenCalledTimes(1);
    expect(gotoMock.mock.calls[0][0]).toBe("/editor/hinos/h2/revisar/");
  });

  it("diz qual é o próximo — número e título, sem surpresa no clique", () => {
    render(Page, { props: { data: buildData() } });
    const button = screen.getByTestId("next-pending");
    expect(button).toHaveTextContent(/próximo pendente/i);
    expect(button).toHaveAttribute("title", expect.stringContaining("Estrela Brilhante"));
  });

  it("hinário 100% revisado não tem próximo pendente: botão dá lugar ao aviso", () => {
    render(Page, { props: { data: buildData({ nextPendingHymn: null }) } });
    expect(screen.queryByTestId("next-pending")).not.toBeInTheDocument();
    expect(screen.getByTestId("all-reviewed")).toHaveTextContent(/tudo revisado/i);
  });

  it("é um <button> — a ação depende do dado do backend, não de uma URL adivinhada", () => {
    render(Page, { props: { data: buildData() } });
    expect(screen.getByTestId("next-pending").tagName).toBe("BUTTON");
  });
});
