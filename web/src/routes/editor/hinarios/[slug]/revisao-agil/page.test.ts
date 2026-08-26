/**
 * Sub-marco 5.E — Ciclo 5E.1.
 *
 * Load da revisão ágil: seleção do hino corrente por `?h=<number>`, com
 * default no primeiro INCOMPLETO (paridade com `editor_next_incomplete`, que
 * no Django é a porta de entrada e redireciona pro `editor_quick_review`
 * apontado no primeiro hino sem estilo ou sem repetições).
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { _loadQuickReview } from "./+page";
import Page from "./+page.svelte";

const goto = vi.fn();
vi.mock("$app/navigation", () => ({
  goto: (...args: unknown[]) => goto(...args),
}));

const originalFetch = globalThis.fetch;

beforeEach(() => {
  goto.mockReset();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function fakeFetch(payload: unknown) {
  return vi.fn().mockResolvedValue(jsonResponse(payload));
}

function hymn(number: number, style: string, repetitions: string) {
  return {
    id: `h${number}`,
    number,
    title: `Hino ${number}`,
    body: `verso ${number}`,
    style,
    repetitions,
  };
}

/** 1 completo, 2 sem repetições, 3 sem estilo. */
const HYMNBOOK = {
  id: "hb1",
  name: "O Cruzeiro",
  slug: "cruzeiro",
  hymns: [hymn(1, "Marcha", "1-4"), hymn(2, "Valsa", ""), hymn(3, "", "1-4")],
};

function payload(hymnbook: unknown = HYMNBOOK) {
  return { data: { hymnbook } };
}

function event(search = "", slug = "cruzeiro") {
  return {
    fetch: fakeFetch(payload()),
    params: { slug },
    url: new URL(`http://x/editor/hinarios/${slug}/revisao-agil/${search}`),
  };
}

describe("/editor/hinarios/[slug]/revisao-agil — load (5E.1)", () => {
  it("busca o hinário pelo slug da rota", async () => {
    const ev = event();
    await _loadQuickReview(ev);
    const body = JSON.parse(ev.fetch.mock.calls[0][1].body as string);
    expect(body.variables).toEqual({ slug: "cruzeiro" });
  });

  it("seleciona o hino pedido em ?h=<number>", async () => {
    const result = await _loadQuickReview(event("?h=3"));
    expect(result.current?.number).toBe(3);
  });

  it("cai no primeiro INCOMPLETO quando ?h= não vem", async () => {
    const result = await _loadQuickReview(event());
    expect(result.current?.number).toBe(2);
  });

  it("cai no primeiro incompleto quando ?h= aponta pra número inexistente", async () => {
    const result = await _loadQuickReview(event("?h=99"));
    expect(result.current?.number).toBe(2);
  });

  it("cai no primeiro incompleto quando ?h= não é número", async () => {
    const result = await _loadQuickReview(event("?h=abc"));
    expect(result.current?.number).toBe(2);
  });

  it("respeita ?h= mesmo apontando pra um hino já completo", async () => {
    const result = await _loadQuickReview(event("?h=1"));
    expect(result.current?.number).toBe(1);
  });

  it("devolve o hinário e a lista ordenada por número", async () => {
    const result = await _loadQuickReview(event());
    expect(result.hymnbook.name).toBe("O Cruzeiro");
    expect(result.hymns.map((h) => h.number)).toEqual([1, 2, 3]);
  });

  it("ordena a lista por número mesmo se o backend devolver fora de ordem", async () => {
    const ev = {
      ...event(),
      fetch: fakeFetch(payload({ ...HYMNBOOK, hymns: [hymn(3, "", "1-4"), hymn(1, "Marcha", "1-4")] })),
    };
    const result = await _loadQuickReview(ev);
    expect(result.hymns.map((h) => h.number)).toEqual([1, 3]);
  });
});

/** `data` já resolvido, do jeito que a load devolve. */
function pageData(overrides: Record<string, unknown> = {}) {
  const hymns = HYMNBOOK.hymns;
  return {
    hymnbook: { id: HYMNBOOK.id, name: HYMNBOOK.name, slug: HYMNBOOK.slug },
    hymns,
    current: hymns[1],
    ...overrides,
  };
}

describe("/editor/hinarios/[slug]/revisao-agil — pílulas na tela (5E.2)", () => {
  it("renderiza as pílulas da revisão ágil", () => {
    render(Page, { props: { data: pageData() } });
    expect(screen.getByTestId("quick-review-pills")).toBeInTheDocument();
  });

  it("pré-marca a pílula do estilo já gravado no hino", () => {
    render(Page, { props: { data: pageData() } });
    const active = screen
      .getAllByTestId("quick-style-tile")
      .filter((el) => el.dataset.active === "true");
    expect(active.map((el) => el.dataset.value)).toEqual(["Valsa"]);
  });

  it("pré-preenche o campo livre com o valor gravado", () => {
    render(Page, { props: { data: pageData() } });
    expect(screen.getByTestId("quick-style-input")).toHaveValue("Valsa");
  });

  it("atalho de teclado muda a pílula ativa na tela", async () => {
    render(Page, { props: { data: pageData() } });
    await fireEvent.keyDown(window, { key: "z" });
    const active = screen
      .getAllByTestId("quick-style-tile")
      .filter((el) => el.dataset.active === "true");
    expect(active.map((el) => el.dataset.value)).toEqual(["Mazurca"]);
  });

  it("atalho numérico muda a pílula de repetição na tela", async () => {
    render(Page, { props: { data: pageData() } });
    await fireEvent.keyDown(window, { key: "2" });
    const active = screen
      .getAllByTestId("quick-repetition-tile")
      .filter((el) => el.dataset.active === "true");
    expect(active.map((el) => el.dataset.value)).toEqual(["1-4"]);
  });

  it("avisa que esta tela não conclui a revisão (nunca toca review_status)", () => {
    render(Page, { props: { data: pageData() } });
    expect(screen.getByTestId("quick-review-disclaimer")).toHaveTextContent(
      /não conclui a revisão/i,
    );
  });
});

/**
 * O submit faz duas chamadas em sequência: a mutation e o refetch de
 * `nextIncompleteHymn`. O stub devolve as respostas na ordem.
 */
function stubSequence(...payloads: unknown[]) {
  const fn = vi.fn();
  payloads.forEach((p) => fn.mockResolvedValueOnce(jsonResponse(p)));
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

function savedPayload(number = 2) {
  return {
    data: {
      quickReviewHymn: {
        __typename: "HymnType",
        id: `h${number}`,
        number,
        style: "Valsa",
        repetitions: "1-4",
      },
    },
  };
}

function nextIncompletePayload(next: { id: string; number: number; title: string } | null) {
  return { data: { hymnbook: { id: "hb1", nextIncompleteHymn: next } } };
}

async function submit() {
  await fireEvent.click(screen.getByTestId("quick-review-submit"));
}

describe("/editor/hinarios/[slug]/revisao-agil — submit (5E.3)", () => {
  it("chama quickReviewHymn com o pk do hino e os dois campos", async () => {
    const fetchFn = stubSequence(savedPayload(), nextIncompletePayload(null));
    render(Page, { props: { data: pageData() } });
    await fireEvent.keyDown(window, { key: "z" });
    await fireEvent.keyDown(window, { key: "2" });
    await submit();

    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.query).toContain("quickReviewHymn");
    expect(body.variables).toEqual({ pk: "h2", style: "Mazurca", repetitions: "1-4" });
  });

  it("manda o header CSRF (mutation roda no browser)", async () => {
    document.cookie = "csrftoken=tok123";
    const fetchFn = stubSequence(savedPayload(), nextIncompletePayload(null));
    render(Page, { props: { data: pageData() } });
    await submit();
    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
    expect(fetchFn.mock.calls[0][1].headers["X-CSRFToken"]).toBe("tok123");
  });

  it("navega pro próximo hino incompleto usando ?h=<number>", async () => {
    stubSequence(
      savedPayload(),
      nextIncompletePayload({ id: "h3", number: 3, title: "Hino 3" }),
    );
    render(Page, { props: { data: pageData() } });
    await submit();
    await waitFor(() =>
      expect(goto).toHaveBeenCalledWith("/editor/hinarios/cruzeiro/revisao-agil/?h=3", {
        invalidateAll: true,
      }),
    );
  });

  it("não navega quando a mutation falha e mostra o erro", async () => {
    stubSequence({
      data: {
        quickReviewHymn: {
          __typename: "ValidationError",
          message: "Repetições inválidas.",
          field: "repetitions",
        },
      },
    });
    render(Page, { props: { data: pageData() } });
    await submit();
    await waitFor(() =>
      expect(screen.getByTestId("quick-review-error")).toHaveTextContent("Repetições inválidas."),
    );
    expect(goto).not.toHaveBeenCalled();
  });

  it("mostra a negativa de permissão sem navegar", async () => {
    stubSequence({
      data: {
        quickReviewHymn: {
          __typename: "PermissionDeniedError",
          message: "Você não tem permissão para realizar essa ação.",
        },
      },
    });
    render(Page, { props: { data: pageData() } });
    await submit();
    await waitFor(() => expect(screen.getByTestId("quick-review-error")).toBeInTheDocument());
    expect(goto).not.toHaveBeenCalled();
  });

  it("desabilita o botão enquanto salva (evita duplo submit)", async () => {
    let release: (value: Response) => void = () => {};
    const fn = vi.fn().mockReturnValueOnce(new Promise<Response>((r) => (release = r)));
    globalThis.fetch = fn as unknown as typeof fetch;
    render(Page, { props: { data: pageData() } });
    await submit();
    await waitFor(() => expect(screen.getByTestId("quick-review-submit")).toBeDisabled());
    release(jsonResponse(savedPayload()));
  });

  it("Enter submete sem precisar do botão", async () => {
    const fetchFn = stubSequence(savedPayload(), nextIncompletePayload(null));
    render(Page, { props: { data: pageData() } });
    await fireEvent.keyDown(window, { key: "Enter" });
    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.query).toContain("quickReviewHymn");
  });
});

const ALL_COMPLETE = {
  ...HYMNBOOK,
  hymns: [hymn(1, "Marcha", "1-4"), hymn(2, "Valsa", "1-2,3-4")],
};

describe("/editor/hinarios/[slug]/revisao-agil — conclusão (5E.4)", () => {
  it("a load marca o hinário como concluído quando nenhum hino está incompleto", async () => {
    const ev = { ...event(), fetch: fakeFetch(payload(ALL_COMPLETE)) };
    const result = await _loadQuickReview(ev);
    expect(result.allComplete).toBe(true);
  });

  it("a load não marca concluído enquanto sobrar um incompleto", async () => {
    const result = await _loadQuickReview(event());
    expect(result.allComplete).toBe(false);
  });

  it("hinário sem hinos não conta como concluído", async () => {
    const ev = { ...event(), fetch: fakeFetch(payload({ ...HYMNBOOK, hymns: [] })) };
    const result = await _loadQuickReview(ev);
    expect(result.allComplete).toBe(false);
    expect(result.current).toBeNull();
  });

  it("mostra a mensagem de conclusão do Django quando tudo está completo", () => {
    render(Page, {
      props: {
        data: pageData({ hymns: ALL_COMPLETE.hymns, current: ALL_COMPLETE.hymns[0], allComplete: true }),
      },
    });
    expect(screen.getByTestId("quick-review-done")).toHaveTextContent(
      /completou estilo e repetições de todos os hinos deste hinário/i,
    );
  });

  it("a conclusão leva de volta pro hinário", () => {
    render(Page, {
      props: {
        data: pageData({ hymns: ALL_COMPLETE.hymns, current: ALL_COMPLETE.hymns[0], allComplete: true }),
      },
    });
    expect(screen.getByTestId("quick-review-done-back")).toHaveAttribute(
      "href",
      "/editor/hinarios/cruzeiro/",
    );
  });

  it("esconde o formulário quando tudo está completo", () => {
    render(Page, {
      props: {
        data: pageData({ hymns: ALL_COMPLETE.hymns, current: ALL_COMPLETE.hymns[0], allComplete: true }),
      },
    });
    expect(screen.queryByTestId("quick-review-form")).toBeNull();
  });

  it("hinário sem hinos avisa e volta pro hinário", () => {
    render(Page, { props: { data: pageData({ hymns: [], current: null }) } });
    expect(screen.getByTestId("quick-review-empty")).toHaveTextContent(/sem hinos para revisar/i);
    expect(screen.getByTestId("quick-review-empty-back")).toHaveAttribute(
      "href",
      "/editor/hinarios/cruzeiro/",
    );
  });

  it("salvar o último hino incompleto cai na conclusão sem sair da tela", async () => {
    stubSequence(savedPayload(), nextIncompletePayload(null));
    render(Page, { props: { data: pageData() } });
    await submit();
    await waitFor(() =>
      expect(screen.getByTestId("quick-review-done")).toHaveTextContent(
        /completou estilo e repetições/i,
      ),
    );
    expect(goto).not.toHaveBeenCalled();
  });
});

describe("/editor/hinarios/[slug]/revisao-agil — posição e navegação (5E.5)", () => {
  it("a load informa posição e total do hino corrente", async () => {
    const result = await _loadQuickReview(event("?h=3"));
    expect(result.position).toBe(3);
    expect(result.total).toBe(3);
  });

  it("posição acompanha o hino escolhido pelo default", async () => {
    const result = await _loadQuickReview(event());
    expect(result.position).toBe(2);
  });

  it("hinário vazio tem posição 0", async () => {
    const ev = { ...event(), fetch: fakeFetch(payload({ ...HYMNBOOK, hymns: [] })) };
    const result = await _loadQuickReview(ev);
    expect(result.position).toBe(0);
    expect(result.total).toBe(0);
  });

  it("mostra o indicador N DE TOTAL com dois dígitos, como no Django", () => {
    render(Page, { props: { data: pageData({ position: 2, total: 3 }) } });
    expect(screen.getByTestId("quick-review-position")).toHaveTextContent("02 DE 03");
  });

  it("expõe o progresso como barra acessível", () => {
    render(Page, { props: { data: pageData({ position: 2, total: 3 }) } });
    const bar = screen.getByTestId("quick-review-progress");
    expect(bar).toHaveAttribute("role", "progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "2");
    expect(bar).toHaveAttribute("aria-valuemax", "3");
  });

  it("anterior e próximo são <a href> com ?h=, não botões de JS", () => {
    render(Page, { props: { data: pageData({ position: 2, total: 3 }) } });
    const prev = screen.getByTestId("quick-review-prev");
    const next = screen.getByTestId("quick-review-next");
    expect(prev.tagName).toBe("A");
    expect(next.tagName).toBe("A");
    expect(prev).toHaveAttribute("href", "/editor/hinarios/cruzeiro/revisao-agil/?h=1");
    expect(next).toHaveAttribute("href", "/editor/hinarios/cruzeiro/revisao-agil/?h=3");
  });

  it("no primeiro hino, o anterior não é link navegável", () => {
    render(Page, {
      props: { data: pageData({ current: HYMNBOOK.hymns[0], position: 1, total: 3 }) },
    });
    expect(screen.getByTestId("quick-review-prev")).not.toHaveAttribute("href");
  });

  it("no último hino, o próximo não é link navegável", () => {
    render(Page, {
      props: { data: pageData({ current: HYMNBOOK.hymns[2], position: 3, total: 3 }) },
    });
    expect(screen.getByTestId("quick-review-next")).not.toHaveAttribute("href");
  });

  it("leva pra revisão completa do hino corrente", () => {
    render(Page, { props: { data: pageData() } });
    expect(screen.getByTestId("quick-review-full")).toHaveAttribute(
      "href",
      "/editor/hinos/h2/revisar/",
    );
  });

  it("← navega pro anterior, o mesmo destino do link", async () => {
    render(Page, { props: { data: pageData({ position: 2, total: 3 }) } });
    await fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(goto).toHaveBeenCalledWith("/editor/hinarios/cruzeiro/revisao-agil/?h=1", {
      invalidateAll: true,
    });
  });

  it("→ navega pro próximo", async () => {
    render(Page, { props: { data: pageData({ position: 2, total: 3 }) } });
    await fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(goto).toHaveBeenCalledWith("/editor/hinarios/cruzeiro/revisao-agil/?h=3", {
      invalidateAll: true,
    });
  });

  it("← nas pontas não navega (sem wrap-around, igual ao Django)", async () => {
    render(Page, {
      props: { data: pageData({ current: HYMNBOOK.hymns[0], position: 1, total: 3 }) },
    });
    await fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(goto).not.toHaveBeenCalled();
  });

  it("setas não navegam com o foco num campo de texto (o cursor é do editor)", async () => {
    render(Page, { props: { data: pageData({ position: 2, total: 3 }) } });
    const input = screen.getByTestId("quick-style-input");
    input.focus();
    await fireEvent.keyDown(input, { key: "ArrowLeft", bubbles: true });
    expect(goto).not.toHaveBeenCalled();
  });
});
