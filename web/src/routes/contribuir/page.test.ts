/**
 * Sub-marco 5.F — Ciclo 5F.5.
 *
 * `/contribuir/` porta uma view `@login_required`. O contrato:
 *
 *   - anônimo (`currentUser: null`) → redirect 302 pra `/login?next=/contribuir/`;
 *   - erro de auth vindo do GraphQL → mesmo redirect;
 *   - autenticado → devolve o usuário pra página;
 *   - erro HTTP não é confundido com auth (não redireciona; vira `data.error`).
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import Page from "./+page.svelte";
import { _loadContribuir } from "./+page";

function fakeFetch<T>(payload: T, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("contribuir guard de autenticação (5F.5)", () => {
  it("anônimo é redirecionado pra /login?next=/contribuir/", async () => {
    const fetchFn = fakeFetch({ data: { currentUser: null } });
    await expect(_loadContribuir({ fetch: fetchFn })).rejects.toMatchObject({
      status: 302,
      location: "/login?next=/contribuir/",
    });
  });

  it("erro de auth do GraphQL também redireciona", async () => {
    const fetchFn = fakeFetch({
      data: { currentUser: null },
      errors: [{ message: "User must be authenticated" }],
    });
    await expect(_loadContribuir({ fetch: fetchFn })).rejects.toMatchObject({
      status: 302,
      location: "/login?next=/contribuir/",
    });
  });

  it("autenticado recebe o currentUser", async () => {
    const fetchFn = fakeFetch({ data: { currentUser: { id: "1", username: "maria" } } });
    const result = await _loadContribuir({ fetch: fetchFn });
    expect(result.currentUser).toEqual({ id: "1", username: "maria" });
    expect(result.error).toBeNull();
  });

  it("erro HTTP não vira redirect — vira data.error", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    const result = await _loadContribuir({ fetch: fetchFn });
    expect(result.error).toMatch(/HTTP 500/);
  });
});

describe("contribuir page (5F.5)", () => {
  it("renderiza o cabeçalho do wizard", () => {
    render(Page, { props: { data: { currentUser: { id: "1", username: "maria" }, error: null } } });
    expect(screen.getByTestId("contribuir-page")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/PDF/i);
  });
});
