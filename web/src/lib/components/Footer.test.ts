/**
 * Marco 4.B — Ciclo 4B.6.
 *
 * Footer global mostra créditos e link pro GitHub do projeto.
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import Footer from "./Footer.svelte";

describe("Footer", () => {
  it("renderiza créditos do projeto", () => {
    render(Footer);
    const footer = screen.getByTestId("site-footer");
    expect(footer).toBeInTheDocument();
    expect(footer.textContent ?? "").toMatch(/hinária/i);
  });

  it("renderiza link pro GitHub do projeto", () => {
    render(Footer);
    const link = screen.getByRole("link", { name: /github/i });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toMatch(/github\.com/);
  });
});
