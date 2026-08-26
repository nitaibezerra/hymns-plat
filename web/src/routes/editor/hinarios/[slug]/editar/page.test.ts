/**
 * Sub-marco 5.D — Ciclos 5D.3 e 5D.4.
 *
 * 5D.3 — `/editor/hinarios/[slug]/editar/` pré-popula o form com os dados do
 * hinário (campos que o 5.A½ expôs em `HymnBookType`: `description`,
 * `ownerName`, `introName`, `coverImage`).
 */

import { render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { _loadEditarHymnBook } from "./+page";
import Page from "./+page.svelte";

const goto = vi.fn();
vi.mock("$app/navigation", () => ({
  goto: (...args: unknown[]) => goto(...args),
}));

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const HYMNBOOK = {
  id: "hb1",
  name: "O Cruzeiro",
  slug: "cruzeiro",
  introName: "Cruzeiro",
  ownerName: "Mestre Irineu",
  description: "Hinário do Mestre",
  coverImage: "/media/capas/cruzeiro.png",
  isPublished: false,
};

/**
 * A load function faz duas chamadas: guard (`currentUser`) e o hinário.
 * O fake devolve as respostas em ordem.
 */
function sequenceFetch(...payloads: unknown[]) {
  const fn = vi.fn();
  payloads.forEach((p) => fn.mockResolvedValueOnce(jsonResponse(p)));
  return fn;
}

function guardPayload(isEditor = true) {
  return { data: { currentUser: { id: "u1", username: "ana", isEditor } } };
}

beforeEach(() => {
  goto.mockReset();
});

describe("/editor/hinarios/[slug]/editar — load (5D.3)", () => {
  it("busca o hinário pelo slug da rota", async () => {
    const fetchFn = sequenceFetch(guardPayload(), { data: { hymnbook: HYMNBOOK } });
    await _loadEditarHymnBook({ fetch: fetchFn, params: { slug: "cruzeiro" } });
    const body = JSON.parse(fetchFn.mock.calls[1][1].body as string);
    expect(body.variables).toEqual({ slug: "cruzeiro" });
    expect(body.query).toContain("hymnbook");
  });

  it("devolve os campos do hinário pro form", async () => {
    const fetchFn = sequenceFetch(guardPayload(), { data: { hymnbook: HYMNBOOK } });
    const result = await _loadEditarHymnBook({ fetch: fetchFn, params: { slug: "cruzeiro" } });
    expect(result.hymnbook).toMatchObject({
      name: "O Cruzeiro",
      ownerName: "Mestre Irineu",
      introName: "Cruzeiro",
      description: "Hinário do Mestre",
      coverImage: "/media/capas/cruzeiro.png",
    });
    expect(result.forbidden).toBe(false);
  });

  it("não busca o hinário quando o usuário não é editor", async () => {
    const fetchFn = sequenceFetch(guardPayload(false));
    const result = await _loadEditarHymnBook({ fetch: fetchFn, params: { slug: "cruzeiro" } });
    expect(result.forbidden).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("redireciona anônimo pra /login preservando o destino", async () => {
    const fetchFn = sequenceFetch({ data: { currentUser: null } });
    await expect(
      _loadEditarHymnBook({ fetch: fetchFn, params: { slug: "cruzeiro" } }),
    ).rejects.toMatchObject({
      status: 302,
      location: "/login?next=/editor/hinarios/cruzeiro/editar/",
    });
  });
});

function buildData(overrides: Record<string, unknown> = {}) {
  return { hymnbook: HYMNBOOK, slug: "cruzeiro", forbidden: false, error: null, ...overrides };
}

describe("/editor/hinarios/[slug]/editar — form pré-populado (5D.3)", () => {
  it("pré-popula os campos de texto com os valores do hinário", () => {
    render(Page, { props: { data: buildData() } });
    expect(screen.getByLabelText(/nome do hinário/i)).toHaveValue("O Cruzeiro");
    expect(screen.getByLabelText(/nome curto/i)).toHaveValue("Cruzeiro");
    expect(screen.getByLabelText(/dono \/ autor/i)).toHaveValue("Mestre Irineu");
    expect(screen.getByLabelText(/descrição/i)).toHaveValue("Hinário do Mestre");
  });

  it("mostra a capa atual como preview", () => {
    render(Page, { props: { data: buildData() } });
    expect(screen.getByTestId("cover-atual")).toHaveAttribute(
      "src",
      "/media/capas/cruzeiro.png",
    );
  });

  it("botão de submit diz 'Salvar'", () => {
    render(Page, { props: { data: buildData() } });
    expect(screen.getByRole("button", { name: /^salvar$/i })).toBeInTheDocument();
  });

  it("mostra 'não encontrado' quando o hinário não existe", () => {
    render(Page, { props: { data: buildData({ hymnbook: null }) } });
    expect(screen.getByTestId("hymnbook-not-found")).toBeInTheDocument();
    expect(screen.queryByTestId("hymnbook-form")).not.toBeInTheDocument();
  });

  it("mostra acesso negado quando forbidden", () => {
    render(Page, { props: { data: buildData({ forbidden: true, hymnbook: null }) } });
    expect(screen.getByTestId("editor-forbidden")).toBeInTheDocument();
  });
});
