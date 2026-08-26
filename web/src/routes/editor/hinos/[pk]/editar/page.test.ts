/**
 * Sub-marco 5.D — Ciclo 5D.10.
 *
 * `/editor/hinos/[pk]/editar/` pré-popula o form com o hino e submete via
 * `updateHymn` (paridade com `apps/hymns/views.py::hymn_edit_view`).
 *
 * A letra vem de `HymnType.body` — que é literalmente `hymn.text` no
 * resolver (`apps/api/types.py`) — e volta pro backend como
 * `HymnUpdateInput.text`.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { _loadEditarHymn } from "./+page";
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

function sequenceFetch(...payloads: unknown[]) {
  const fn = vi.fn();
  payloads.forEach((p) => fn.mockResolvedValueOnce(jsonResponse(p)));
  return fn;
}

function guardPayload(isEditor = true) {
  return { data: { currentUser: { id: "u1", username: "ana", isEditor } } };
}

const HYMN = {
  id: "h1",
  number: 12,
  title: "Sol, Lua, Estrela",
  body: "Verso 1\nVerso 2",
  style: "Valsa",
  repetitions: "1-4",
  extraInstructions: "Bailado",
  offeredTo: "Padrinho",
  section: "Primeira parte",
  hymnBook: { id: "hb1", name: "O Cruzeiro", slug: "cruzeiro" },
};

beforeEach(() => {
  goto.mockReset();
});

describe("/editor/hinos/[pk]/editar — load (5D.10)", () => {
  it("busca o hino pelo pk da rota", async () => {
    const fetchFn = sequenceFetch(guardPayload(), { data: { hymn: HYMN } });
    await _loadEditarHymn({ fetch: fetchFn, params: { pk: "h1" } });
    const body = JSON.parse(fetchFn.mock.calls[1][1].body as string);
    expect(body.variables).toEqual({ pk: "h1" });
    expect(body.query).toContain("hymn");
  });

  it("devolve o hino (com hymnBook, campo do 5.A½) pro form", async () => {
    const fetchFn = sequenceFetch(guardPayload(), { data: { hymn: HYMN } });
    const result = await _loadEditarHymn({ fetch: fetchFn, params: { pk: "h1" } });
    expect(result.hymn).toMatchObject({ number: 12, title: "Sol, Lua, Estrela" });
    expect(result.hymn?.hymnBook.slug).toBe("cruzeiro");
  });

  it("marca forbidden e não busca o hino quando não é editor", async () => {
    const fetchFn = sequenceFetch(guardPayload(false));
    const result = await _loadEditarHymn({ fetch: fetchFn, params: { pk: "h1" } });
    expect(result.forbidden).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("redireciona anônimo pra /login preservando o destino", async () => {
    const fetchFn = sequenceFetch({ data: { currentUser: null } });
    await expect(_loadEditarHymn({ fetch: fetchFn, params: { pk: "h1" } })).rejects.toMatchObject({
      status: 302,
      location: "/login?next=/editor/hinos/h1/editar/",
    });
  });
});

function buildData(overrides: Record<string, unknown> = {}) {
  return { hymn: HYMN, pk: "h1", forbidden: false, error: null, ...overrides };
}

describe("/editor/hinos/[pk]/editar — form pré-populado (5D.10)", () => {
  it("pré-popula todos os campos, com a letra vindo de body", () => {
    render(Page, { props: { data: buildData() } });
    expect(screen.getByLabelText(/número/i)).toHaveValue(12);
    expect(screen.getByLabelText(/título/i)).toHaveValue("Sol, Lua, Estrela");
    expect(screen.getByLabelText(/letra/i)).toHaveValue("Verso 1\nVerso 2");
    expect(screen.getByLabelText(/estilo/i)).toHaveValue("Valsa");
    expect(screen.getByLabelText(/repetições/i)).toHaveValue("1-4");
    expect(screen.getByLabelText(/instruções/i)).toHaveValue("Bailado");
    expect(screen.getByLabelText(/oferecido para/i)).toHaveValue("Padrinho");
    expect(screen.getByLabelText(/seção/i)).toHaveValue("Primeira parte");
  });

  it("botão de submit diz 'Salvar'", () => {
    render(Page, { props: { data: buildData() } });
    expect(screen.getByRole("button", { name: /^salvar$/i })).toBeInTheDocument();
  });

  it("mostra 'não encontrado' quando o hino não existe", () => {
    render(Page, { props: { data: buildData({ hymn: null }) } });
    expect(screen.getByTestId("hymn-not-found")).toBeInTheDocument();
    expect(screen.queryByTestId("hymn-form")).not.toBeInTheDocument();
  });

  it("mostra acesso negado quando forbidden", () => {
    render(Page, { props: { data: buildData({ forbidden: true, hymn: null }) } });
    expect(screen.getByTestId("editor-forbidden")).toBeInTheDocument();
  });
});

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function stubFetch(payload: unknown) {
  const fn = vi.fn().mockResolvedValue(jsonResponse(payload));
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe("/editor/hinos/[pk]/editar — submit (5D.10)", () => {
  it("chama updateHymn com pk + HymnUpdateInput", async () => {
    const fetchFn = stubFetch({
      data: { updateHymn: { __typename: "HymnType", id: "h1", number: 12, title: "Sol, Lua e Estrela" } },
    });
    render(Page, { props: { data: buildData() } });
    await fireEvent.input(screen.getByLabelText(/título/i), {
      target: { value: "Sol, Lua e Estrela" },
    });
    await fireEvent.submit(screen.getByTestId("hymn-form"));

    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.query).toContain("updateHymn");
    expect(body.variables).toEqual({
      pk: "h1",
      input: {
        number: 12,
        title: "Sol, Lua e Estrela",
        text: "Verso 1\nVerso 2",
        style: "Valsa",
        repetitions: "1-4",
        extraInstructions: "Bailado",
        offeredTo: "Padrinho",
        section: "Primeira parte",
      },
    });
  });

  it("redireciona pro detalhe do hino", async () => {
    stubFetch({
      data: { updateHymn: { __typename: "HymnType", id: "h1", number: 12, title: "Sol, Lua, Estrela" } },
    });
    render(Page, { props: { data: buildData() } });
    await fireEvent.submit(screen.getByTestId("hymn-form"));

    await waitFor(() => expect(goto).toHaveBeenCalledWith("/hinos/h1"));
  });

  it("mostra ValidationError e não redireciona", async () => {
    stubFetch({
      data: {
        updateHymn: {
          __typename: "ValidationError",
          message: "Já existe um hino com o número 12 neste hinário.",
          field: "number",
        },
      },
    });
    render(Page, { props: { data: buildData() } });
    await fireEvent.submit(screen.getByTestId("hymn-form"));

    await waitFor(() =>
      expect(screen.getByTestId("form-error")).toHaveTextContent(/já existe um hino/i),
    );
    expect(goto).not.toHaveBeenCalled();
  });
});
