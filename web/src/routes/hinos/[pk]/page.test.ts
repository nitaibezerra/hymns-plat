/**
 * Marco 4.E — Ciclos 4E.1, 4E.2 e 4E.3.
 *
 * Detalhe de hino individual. A load function `_loadHymn` recebe `{ fetch, params }`
 * (params.pk = UUID do hino) e busca via GraphQL:
 *   - hino (id, number, title)
 *   - previousInBook / nextInBook (objetos parciais com id+number)
 *   - siblingsWithSameNumber (id + hymnBook.name + hymnBook.slug — nota: o
 *     schema atual não expõe hymnBook em HymnType, então a query pede só o
 *     que existe e o componente SiblingHymnsList lida com a forma simplificada)
 *   - audios (id, url, waveformPeaks, durationSeconds, uploadedBy.username)
 *
 * Como o schema vigente (4.A) **não** expõe `body`/`text` em HymnType, a
 * letra ainda não vem do backend; o componente `HymnBody` recebe `body=""`
 * por enquanto. 4.D vai unificar isso quando ampliarmos o schema.
 *
 * 4E.2: a página renderiza `HymnBody` (data-testid="hymn-body").
 * 4E.3: links "anterior"/"próximo" aparecem só quando os respectivos campos
 * não são null; usam `<a href="/hinos/<pk>">` (navegação SPA preserva o
 * player global do shell — motivo de todo o headless existir).
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import Page from "./+page.svelte";
import { _loadHymn, type HymnDetailData } from "./+page";

function fakeFetch<T>(payload: T, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

const FULL_HYMN_PAYLOAD = {
  data: {
    hymn: {
      id: "h-1",
      number: 12,
      title: "Estrela do Norte",
      reviewStatus: "REVIEWED",
      previousInBook: { id: "h-prev", number: 11, title: "Lua Cheia" },
      nextInBook: { id: "h-next", number: 13, title: "Sol Nascente" },
      siblingsWithSameNumber: [
        { id: "h-sib1", number: 12, title: "Estrela do Norte (O Justiceiro)" },
        { id: "h-sib2", number: 12, title: "Estrela do Norte (O Cruzeiro)" },
      ],
      audios: [
        {
          id: "a-1",
          url: "https://media.example.com/a1.mp3",
          waveformPeaks: [1, 2, 3, 4],
          durationSeconds: 180.5,
          uploadedBy: { id: "u-1", username: "ana" },
        },
      ],
    },
  },
};

describe("_loadHymn (load function do detalhe de hino)", () => {
  it("busca o hino por pk e devolve previousInBook/nextInBook/siblings/audios", async () => {
    const fetchFn = fakeFetch(FULL_HYMN_PAYLOAD);
    const result = await _loadHymn({
      fetch: fetchFn,
      params: { pk: "h-1" },
    });

    expect(fetchFn).toHaveBeenCalledOnce();
    const body = JSON.parse(fetchFn.mock.calls[0]![1]!.body as string);
    expect(body.variables).toEqual({ pk: "h-1" });
    expect(body.query).toMatch(/hymn\s*\(\s*pk:\s*\$pk\s*\)/);
    expect(body.query).toMatch(/previousInBook/);
    expect(body.query).toMatch(/nextInBook/);
    expect(body.query).toMatch(/siblingsWithSameNumber/);
    expect(body.query).toMatch(/audios/);

    expect(result.hymn?.id).toBe("h-1");
    expect(result.hymn?.number).toBe(12);
    expect(result.hymn?.previousInBook?.number).toBe(11);
    expect(result.hymn?.nextInBook?.number).toBe(13);
    expect(result.hymn?.siblingsWithSameNumber).toHaveLength(2);
    expect(result.hymn?.audios).toHaveLength(1);
    expect(result.hymn?.audios[0]?.url).toBe("https://media.example.com/a1.mp3");
    expect(result.error).toBeNull();
  });

  it("retorna hymn=null quando o backend responde null (hino não existe ou sem visibilidade)", async () => {
    const fetchFn = fakeFetch({ data: { hymn: null } });
    const result = await _loadHymn({
      fetch: fetchFn,
      params: { pk: "missing" },
    });
    expect(result.hymn).toBeNull();
    expect(result.error).toBeNull();
  });

  it("propaga erros HTTP no campo error", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    const result = await _loadHymn({
      fetch: fetchFn,
      params: { pk: "h-1" },
    });
    expect(result.hymn).toBeNull();
    expect(result.error).toMatch(/HTTP 500/);
  });
});

const HYMN_OK: HymnDetailData = {
  hymn: {
    id: "h-1",
    number: 12,
    title: "Estrela do Norte",
    reviewStatus: "REVIEWED",
    previousInBook: { id: "h-prev", number: 11, title: "Lua Cheia" },
    nextInBook: { id: "h-next", number: 13, title: "Sol Nascente" },
    siblingsWithSameNumber: [],
    audios: [],
  },
  error: null,
};

// `+page.svelte` recebe `data: PageData`, que o SvelteKit infere como
// união de `LayoutData & PageDataFromLoad`. Pra evitar repetir o cast
// completo, helper anexa `currentUser` (do layout) ao payload do page.
function pageProps(data: HymnDetailData) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { data: { currentUser: null, ...data } as any };
}

describe("+page.svelte (detalhe de hino)", () => {
  it("renderiza HymnBody pra exibir a letra (4E.2)", () => {
    render(Page, { props: pageProps(HYMN_OK) });
    expect(screen.getByTestId("hymn-body")).toBeInTheDocument();
  });

  it("renderiza link 'anterior no hinário' apontando pra /hinos/<prev.id> (4E.3)", () => {
    render(Page, { props: pageProps(HYMN_OK) });
    const link = screen.getByTestId("nav-prev") as HTMLAnchorElement;
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toBe("/hinos/h-prev");
    expect(link.textContent).toMatch(/anterior/i);
  });

  it("renderiza link 'próximo no hinário' apontando pra /hinos/<next.id> (4E.3)", () => {
    render(Page, { props: pageProps(HYMN_OK) });
    const link = screen.getByTestId("nav-next") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/hinos/h-next");
    expect(link.textContent).toMatch(/próximo/i);
  });

  it("omite link 'anterior' quando previousInBook é null (4E.3)", () => {
    const data: HymnDetailData = {
      hymn: { ...HYMN_OK.hymn!, previousInBook: null },
      error: null,
    };
    render(Page, { props: pageProps(data) });
    expect(screen.queryByTestId("nav-prev")).toBeNull();
  });

  it("omite link 'próximo' quando nextInBook é null (4E.3)", () => {
    const data: HymnDetailData = {
      hymn: { ...HYMN_OK.hymn!, nextInBook: null },
      error: null,
    };
    render(Page, { props: pageProps(data) });
    expect(screen.queryByTestId("nav-next")).toBeNull();
  });

  it("mostra fallback quando hymn=null (não encontrado ou sem permissão)", () => {
    render(Page, { props: pageProps({ hymn: null, error: null }) });
    expect(screen.getByTestId("hymn-not-found")).toBeInTheDocument();
  });

  it("mostra mensagem de erro quando data.error não é null", () => {
    render(Page, { props: pageProps({ hymn: null, error: "HTTP 500" }) });
    expect(screen.getByTestId("error")).toHaveTextContent(/HTTP 500/);
  });
});
