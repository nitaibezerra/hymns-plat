/**
 * Sub-marco 5.C — Ciclos 5C.2 e 5C.3.
 *
 * `InlineDiff` renderiza `HymnType.inlineDiff` (diff OCR × texto revisado em
 * duas camadas: linha → palavra). Espelha `.diff-inline` de
 * `static/css/components.css` e o bloco `editorView === "diff"` do design
 * `_design/fase2-bundle/project/screens/revise-hymn.jsx`.
 *
 * Contrato de marcação:
 *   - linha `eq`      → sem destaque
 *   - linha `replace`  → tokens `eq`/`sub`/`add`/`del` inline
 *   - linha `add`      → linha inteira em verde
 *   - linha `del`      → linha inteira em vermelho, tachada
 *   - token `sub`      → `<del>` (texto do OCR) + `<ins>` (texto revisado)
 *
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import InlineDiff from "./InlineDiff.svelte";

const DIFF = {
  changes: 2,
  adds: 1,
  dels: 1,
  lines: [
    { kind: "eq", tokens: [{ kind: "eq", text: "Sol da manhã", sub: null, add: null }] },
    {
      kind: "replace",
      tokens: [
        { kind: "eq", text: "Que ", sub: null, add: null },
        { kind: "sub", text: null, sub: "iluminna", add: "ilumina" },
      ],
    },
    {
      kind: "replace",
      tokens: [
        { kind: "eq", text: "O meu coraç", sub: null, add: null },
        { kind: "sub", text: null, sub: "ao", add: "ão" },
        { kind: "del", text: " sempre", sub: null, add: null },
        { kind: "add", text: " agora", sub: null, add: null },
      ],
    },
    { kind: "add", tokens: [{ kind: "add", text: "Na hora da oração", sub: null, add: null }] },
    { kind: "del", tokens: [{ kind: "del", text: "Linha que saiu", sub: null, add: null }] },
  ],
};

describe("InlineDiff — 5C.2", () => {
  it("renderiza uma linha por entrada do diff, marcada pelo kind", () => {
    render(InlineDiff, { props: { diff: DIFF } });
    const lines = screen.getAllByTestId("diff-line");
    expect(lines).toHaveLength(5);
    expect(lines.map((el) => el.dataset.kind)).toEqual(["eq", "replace", "replace", "add", "del"]);
  });

  it("token `sub` vira <del> com o texto do OCR e <ins> com o revisado", () => {
    const { container } = render(InlineDiff, { props: { diff: DIFF } });
    const removed = Array.from(container.querySelectorAll("del")).map((el) => el.textContent);
    const inserted = Array.from(container.querySelectorAll("ins")).map((el) => el.textContent);
    expect(removed).toContain("iluminna");
    expect(inserted).toContain("ilumina");
  });

  it("tokens `add` e `del` isolados também aparecem marcados", () => {
    render(InlineDiff, { props: { diff: DIFF } });
    const tokens = screen.getAllByTestId("diff-token");
    const kinds = tokens.map((el) => el.dataset.kind);
    expect(kinds).toContain("add");
    expect(kinds).toContain("del");
    expect(kinds).toContain("eq");
  });

  it("linhas `add`/`del` inteiras carregam o kind na linha", () => {
    render(InlineDiff, { props: { diff: DIFF } });
    const lines = screen.getAllByTestId("diff-line");
    expect(lines[3]).toHaveTextContent("Na hora da oração");
    expect(lines[4]).toHaveTextContent("Linha que saiu");
  });

  it("sem diff (hino sem OCR) mostra o estado vazio", () => {
    render(InlineDiff, { props: { diff: null } });
    expect(screen.getByTestId("diff-empty")).toHaveTextContent("Sem OCR para comparar.");
    expect(screen.queryAllByTestId("diff-line")).toHaveLength(0);
  });
});

describe("InlineDiff — 5C.3 (badges de contagem)", () => {
  it("exibe badges de substituições, acréscimos e remoções", () => {
    render(InlineDiff, { props: { diff: DIFF } });
    expect(screen.getByTestId("diff-count-changes")).toHaveTextContent("2 substituições");
    expect(screen.getByTestId("diff-count-adds")).toHaveTextContent("1 adição");
    expect(screen.getByTestId("diff-count-dels")).toHaveTextContent("1 remoção");
  });

  it("pluraliza em PT-BR conforme a contagem", () => {
    render(InlineDiff, {
      props: { diff: { changes: 1, adds: 0, dels: 3, lines: DIFF.lines } },
    });
    expect(screen.getByTestId("diff-count-changes")).toHaveTextContent("1 substituição");
    expect(screen.getByTestId("diff-count-adds")).toHaveTextContent("0 adições");
    expect(screen.getByTestId("diff-count-dels")).toHaveTextContent("3 remoções");
  });

  it("estado vazio não mostra badges", () => {
    render(InlineDiff, { props: { diff: null } });
    expect(screen.queryByTestId("diff-count-changes")).toBeNull();
  });
});
