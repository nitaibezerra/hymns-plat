/**
 * Marco 4.B — Ciclo 4B.5.
 *
 * ThemeToggle alterna a paleta da página entre "light" e "dark":
 *
 *   - O atributo `data-theme` no `<html>` controla qual bloco de tokens
 *     CSS está ativo (`:root` vs `:root[data-theme="dark"]` — ver
 *     ciclo 4B.3).
 *   - A escolha persiste em `localStorage` na chave `hinaria-theme`,
 *     para sobreviver a reloads e à navegação entre rotas.
 *
 * Os testes exercitam o componente isolado: clica, observa o atributo
 * no `<html>` e observa o `localStorage`.
 */

import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import ThemeToggle from "./ThemeToggle.svelte";

const STORAGE_KEY = "hinaria-theme";

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("define data-theme=light no <html> ao montar quando não há preferência salva", () => {
    render(ThemeToggle);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("alterna data-theme entre light e dark a cada clique", async () => {
    render(ThemeToggle);
    const button = screen.getByTestId("theme-toggle");

    await fireEvent.click(button);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    await fireEvent.click(button);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("persiste a escolha em localStorage na chave hinaria-theme", async () => {
    render(ThemeToggle);
    const button = screen.getByTestId("theme-toggle");

    await fireEvent.click(button);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");

    await fireEvent.click(button);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("light");
  });

  it("respeita a escolha salva ao montar", () => {
    localStorage.setItem(STORAGE_KEY, "dark");
    render(ThemeToggle);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
