/**
 * Sub-marco 5.D — Ciclos 5D.1 e 5D.2.
 *
 * 5D.1 — rota `/editor/hinarios/novo/` renderiza o form com os campos do
 * `HymnBookForm` do Django (nome, nome curto, dono/autor, descrição e
 * imagem de capa — este último só existe no schema desde o 5.A½).
 * 5D.2 — submit chama `createHymnBook` e redireciona pro detalhe editorial.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

// ---------------------------------------------------------------------------
// 5D.2 — submit chama `createHymnBook` e redireciona
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function stubFetch(payload: unknown) {
  const fn = vi.fn().mockResolvedValue(jsonResponse(payload));
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

async function fillAndSubmit() {
  await fireEvent.input(screen.getByLabelText(/nome do hinário/i), {
    target: { value: "O Cruzeiro" },
  });
  await fireEvent.input(screen.getByLabelText(/dono \/ autor/i), {
    target: { value: "Mestre Irineu" },
  });
  await fireEvent.input(screen.getByLabelText(/descrição/i), {
    target: { value: "Hinário do Mestre" },
  });
  await fireEvent.submit(screen.getByTestId("hymnbook-form"));
}

describe("/editor/hinarios/novo — submit (5D.2)", () => {
  const data = { forbidden: false, error: null };

  it("chama a mutation createHymnBook com o input do form", async () => {
    const fetchFn = stubFetch({
      data: { createHymnBook: { __typename: "HymnBookType", id: "hb1", slug: "cruzeiro", name: "O Cruzeiro" } },
    });
    render(Page, { props: { data } });
    await fillAndSubmit();

    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.query).toContain("createHymnBook");
    expect(body.variables.input).toEqual({
      name: "O Cruzeiro",
      ownerName: "Mestre Irineu",
      introName: "",
      description: "Hinário do Mestre",
    });
  });

  it("manda o header X-CSRFToken na mutation", async () => {
    const fetchFn = stubFetch({
      data: { createHymnBook: { __typename: "HymnBookType", id: "hb1", slug: "cruzeiro", name: "O Cruzeiro" } },
    });
    document.cookie = "csrftoken=abc123";
    render(Page, { props: { data } });
    await fillAndSubmit();

    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    const headers = fetchFn.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["X-CSRFToken"]).toBe("abc123");
  });

  it("redireciona pro detalhe editorial do hinário criado", async () => {
    stubFetch({
      data: { createHymnBook: { __typename: "HymnBookType", id: "hb1", slug: "cruzeiro", name: "O Cruzeiro" } },
    });
    render(Page, { props: { data } });
    await fillAndSubmit();

    await waitFor(() => expect(goto).toHaveBeenCalledWith("/editor/hinarios/cruzeiro/"));
  });

  it("mostra ValidationError e não redireciona", async () => {
    stubFetch({
      data: { createHymnBook: { __typename: "ValidationError", message: "Nome já usado", field: "name" } },
    });
    render(Page, { props: { data } });
    await fillAndSubmit();

    await waitFor(() => expect(screen.getByTestId("form-error")).toHaveTextContent(/nome já usado/i));
    expect(goto).not.toHaveBeenCalled();
  });

  it("mostra PermissionDeniedError e não redireciona", async () => {
    stubFetch({
      data: { createHymnBook: { __typename: "PermissionDeniedError", message: "Sem permissão" } },
    });
    render(Page, { props: { data } });
    await fillAndSubmit();

    await waitFor(() => expect(screen.getByTestId("form-error")).toHaveTextContent(/sem permissão/i));
    expect(goto).not.toHaveBeenCalled();
  });

  it("com capa selecionada, sobe via multipart (FormData) em vez de JSON", async () => {
    const fetchFn = stubFetch({
      data: { createHymnBook: { __typename: "HymnBookType", id: "hb1", slug: "cruzeiro", name: "O Cruzeiro" } },
    });
    render(Page, { props: { data } });

    const cover = screen.getByLabelText(/imagem de capa/i) as HTMLInputElement;
    const file = new File(["binario"], "capa.png", { type: "image/png" });
    Object.defineProperty(cover, "files", { value: [file], configurable: true });
    await fireEvent.change(cover);
    await fillAndSubmit();

    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    const body = fetchFn.mock.calls[0][1].body as FormData;
    expect(body).toBeInstanceOf(FormData);
    const operations = JSON.parse(body.get("operations") as string);
    expect(operations.query).toContain("createHymnBook");
    expect(operations.variables.input.coverImage).toBeNull();
    expect(JSON.parse(body.get("map") as string)).toEqual({ "0": ["variables.input.coverImage"] });
    expect(body.get("0")).toBe(file);
  });
});
