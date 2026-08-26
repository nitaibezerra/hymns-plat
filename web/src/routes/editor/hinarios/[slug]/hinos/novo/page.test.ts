/**
 * Sub-marco 5.D — Ciclos 5D.8 e 5D.9.
 *
 * 5D.8 — `/editor/hinarios/[slug]/hinos/novo/` renderiza o form de hino com
 * `number` já sugerido como `max(number) + 1` (paridade com
 * `apps/hymns/views.py::hymn_create_view`).
 * 5D.9 — submit chama `createHymn` e redireciona pro hino criado.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { _loadNovoHymn } from "./+page";
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

function hymnbookPayload(numbers: number[]) {
  return {
    data: {
      hymnbook: {
        id: "hb1",
        name: "O Cruzeiro",
        slug: "cruzeiro",
        hymns: numbers.map((n) => ({ id: `h${n}`, number: n })),
      },
    },
  };
}

beforeEach(() => {
  goto.mockReset();
});

describe("/editor/hinarios/[slug]/hinos/novo — load (5D.8)", () => {
  it("busca o hinário com os números dos hinos existentes", async () => {
    const fetchFn = sequenceFetch(guardPayload(), hymnbookPayload([1, 2, 3]));
    await _loadNovoHymn({ fetch: fetchFn, params: { slug: "cruzeiro" } });
    const body = JSON.parse(fetchFn.mock.calls[1][1].body as string);
    expect(body.variables).toEqual({ slug: "cruzeiro" });
    expect(body.query).toContain("number");
  });

  it("sugere max(number) + 1", async () => {
    const fetchFn = sequenceFetch(guardPayload(), hymnbookPayload([1, 7, 3]));
    const result = await _loadNovoHymn({ fetch: fetchFn, params: { slug: "cruzeiro" } });
    expect(result.suggestedNumber).toBe(8);
  });

  it("sugere 1 quando o hinário está vazio", async () => {
    const fetchFn = sequenceFetch(guardPayload(), hymnbookPayload([]));
    const result = await _loadNovoHymn({ fetch: fetchFn, params: { slug: "cruzeiro" } });
    expect(result.suggestedNumber).toBe(1);
  });

  it("marca forbidden e não busca o hinário quando não é editor", async () => {
    const fetchFn = sequenceFetch(guardPayload(false));
    const result = await _loadNovoHymn({ fetch: fetchFn, params: { slug: "cruzeiro" } });
    expect(result.forbidden).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("redireciona anônimo pra /login preservando o destino", async () => {
    const fetchFn = sequenceFetch({ data: { currentUser: null } });
    await expect(
      _loadNovoHymn({ fetch: fetchFn, params: { slug: "cruzeiro" } }),
    ).rejects.toMatchObject({
      status: 302,
      location: "/login?next=/editor/hinarios/cruzeiro/hinos/novo/",
    });
  });
});

function buildData(overrides: Record<string, unknown> = {}) {
  return {
    hymnbook: { id: "hb1", name: "O Cruzeiro", slug: "cruzeiro" },
    slug: "cruzeiro",
    suggestedNumber: 8,
    forbidden: false,
    error: null,
    ...overrides,
  };
}

describe("/editor/hinarios/[slug]/hinos/novo — form (5D.8)", () => {
  it("renderiza os campos de HymnInput", () => {
    render(Page, { props: { data: buildData() } });
    expect(screen.getByLabelText(/número/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/título/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/letra/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/estilo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/repetições/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/instruções/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/oferecido para/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/seção/i)).toBeInTheDocument();
  });

  it("pré-enche o número com a sugestão max+1", () => {
    render(Page, { props: { data: buildData() } });
    expect(screen.getByLabelText(/número/i)).toHaveValue(8);
  });

  it("o campo número é numérico com mínimo 1", () => {
    render(Page, { props: { data: buildData() } });
    const number = screen.getByLabelText(/número/i) as HTMLInputElement;
    expect(number.type).toBe("number");
    expect(number.getAttribute("min")).toBe("1");
  });

  it("mostra o nome do hinário no cabeçalho", () => {
    render(Page, { props: { data: buildData() } });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/o cruzeiro/i);
  });

  it("botão de submit diz 'Criar'", () => {
    render(Page, { props: { data: buildData() } });
    expect(screen.getByRole("button", { name: /^criar$/i })).toBeInTheDocument();
  });

  it("mostra 'não encontrado' quando o hinário não existe", () => {
    render(Page, { props: { data: buildData({ hymnbook: null }) } });
    expect(screen.getByTestId("hymnbook-not-found")).toBeInTheDocument();
    expect(screen.queryByTestId("hymn-form")).not.toBeInTheDocument();
  });

  it("mostra acesso negado quando forbidden", () => {
    render(Page, { props: { data: buildData({ forbidden: true, hymnbook: null }) } });
    expect(screen.getByTestId("editor-forbidden")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 5D.9 — submit chama `createHymn` e redireciona
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
  await fireEvent.input(screen.getByLabelText(/título/i), { target: { value: "Sol, Lua, Estrela" } });
  await fireEvent.input(screen.getByLabelText(/letra/i), { target: { value: "Verso 1\nVerso 2" } });
  await fireEvent.input(screen.getByLabelText(/estilo/i), { target: { value: "Valsa" } });
  await fireEvent.submit(screen.getByTestId("hymn-form"));
}

describe("/editor/hinarios/[slug]/hinos/novo — submit (5D.9)", () => {
  it("chama createHymn com hymnbookSlug + input", async () => {
    const fetchFn = stubFetch({
      data: { createHymn: { __typename: "HymnType", id: "h9", number: 8, title: "Sol, Lua, Estrela" } },
    });
    render(Page, { props: { data: buildData() } });
    await fillAndSubmit();

    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.query).toContain("createHymn");
    expect(body.variables).toEqual({
      hymnbookSlug: "cruzeiro",
      input: {
        number: 8,
        title: "Sol, Lua, Estrela",
        text: "Verso 1\nVerso 2",
        style: "Valsa",
        repetitions: "",
        extraInstructions: "",
        offeredTo: "",
        section: "",
      },
    });
  });

  it("redireciona pro hino criado", async () => {
    stubFetch({
      data: { createHymn: { __typename: "HymnType", id: "h9", number: 8, title: "Sol, Lua, Estrela" } },
    });
    render(Page, { props: { data: buildData() } });
    await fillAndSubmit();

    await waitFor(() => expect(goto).toHaveBeenCalledWith("/hinos/h9"));
  });

  it("mostra ValidationError (número duplicado) e não redireciona", async () => {
    stubFetch({
      data: {
        createHymn: {
          __typename: "ValidationError",
          message: "Já existe um hino com o número 8 neste hinário.",
          field: "number",
        },
      },
    });
    render(Page, { props: { data: buildData() } });
    await fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByTestId("form-error")).toHaveTextContent(/já existe um hino com o número 8/i),
    );
    expect(goto).not.toHaveBeenCalled();
  });
});
