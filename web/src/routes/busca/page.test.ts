/**
 * Marco 4.G — Ciclo 4G.1.
 *
 * Load function da página de busca. Comportamento esperado:
 *
 *   - Com `?q=<termo>` na URL, chama `Query.search(q, kind: ALL)` via GraphQL.
 *   - Sem `q` (ou `q` vazio) NÃO chama o backend; devolve `{hymns: [], hymnbooks: []}`.
 *   - Propaga erros HTTP/GraphQL via `data.error`.
 *   - Echo do termo em `data.query` para o componente pré-popular o input.
 */

import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Page from "./+page.svelte";
import { _loadSearch } from "./+page";

import type { SearchData } from "./+page";

const gotoMock = vi.fn();
vi.mock("$app/navigation", () => ({
  goto: (...args: unknown[]) => gotoMock(...args),
}));

function fakeFetch<T>(payload: T, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function urlWithQuery(q: string | null): URL {
  const u = new URL("http://localhost/busca");
  if (q !== null) u.searchParams.set("q", q);
  return u;
}

describe("busca load function", () => {
  it("chama Query.search quando há ?q=...", async () => {
    const fetchFn = fakeFetch({
      data: {
        search: {
          hymns: [
            { id: "h1", number: 1, title: "Estrela Brilhante", reviewStatus: "REVIEWED" },
          ],
          hymnbooks: [
            { id: "b1", name: "O Cruzeiro", slug: "cruzeiro", isPublished: true },
          ],
        },
      },
    });
    const result = await _loadSearch({ fetch: fetchFn, url: urlWithQuery("estrela") });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [, init] = fetchFn.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.query).toMatch(/search\s*\(\s*q\s*:\s*\$q/);
    expect(body.variables).toEqual({ q: "estrela", kind: "ALL" });

    expect(result.query).toBe("estrela");
    expect(result.results.hymns).toHaveLength(1);
    expect(result.results.hymnbooks).toHaveLength(1);
    expect(result.error).toBeNull();
  });

  it("não chama GraphQL e devolve resultados vazios quando q ausente", async () => {
    const fetchFn = vi.fn();
    const result = await _loadSearch({ fetch: fetchFn, url: urlWithQuery(null) });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result.query).toBe("");
    expect(result.results).toEqual({ hymns: [], hymnbooks: [] });
    expect(result.error).toBeNull();
  });

  it("não chama GraphQL quando q está vazio ou só whitespace", async () => {
    const fetchFn = vi.fn();
    const result = await _loadSearch({ fetch: fetchFn, url: urlWithQuery("   ") });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result.query).toBe("");
    expect(result.results).toEqual({ hymns: [], hymnbooks: [] });
  });

  it("propaga erros HTTP via data.error", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    const result = await _loadSearch({ fetch: fetchFn, url: urlWithQuery("foo") });
    expect(result.results).toEqual({ hymns: [], hymnbooks: [] });
    expect(result.error).toMatch(/HTTP 500/);
    expect(result.query).toBe("foo");
  });
});

function dataWith(
  query: string,
  hymns: SearchData["results"]["hymns"],
  hymnbooks: SearchData["results"]["hymnbooks"],
) {
  return { currentUser: null, query, results: { hymns, hymnbooks }, error: null };
}

describe("busca render: resultados agrupados", () => {
  it("renderiza seções 'Hinos' e 'Hinários' com contagens", () => {
    const data = dataWith(
      "estrela",
      [
        { id: "h1", number: 1, title: "Estrela Brilhante", reviewStatus: "REVIEWED" },
        { id: "h2", number: 12, title: "Estrela do Norte", reviewStatus: "NOT_REVIEWED" },
      ],
      [
        { id: "b1", name: "O Cruzeiro", slug: "cruzeiro", isPublished: true },
      ],
    );

    render(Page, { props: { data } });

    const hymnsSection = screen.getByTestId("search-section-hymns");
    expect(hymnsSection).toBeInTheDocument();
    expect(hymnsSection).toHaveTextContent(/hinos/i);
    expect(hymnsSection).toHaveTextContent("2");

    const hymnbooksSection = screen.getByTestId("search-section-hymnbooks");
    expect(hymnbooksSection).toBeInTheDocument();
    expect(hymnbooksSection).toHaveTextContent(/hinários/i);
    expect(hymnbooksSection).toHaveTextContent("1");

    expect(screen.getAllByTestId("search-hymn-result")).toHaveLength(2);
    expect(screen.getAllByTestId("search-hymnbook-result")).toHaveLength(1);
    expect(screen.getByText("Estrela Brilhante")).toBeInTheDocument();
    expect(screen.getByText("O Cruzeiro")).toBeInTheDocument();
  });

  it("omite seção quando o grupo correspondente está vazio", () => {
    const data = dataWith(
      "cruzeiro",
      [],
      [{ id: "b1", name: "O Cruzeiro", slug: "cruzeiro", isPublished: true }],
    );

    render(Page, { props: { data } });

    expect(screen.queryByTestId("search-section-hymns")).toBeNull();
    expect(screen.getByTestId("search-section-hymnbooks")).toBeInTheDocument();
  });

  it("mostra mensagem 'nenhum resultado' quando ambos grupos vazios mas há query", () => {
    const data = dataWith("xyz", [], []);
    render(Page, { props: { data } });
    expect(screen.getByTestId("search-empty")).toHaveTextContent(/nenhum resultado/i);
  });
});

describe("busca render: estado inicial (sem query)", () => {
  it("mostra placeholder explicando o que buscar quando q é vazio", () => {
    const data = dataWith("", [], []);
    render(Page, { props: { data } });

    const placeholder = screen.getByTestId("search-placeholder");
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toHaveTextContent(/digite/i);
    expect(placeholder).toHaveTextContent(/hinos|hinários/i);

    expect(screen.queryByTestId("search-empty")).toBeNull();
    expect(screen.queryByTestId("search-section-hymns")).toBeNull();
    expect(screen.queryByTestId("search-section-hymnbooks")).toBeNull();
  });

  it("não mostra placeholder quando há query", () => {
    const data = dataWith(
      "estrela",
      [{ id: "h1", number: 1, title: "Estrela Brilhante", reviewStatus: "REVIEWED" }],
      [],
    );
    render(Page, { props: { data } });
    expect(screen.queryByTestId("search-placeholder")).toBeNull();
  });
});

describe("busca: input com debounce de 300ms", () => {
  beforeEach(() => {
    gotoMock.mockReset();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("não chama goto a cada tecla — espera 300ms ociosos", async () => {
    render(Page, { props: { data: dataWith("", [], []) } });
    const input = screen.getByTestId("search-input") as HTMLInputElement;

    await fireEvent.input(input, { target: { value: "e" } });
    await fireEvent.input(input, { target: { value: "es" } });
    await fireEvent.input(input, { target: { value: "est" } });
    await fireEvent.input(input, { target: { value: "estr" } });

    // Antes de 300ms ociosos, goto ainda não foi chamado.
    expect(gotoMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(299);
    expect(gotoMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2);
    expect(gotoMock).toHaveBeenCalledTimes(1);
    expect(gotoMock).toHaveBeenCalledWith(
      "/busca?q=estr",
      expect.objectContaining({ keepFocus: true }),
    );
  });

  it("limpando o input chama goto com /busca (sem ?q)", async () => {
    render(Page, { props: { data: dataWith("estrela", [], []) } });
    const input = screen.getByTestId("search-input") as HTMLInputElement;

    await fireEvent.input(input, { target: { value: "" } });
    vi.advanceTimersByTime(300);

    expect(gotoMock).toHaveBeenCalledWith(
      "/busca",
      expect.objectContaining({ keepFocus: true }),
    );
  });
});
