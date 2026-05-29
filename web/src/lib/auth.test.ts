/**
 * Marco 3 — Ciclo 3.6 (unit).
 *
 * `loginWithPassword` decodifica o union LoginResult do schema GraphQL em um
 * resultado discriminado simples (`{ ok: true, user } | { ok: false, message }`).
 * O componente de formulário só lida com esses dois casos.
 */

import { describe, expect, it, vi } from "vitest";

import { loginWithPassword } from "./auth";

function fakeFetch<T>(payload: T, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("loginWithPassword", () => {
  it("returns ok=true with user data on success", async () => {
    const fetchFn = fakeFetch({
      data: {
        login: { __typename: "LoginSuccess", user: { id: "u1", username: "ana", email: "ana@example.com" } },
      },
    });
    const result = await loginWithPassword(fetchFn, "ana", "senha");
    expect(result).toEqual({
      ok: true,
      user: { id: "u1", username: "ana", email: "ana@example.com" },
    });
  });

  it("returns ok=false with message on invalid credentials", async () => {
    const fetchFn = fakeFetch({
      data: { login: { __typename: "LoginError", message: "Credenciais inválidas." } },
    });
    const result = await loginWithPassword(fetchFn, "ana", "errado");
    expect(result).toEqual({ ok: false, message: "Credenciais inválidas." });
  });

  it("returns ok=false when GraphQL transport fails", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    const result = await loginWithPassword(fetchFn, "ana", "x");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/HTTP 500/);
  });
});
