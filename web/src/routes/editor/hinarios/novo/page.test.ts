/**
 * Sub-marco 5.D — Ciclos 5D.1 e 5D.2.
 *
 * 5D.1 — rota `/editor/hinarios/novo/` renderiza o form com os campos do
 * `HymnBookForm` do Django (nome, nome curto, dono/autor, descrição e
 * imagem de capa — este último só existe no schema desde o 5.A½).
 * 5D.2 — submit chama `createHymnBook` e redireciona pro detalhe editorial.
 */

import { render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { _loadNovoHymnBook } from "./+page";
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

function fakeFetch(payload: unknown) {
  return vi.fn().mockResolvedValue(jsonResponse(payload));
}

function editorPayload(isEditor: boolean) {
  return { data: { currentUser: { id: "u1", username: "ana", isEditor } } };
}

beforeEach(() => {
  goto.mockReset();
});

describe("/editor/hinarios/novo — guard de editor (5D.1)", () => {
  it("libera a página quando currentUser.isEditor é true", async () => {
    const result = await _loadNovoHymnBook({ fetch: fakeFetch(editorPayload(true)) });
    expect(result.forbidden).toBe(false);
  });

  it("marca forbidden quando o usuário logado NÃO é editor", async () => {
    const result = await _loadNovoHymnBook({ fetch: fakeFetch(editorPayload(false)) });
    expect(result.forbidden).toBe(true);
  });

  it("redireciona anônimo pra /login preservando o destino", async () => {
    await expect(
      _loadNovoHymnBook({ fetch: fakeFetch({ data: { currentUser: null } }) }),
    ).rejects.toMatchObject({
      status: 302,
      location: "/login?next=/editor/hinarios/novo/",
    });
  });
});

describe("/editor/hinarios/novo — campos do form (5D.1)", () => {
  const data = { forbidden: false, error: null };

  it("renderiza os cinco campos do HymnBookForm", () => {
    render(Page, { props: { data } });
    expect(screen.getByLabelText(/nome do hinário/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nome curto/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/dono \/ autor/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/descrição/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/imagem de capa/i)).toBeInTheDocument();
  });

  it("o campo de capa é um input[type=file] que aceita imagens", () => {
    render(Page, { props: { data } });
    const cover = screen.getByLabelText(/imagem de capa/i) as HTMLInputElement;
    expect(cover.type).toBe("file");
    expect(cover.getAttribute("accept")).toContain("image/");
  });

  it("botão de submit diz 'Criar'", () => {
    render(Page, { props: { data } });
    expect(screen.getByRole("button", { name: /^criar$/i })).toBeInTheDocument();
  });

  it("mostra mensagem de acesso negado (sem form) quando forbidden", () => {
    render(Page, { props: { data: { forbidden: true, error: null } } });
    expect(screen.getByTestId("editor-forbidden")).toBeInTheDocument();
    expect(screen.queryByLabelText(/nome do hinário/i)).not.toBeInTheDocument();
  });
});
