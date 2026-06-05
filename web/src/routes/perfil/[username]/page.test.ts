/**
 * Marco 4.H — Ciclo 4H.1.
 *
 * Load function da página de perfil do usuário. Comportamentos:
 * - chama `userProfile(username)` no GraphQL passando `params.username`
 * - retorna o `userProfile` no payload
 * - retorna `userProfile = null` se backend devolver null
 * - propaga erros via `data.error`
 */

import { describe, expect, it, vi } from "vitest";

import { _loadProfile } from "./+page";

function fakeFetch<T>(payload: T, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("perfil/[username] load function", () => {
  it("retorna o perfil do usuário", async () => {
    const fetchFn = fakeFetch({
      data: {
        userProfile: {
          user: { id: "u1", username: "ana", email: "ana@example.com" },
          followersCount: 3,
          followingCount: 5,
          uploadedAudios: [],
          activityHeatmap: [],
        },
      },
    });
    const result = await _loadProfile({ fetch: fetchFn, params: { username: "ana" } });
    expect(result.userProfile?.user.username).toBe("ana");
    expect(result.userProfile?.followersCount).toBe(3);
    expect(result.userProfile?.followingCount).toBe(5);
    expect(result.error).toBeNull();
  });

  it("passa params.username como variável da query", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { userProfile: null } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await _loadProfile({ fetch: fetchFn, params: { username: "joao" } });
    const callBody = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(callBody.variables).toEqual({ username: "joao" });
  });

  it("retorna userProfile null quando o backend devolver null", async () => {
    const fetchFn = fakeFetch({ data: { userProfile: null } });
    const result = await _loadProfile({ fetch: fetchFn, params: { username: "ghost" } });
    expect(result.userProfile).toBeNull();
    expect(result.error).toBeNull();
  });

  it("propaga erros HTTP", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    const result = await _loadProfile({ fetch: fetchFn, params: { username: "ana" } });
    expect(result.userProfile).toBeNull();
    expect(result.error).toMatch(/HTTP 500/);
  });
});
