/**
 * Marco 4.H — Ciclos 4H.1 a 4H.3.
 *
 * Load function da página de perfil + renderização da página.
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import { _loadProfile } from "./+page";
import Page from "./+page.svelte";

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

function buildData(overrides: Record<string, unknown> = {}) {
  return {
    userProfile: {
      user: { id: "u1", username: "ana", email: "ana@example.com" },
      followersCount: 12,
      followingCount: 3,
      uploadedAudios: [],
      activityHeatmap: [],
    },
    currentUser: null,
    error: null,
    ...overrides,
  };
}

describe("perfil/[username] página", () => {
  it("renderiza ProfileHeader com nome, contagens e iniciais (sem avatar)", () => {
    render(Page, { props: { data: buildData() } });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/ana/i);
    expect(screen.getByTestId("profile-followers-count")).toHaveTextContent("12");
    expect(screen.getByTestId("profile-following-count")).toHaveTextContent("3");
    expect(screen.getByTestId("profile-avatar")).toHaveTextContent(/AN/);
  });

  it("mostra botão Seguir quando há currentUser autenticado diferente do perfil", () => {
    render(Page, {
      props: {
        data: buildData({ currentUser: { id: "u2", username: "joao", email: "j@x" } }),
      },
    });
    expect(screen.getByRole("button", { name: /seguir/i })).toBeInTheDocument();
  });

  it("não mostra botão Seguir no próprio perfil", () => {
    render(Page, {
      props: {
        data: buildData({ currentUser: { id: "u1", username: "ana", email: "ana@example.com" } }),
      },
    });
    expect(screen.queryByRole("button", { name: /seguir/i })).toBeNull();
  });

  it("não mostra botão Seguir quando anônimo", () => {
    render(Page, { props: { data: buildData({ currentUser: null }) } });
    expect(screen.queryByRole("button", { name: /seguir/i })).toBeNull();
  });

  it("renderiza ProfileUploads com a grid de áudios uploaded", () => {
    const audios = [
      {
        id: "a1",
        url: "/m/1.mp3",
        durationSeconds: 120,
        waveformPeaks: [1, 2, 3],
        uploadedBy: { id: "u1", username: "ana", email: "ana@example.com" },
      },
      {
        id: "a2",
        url: "/m/2.mp3",
        durationSeconds: 60,
        waveformPeaks: [],
        uploadedBy: { id: "u1", username: "ana", email: "ana@example.com" },
      },
    ];
    render(Page, { props: { data: buildData({ userProfile: { ...buildData().userProfile, uploadedAudios: audios } }) } });
    const items = screen.getAllByTestId("profile-upload-item");
    expect(items).toHaveLength(2);
  });
});
