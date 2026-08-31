/**
 * Marco 4.B — Ciclo 4B.6.
 * Fase 2 da paridade visual (2026-08-31).
 *
 * Trava a paridade com `templates/_partials/_footer.html`. As duas asserções
 * anteriores exigiam "hinária" em minúsculas e um link pro GitHub — conteúdo
 * que o monolito não tem, então eram testes defendendo a divergência.
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import Footer from "./Footer.svelte";

describe("Footer", () => {
  it("renderiza a assinatura do monolito", () => {
    render(Footer);
    const footer = screen.getByTestId("site-footer");
    expect(footer).toBeInTheDocument();
    expect(footer.textContent ?? "").toContain("HINARIA · HINARIA.COM.BR");
  });

  it("renderiza a epígrafe", () => {
    render(Footer);
    expect(
      screen.getByText(/Hinários para ouvir, estudar e cantar com firmeza/),
    ).toBeInTheDocument();
  });

  it("NÃO tem link pro GitHub — o monolito não tem", () => {
    // Paridade é o critério: um link a mais é um link a mais de diff. Se ele
    // fizer falta, entra nos DOIS lados no mesmo commit.
    render(Footer);
    expect(screen.queryByRole("link", { name: /github/i })).toBeNull();
  });

  it("sai da impressão, como no monolito (`data-no-print`)", () => {
    render(Footer);
    expect(screen.getByTestId("site-footer")).toHaveAttribute("data-no-print");
  });
});
