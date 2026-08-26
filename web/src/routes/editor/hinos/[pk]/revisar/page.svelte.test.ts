/**
 * Sub-marco 5.C — testes de integração da tela 07 · Revisar hino.
 *
 * Cada ciclo TDD acrescenta um bloco aqui. Paridade de referência:
 * `templates/hymns/editor/revise_hymn.html` + a view
 * `apps/hymns/editor_views.py::editor_revise_hymn`.
 */

import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { goto } from "$app/navigation";
import Page from "./+page.svelte";
import type { ReviseHymnData } from "./+page";

vi.mock("$app/navigation", () => ({
  goto: vi.fn(),
}));

/** Stub de `globalThis.fetch` que devolve sempre o mesmo payload GraphQL. */
function stubFetch(payload: unknown, status = 200) {
  const fn = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

function bodyOf(fn: ReturnType<typeof vi.fn>, callIndex = 0) {
  return JSON.parse(fn.mock.calls[callIndex][1].body as string);
}

export const sampleData: ReviseHymnData & { currentUser: null } = {
  currentUser: null,
  error: null,
  hymn: {
    id: "h-1",
    number: 7,
    title: "Estrela do Norte",
    text: "Eu vou subindo\nEu vou subindo",
    ocrText: "Eu vou subindo\nEu vou subiudo",
    style: "Valsa",
    repetitions: "1-2,3-4",
    extraInstructions: "Cantar duas vezes",
    offeredTo: "Mestre Irineu",
    section: "Primeira parte",
    receivedAt: "1930-05-01",
    reviewStatus: "IN_REVIEW",
    lastReviewedAt: "2026-08-01T10:00:00+00:00",
    lastReviewedBy: { id: "u-1", username: "ana" },
    hymnBook: {
      id: "hb-1",
      name: "O Cruzeiro",
      slug: "o-cruzeiro",
      hymns: [
        { id: "h-0", number: 6, reviewStatus: "REVIEWED" },
        { id: "h-1", number: 7, reviewStatus: "IN_REVIEW" },
        { id: "h-2", number: 8, reviewStatus: "NOT_REVIEWED" },
      ],
      nextPendingHymn: { id: "h-2", number: 8, title: "Sol Nascente" },
    },
    inlineDiff: {
      changes: 1,
      adds: 0,
      dels: 0,
      lines: [
        { kind: "eq", tokens: [{ kind: "eq", text: "Eu vou subindo", sub: null, add: null }] },
        {
          kind: "replace",
          tokens: [
            { kind: "eq", text: "Eu vou ", sub: null, add: null },
            { kind: "sub", text: null, sub: "subiudo", add: "subindo" },
          ],
        },
      ],
    },
    ocrLineConfidences: [100, 92],
    commonStyles: ["Valsa", "Marcha"],
    commonRepetitions: ["1-2,3-4", "1-4"],
    revisions: [],
    audios: [],
  },
};

describe("5C.5 — formulário edita todos os campos de HymnForm", () => {
  it("mostra estado de erro quando o load falhou", () => {
    render(Page, { props: { data: { ...sampleData, hymn: null, error: "Sem acesso." } } });
    expect(screen.getByTestId("error")).toHaveTextContent("Sem acesso.");
  });

  it("preenche os campos editáveis com os valores do hino", () => {
    render(Page, { props: { data: sampleData } });
    expect((screen.getByLabelText("Número") as HTMLInputElement).value).toBe("7");
    expect((screen.getByLabelText("Título") as HTMLInputElement).value).toBe("Estrela do Norte");
    expect((screen.getByLabelText("Letra") as HTMLTextAreaElement).value).toBe(
      "Eu vou subindo\nEu vou subindo",
    );
    expect((screen.getByLabelText("Repetições") as HTMLInputElement).value).toBe("1-2,3-4");
    expect((screen.getByLabelText("Estilo") as HTMLInputElement).value).toBe("Valsa");
    expect((screen.getByLabelText("Oferecido para") as HTMLInputElement).value).toBe("Mestre Irineu");
    expect((screen.getByLabelText("Seção") as HTMLInputElement).value).toBe("Primeira parte");
    expect((screen.getByLabelText("Instruções") as HTMLTextAreaElement).value).toBe(
      "Cantar duas vezes",
    );
  });

  it("`Recebido em` aparece somente-leitura (updateHymn não aceita o campo)", () => {
    render(Page, { props: { data: sampleData } });
    const received = screen.getByLabelText("Recebido em") as HTMLInputElement;
    expect(received.value).toBe("1930-05-01");
    expect(received.readOnly).toBe(true);
  });

  it("status de revisão é um segmentado com o valor atual marcado", () => {
    render(Page, { props: { data: sampleData } });
    const current = screen.getByLabelText("Em revisão") as HTMLInputElement;
    expect(current.checked).toBe(true);
    expect((screen.getByLabelText("Não revisado") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("Revisado") as HTMLInputElement).checked).toBe(false);
  });

  it("editar número/título reflete na prévia (prova o bind:value)", async () => {
    render(Page, { props: { data: sampleData } });
    expect(screen.getByTestId("preview-title")).toHaveTextContent("7 - Estrela do Norte");

    await fireEvent.input(screen.getByLabelText("Título"), { target: { value: "Estrela D'Alva" } });
    await fireEvent.input(screen.getByLabelText("Número"), { target: { value: "9" } });

    expect(screen.getByTestId("preview-title")).toHaveTextContent("9 - Estrela D'Alva");
  });

  it("renderiza o diff e o sparkline de OCR na coluna direita", () => {
    render(Page, { props: { data: sampleData } });
    expect(screen.getAllByTestId("diff-line")).toHaveLength(2);
    expect(screen.getAllByTestId("ocr-bar")).toHaveLength(2);
  });
});

describe("5C.6 — pílulas de estilo preenchem o campo", () => {
  it("clicar em `Mazurca` escreve no input de Estilo", async () => {
    render(Page, { props: { data: sampleData } });
    const input = screen.getByLabelText("Estilo") as HTMLInputElement;
    expect(input.value).toBe("Valsa");

    await fireEvent.click(screen.getByRole("button", { name: "Mazurca" }));
    expect(input.value).toBe("Mazurca");
  });

  it("`commonStyles` do hinário entra como sugestão extra", () => {
    render(Page, {
      props: {
        data: {
          ...sampleData,
          hymn: { ...sampleData.hymn!, commonStyles: ["Valsa", "Chorinho"] },
        },
      },
    });
    expect(screen.getAllByTestId("style-suggestion").map((el) => el.textContent?.trim())).toEqual([
      "Chorinho",
    ]);
  });
});

describe("5C.7 — pílulas de repetição preenchem o campo", () => {
  it("clicar em `3-4,1-4` escreve no input de Repetições", async () => {
    render(Page, { props: { data: sampleData } });
    const input = screen.getByLabelText("Repetições") as HTMLInputElement;
    expect(input.value).toBe("1-2,3-4");

    await fireEvent.click(screen.getByRole("button", { name: "3-4,1-4" }));
    expect(input.value).toBe("3-4,1-4");
  });

  it("`commonRepetitions` do hinário entra como sugestão extra", () => {
    render(Page, {
      props: {
        data: {
          ...sampleData,
          hymn: { ...sampleData.hymn!, commonRepetitions: ["1-4", "5-8"] },
        },
      },
    });
    expect(
      screen.getAllByTestId("repetition-suggestion").map((el) => el.textContent?.trim()),
    ).toEqual(["5-8"]);
  });
});

describe("5C.8 — autosave com debounce de 2s", () => {
  beforeEach(() => {
    vi.mocked(goto).mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("não salva nada no mount (formulário intocado)", async () => {
    const fetchFn = stubFetch({ data: { updateHymn: { __typename: "HymnType", id: "h-1" } } });
    render(Page, { props: { data: sampleData } });
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(screen.getByTestId("autosave-status")).toHaveTextContent("—");
  });

  it("espera 2s de silêncio antes de chamar updateHymn", async () => {
    const fetchFn = stubFetch({
      data: { updateHymn: { __typename: "HymnType", id: "h-1", number: 7, title: "Novo" } },
    });
    render(Page, { props: { data: sampleData } });

    await fireEvent.input(screen.getByLabelText("Título"), { target: { value: "Novo" } });
    expect(screen.getByTestId("autosave-status")).toHaveTextContent("Alterações não salvas");

    await vi.advanceTimersByTimeAsync(1900);
    expect(fetchFn).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(200);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const body = bodyOf(fetchFn);
    expect(body.query).toContain("updateHymn");
    expect(body.variables.pk).toBe("h-1");
    expect(body.variables.input.title).toBe("Novo");
    expect(body.variables.input.text).toBe("Eu vou subindo\nEu vou subindo");
  });

  it("colapsa uma rajada de digitação numa única mutation", async () => {
    const fetchFn = stubFetch({ data: { updateHymn: { __typename: "HymnType", id: "h-1" } } });
    render(Page, { props: { data: sampleData } });
    const input = screen.getByLabelText("Título");

    for (const value of ["E", "Es", "Est", "Estr"]) {
      await fireEvent.input(input, { target: { value } });
      await vi.advanceTimersByTimeAsync(300);
    }
    expect(fetchFn).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(bodyOf(fetchFn).variables.input.title).toBe("Estr");
  });

  it("autosave NÃO redireciona e mostra `Salvo às HH:MM`", async () => {
    stubFetch({ data: { updateHymn: { __typename: "HymnType", id: "h-1" } } });
    render(Page, { props: { data: sampleData } });

    await fireEvent.input(screen.getByLabelText("Letra"), { target: { value: "Outra letra" } });
    await vi.advanceTimersByTimeAsync(2100);

    expect(goto).not.toHaveBeenCalled();
    expect(screen.getByTestId("autosave-status").textContent?.trim() ?? "").toMatch(
      /^Salvo às \d{2}:\d{2}$/,
    );
  });

  it("erro de permissão no autosave vira aviso, não redirect", async () => {
    stubFetch({
      data: { updateHymn: { __typename: "PermissionDeniedError", message: "Sem permissão." } },
    });
    render(Page, { props: { data: sampleData } });

    await fireEvent.input(screen.getByLabelText("Título"), { target: { value: "X" } });
    await vi.advanceTimersByTimeAsync(2100);

    expect(goto).not.toHaveBeenCalled();
    expect(screen.getByTestId("autosave-status")).toHaveTextContent("Sem permissão.");
  });

  it("mudança de status de revisão também é persistida (setReviewStatus)", async () => {
    const fetchFn = stubFetch({
      data: {
        updateHymn: { __typename: "HymnType", id: "h-1" },
        setReviewStatus: { __typename: "HymnType", id: "h-1", reviewStatus: "REVIEWED" },
      },
    });
    render(Page, { props: { data: sampleData } });

    await fireEvent.click(screen.getByLabelText("Revisado"));
    await vi.advanceTimersByTimeAsync(2100);

    expect(fetchFn).toHaveBeenCalledTimes(2);
    const second = bodyOf(fetchFn, 1);
    expect(second.query).toContain("setReviewStatus");
    expect(second.variables).toEqual({ pk: "h-1", status: "REVIEWED" });
  });
});
