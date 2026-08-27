/**
 * Marco 5.B — Ciclo 5B.4.
 *
 * Card "Continuar revisão". Paridade com o bloco `{% if resume %}` de
 * `templates/hymns/editor/hymnbook_list.html`: faixa invertida (tinta de
 * fundo, papel na frente), glifo de retorno, hinário + número + título de
 * onde o editor parou, e a chamada "Retomar →".
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import ResumeCard from "./ResumeCard.svelte";

function hymn(overrides: Record<string, unknown> = {}) {
  return {
    id: "h9",
    number: 7,
    title: "Estrela Brilhante",
    hymnBook: { name: "O Cruzeiro", slug: "o-cruzeiro" },
    ...overrides,
  };
}

describe("ResumeCard (5B.4)", () => {
  it("anuncia 'Continuar revisão'", () => {
    render(ResumeCard, { props: { hymn: hymn(), href: "/editor/hinos/h9/revisar/" } });
    expect(screen.getByTestId("resume-card")).toHaveTextContent(/continuar revisão/i);
  });

  it("diz de onde o editor saiu: hinário, número e título do hino", () => {
    render(ResumeCard, { props: { hymn: hymn(), href: "/editor/hinos/h9/revisar/" } });
    const card = screen.getByTestId("resume-card");
    expect(card).toHaveTextContent("O Cruzeiro");
    expect(card).toHaveTextContent("7");
    expect(card).toHaveTextContent("Estrela Brilhante");
  });

  it("o card inteiro é o link — um clique só pra retomar", () => {
    render(ResumeCard, { props: { hymn: hymn(), href: "/editor/hinos/h9/revisar/" } });
    const card = screen.getByTestId("resume-card");
    expect(card.tagName).toBe("A");
    expect(card).toHaveAttribute("href", "/editor/hinos/h9/revisar/");
  });

  it("tem nome acessível próprio (não é só 'Retomar' solto pro leitor de tela)", () => {
    render(ResumeCard, { props: { hymn: hymn(), href: "/editor/hinos/h9/revisar/" } });
    const link = screen.getByRole("link", { name: /continuar revisão/i });
    expect(link).toBeInTheDocument();
  });

  it("mostra a chamada 'Retomar'", () => {
    render(ResumeCard, { props: { hymn: hymn(), href: "/editor/hinos/h9/revisar/" } });
    expect(screen.getByTestId("resume-cta")).toHaveTextContent(/retomar/i);
  });
});
