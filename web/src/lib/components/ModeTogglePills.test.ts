/**
 * Marco 4.D — Ciclo 4D.10.
 *
 * ModeTogglePills — pills de alternância entre os modos (índice/corrido/
 * carrossel). Decisão herdada: pills são âncoras `<a href="?mode=...">` (NÃO
 * botões), preservando o comportamento URL-driven do monolito. Modo ativo
 * recebe `aria-current="page"`.
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import ModeTogglePills from "./ModeTogglePills.svelte";

describe("ModeTogglePills", () => {
  it("renderiza três pills como links (não buttons)", () => {
    render(ModeTogglePills, { props: { mode: "indice" } });
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    // Garante que nenhum dos elementos é <button>
    for (const link of links) {
      expect(link.tagName).toBe("A");
    }
  });

  it("cada pill aponta para ?mode=<value>", () => {
    render(ModeTogglePills, { props: { mode: "indice" } });
    const indice = screen.getByRole("link", { name: /índice/i });
    const corrido = screen.getByRole("link", { name: /corrido/i });
    const carrossel = screen.getByRole("link", { name: /carrossel/i });
    expect(indice.getAttribute("href")).toBe("?mode=indice");
    expect(corrido.getAttribute("href")).toBe("?mode=corrido");
    expect(carrossel.getAttribute("href")).toBe("?mode=carrossel");
  });

  it("aplica aria-current='page' no modo ativo", () => {
    render(ModeTogglePills, { props: { mode: "corrido" } });
    const corrido = screen.getByRole("link", { name: /corrido/i });
    const indice = screen.getByRole("link", { name: /índice/i });
    expect(corrido.getAttribute("aria-current")).toBe("page");
    expect(indice.getAttribute("aria-current")).toBeNull();
  });

  it("permite trocar o modo ativo via prop", () => {
    const { rerender } = render(ModeTogglePills, { props: { mode: "indice" } });
    let indice = screen.getByRole("link", { name: /índice/i });
    expect(indice.getAttribute("aria-current")).toBe("page");
    rerender({ mode: "carrossel" });
    indice = screen.getByRole("link", { name: /índice/i });
    const carrossel = screen.getByRole("link", { name: /carrossel/i });
    expect(indice.getAttribute("aria-current")).toBeNull();
    expect(carrossel.getAttribute("aria-current")).toBe("page");
  });
});
