/**
 * Sub-marco 5.C — Ciclo 5C.16.
 *
 * `RevisionHistoryDrawer` lista `HymnType.revisions` — as linhas de auditoria
 * que `apps/hymns/signals.py` escreve a cada edição editorial.
 *
 * Contrato do `fieldDiff` (JSON): `{ <campo_django>: { old, new } }`, com os
 * nomes em snake_case de `_EDITORIAL_FIELDS`. O drawer traduz os nomes para
 * PT-BR e mostra cada mudança como "antes → depois".
 *
 * Ordem: mais recente primeiro. O resolver já devolve `-revised_at`, mas o
 * componente reordena por conta própria — a UI não depende da ordem do
 * servidor.
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import RevisionHistoryDrawer from "./RevisionHistoryDrawer.svelte";

const REVISIONS = [
  {
    id: "r-1",
    previousStatus: "not_reviewed",
    newStatus: "in_review",
    changeSummary: "Corrigi 2 typos do OCR",
    fieldDiff: { title: { old: "Estrela do Nortte", new: "Estrela do Norte" } },
    revisedAt: "2026-08-01T09:30:00",
    revisedBy: { id: "u-1", username: "ana" },
  },
  {
    id: "r-2",
    previousStatus: "in_review",
    newStatus: "reviewed",
    changeSummary: "",
    fieldDiff: {
      style: { old: "", new: "Valsa" },
      review_status: { old: "in_review", new: "reviewed" },
    },
    revisedAt: "2026-08-03T14:05:00",
    revisedBy: { id: "u-2", username: "bia" },
  },
];

describe("RevisionHistoryDrawer — 5C.16", () => {
  it("fechado, não renderiza nada", () => {
    render(RevisionHistoryDrawer, { props: { revisions: REVISIONS, open: false } });
    expect(screen.queryByTestId("revision-history-drawer")).toBeNull();
  });

  it("lista as revisões da mais recente para a mais antiga", () => {
    render(RevisionHistoryDrawer, { props: { revisions: REVISIONS, open: true } });
    const items = screen.getAllByTestId("revision-item");
    expect(items).toHaveLength(2);
    expect(items[0].dataset.revisionId).toBe("r-2");
    expect(items[1].dataset.revisionId).toBe("r-1");
  });

  it("mostra quem revisou e quando", () => {
    render(RevisionHistoryDrawer, { props: { revisions: REVISIONS, open: true } });
    const items = screen.getAllByTestId("revision-item");
    expect(items[0]).toHaveTextContent("bia");
    expect(items[0]).toHaveTextContent("03/08/2026 · 14:05");
    expect(items[1]).toHaveTextContent("ana");
    expect(items[1]).toHaveTextContent("01/08/2026 · 09:30");
  });

  it("mostra a transição de status em PT-BR", () => {
    render(RevisionHistoryDrawer, { props: { revisions: REVISIONS, open: true } });
    expect(screen.getAllByTestId("revision-status")[0]).toHaveTextContent(
      "Em revisão → Revisado",
    );
  });

  it("traduz os nomes dos campos e mostra antes → depois", () => {
    render(RevisionHistoryDrawer, { props: { revisions: REVISIONS, open: true } });
    const rows = screen.getAllByTestId("revision-field");
    const labels = rows.map((row) => row.dataset.field);
    expect(labels).toEqual(["style", "review_status", "title"]);
    expect(rows[0]).toHaveTextContent("Estilo");
    expect(rows[0]).toHaveTextContent("(vazio)");
    expect(rows[0]).toHaveTextContent("Valsa");
    expect(rows[2]).toHaveTextContent("Título");
    expect(rows[2]).toHaveTextContent("Estrela do Nortte");
  });

  it("mostra o resumo quando existe", () => {
    render(RevisionHistoryDrawer, { props: { revisions: REVISIONS, open: true } });
    expect(screen.getByTestId("revision-summary")).toHaveTextContent("Corrigi 2 typos do OCR");
  });

  it("revisão sem autor aparece como `sistema`", () => {
    render(RevisionHistoryDrawer, {
      props: {
        open: true,
        revisions: [
          {
            id: "r-0",
            previousStatus: "",
            newStatus: "not_reviewed",
            changeSummary: "Criado via OCR",
            fieldDiff: {},
            revisedAt: "2026-07-01T08:00:00",
            revisedBy: null,
          },
        ],
      },
    });
    expect(screen.getByTestId("revision-item")).toHaveTextContent("sistema");
    expect(screen.getByTestId("revision-status")).toHaveTextContent("— → Não revisado");
  });

  it("valores longos são truncados", () => {
    render(RevisionHistoryDrawer, {
      props: {
        open: true,
        revisions: [
          {
            id: "r-long",
            previousStatus: "in_review",
            newStatus: "in_review",
            changeSummary: "",
            fieldDiff: { text: { old: "a".repeat(200), new: "b".repeat(200) } },
            revisedAt: "2026-07-01T08:00:00",
            revisedBy: null,
          },
        ],
      },
    });
    const row = screen.getByTestId("revision-field");
    expect(row.textContent ?? "").toContain("…");
    expect(row.textContent ?? "").not.toContain("a".repeat(120));
  });

  it("sem revisões, mostra o estado vazio", () => {
    render(RevisionHistoryDrawer, { props: { revisions: [], open: true } });
    expect(screen.getByTestId("revision-history-empty")).toHaveTextContent(
      "Sem revisões registradas.",
    );
  });
});
