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
 * O schema expõe `HymnType.body: String!` — a query pede o campo e a página
 * repassa o valor pro `HymnBody`, que renderiza uma `<p data-testid=
 * "hymn-line">` por linha. (Até o fechamento do Marco 4 a página passava
 * `body=""` literal e a letra do hino simplesmente não aparecia.)
 *
 * 4E.2: a página renderiza `HymnBody` (data-testid="hymn-body") com a letra.
 * 4E.3: links "anterior"/"próximo" aparecem só quando os respectivos campos
 * não são null; usam `<a href="/hinos/<pk>">` (navegação SPA preserva o
 * player global do shell — motivo de todo o headless existir).
 */

import { fireEvent, render, screen } from "@testing-library/svelte";
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
      body: "Eu vou subindo\nEu vou subindo",
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
    expect(body.variables).toEqual({ pk: "h-1", approvedOnly: true });
    expect(body.query).toMatch(/hymn\s*\(\s*pk:\s*\$pk\s*\)/);
    expect(body.query).toMatch(/previousInBook/);
    expect(body.query).toMatch(/nextInBook/);
    expect(body.query).toMatch(/siblingsWithSameNumber/);
    expect(body.query).toMatch(/audios/);
    // A letra do hino: sem `body` na query o resolver nunca manda a letra e a
    // página renderiza um HymnBody vazio.
    expect(body.query).toMatch(/\bbody\b/);

    expect(result.hymn?.id).toBe("h-1");
    expect(result.hymn?.number).toBe(12);
    expect(result.hymn?.body).toBe("Eu vou subindo\nEu vou subindo");
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

  it("pede approvedOnly=false e isApproved quando ha usuario logado (editor)", async () => {
    const fetchFn = fakeFetch(FULL_HYMN_PAYLOAD);
    const result = await _loadHymn({
      fetch: fetchFn,
      params: { pk: "h-1" },
      parent: async () => ({
        currentUser: { id: "u-9", username: "nitaibezerra", email: "n@x.dev" },
      }),
    });

    const body = JSON.parse(fetchFn.mock.calls[0]![1]!.body as string);
    // Sem passar o argumento, `audios` cai no default do schema
    // (`approvedOnly: Boolean! = true`) e os pendentes nunca chegam.
    expect(body.variables).toEqual({ pk: "h-1", approvedOnly: false });
    expect(body.query).toMatch(/audios\s*\(\s*approvedOnly:\s*\$approvedOnly\s*\)/);
    // Sem `isApproved` no payload o componente não sabe marcar o pendente.
    expect(body.query).toMatch(/isApproved/);
    expect(result.isEditor).toBe(true);
  });

  it("mantem approvedOnly=true pra anonimo", async () => {
    const fetchFn = fakeFetch(FULL_HYMN_PAYLOAD);
    const result = await _loadHymn({
      fetch: fetchFn,
      params: { pk: "h-1" },
      parent: async () => ({ currentUser: null }),
    });

    const body = JSON.parse(fetchFn.mock.calls[0]![1]!.body as string);
    expect(body.variables).toEqual({ pk: "h-1", approvedOnly: true });
    expect(result.isEditor).toBe(false);
  });
});

const HYMN_OK: HymnDetailData = {
  hymn: {
    id: "h-1",
    number: 12,
    title: "Estrela do Norte",
    body: "Eu vou subindo\nCom a força do sol",
    reviewStatus: "REVIEWED",
    previousInBook: { id: "h-prev", number: 11, title: "Lua Cheia" },
    nextInBook: { id: "h-next", number: 13, title: "Sol Nascente" },
    siblingsWithSameNumber: [],
    audios: [],
  },
  error: null,
  isEditor: false,
};

// `+page.svelte` recebe `data: PageData`, que o SvelteKit infere como
// união de `LayoutData & PageDataFromLoad`. Pra evitar repetir o cast
// completo, helper anexa `currentUser` (do layout) ao payload do page.
function pageProps(data: HymnDetailData, currentUser: unknown = null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { data: { currentUser, ...data } as any };
}

describe("+page.svelte (detalhe de hino)", () => {
  it("renderiza HymnBody pra exibir a letra (4E.2)", () => {
    render(Page, { props: pageProps(HYMN_OK) });
    expect(screen.getByTestId("hymn-body")).toBeInTheDocument();
  });

  it("exibe a letra do hino, uma linha por verso (4E.2)", () => {
    render(Page, { props: pageProps(HYMN_OK) });
    const lines = screen.getAllByTestId("hymn-line");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveTextContent("Eu vou subindo");
    expect(lines[1]).toHaveTextContent("Com a força do sol");
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
      isEditor: false,
    };
    render(Page, { props: pageProps(data) });
    expect(screen.queryByTestId("nav-prev")).toBeNull();
  });

  it("omite link 'próximo' quando nextInBook é null (4E.3)", () => {
    const data: HymnDetailData = {
      hymn: { ...HYMN_OK.hymn!, nextInBook: null },
      error: null,
      isEditor: false,
    };
    render(Page, { props: pageProps(data) });
    expect(screen.queryByTestId("nav-next")).toBeNull();
  });

  it("mostra fallback quando hymn=null (não encontrado ou sem permissão)", () => {
    render(Page, { props: pageProps({ hymn: null, error: null, isEditor: false }) });
    expect(screen.getByTestId("hymn-not-found")).toBeInTheDocument();
  });

  it("mostra mensagem de erro quando data.error não é null", () => {
    render(Page, { props: pageProps({ hymn: null, error: "HTTP 500", isEditor: false }) });
    expect(screen.getByTestId("error")).toHaveTextContent(/HTTP 500/);
  });

  it("repassa isEditor pro HymnAudioList, de forma que pendentes aparecem (4E.6)", () => {
    const pendente = {
      id: "a-pend",
      url: "https://media.example.com/pend.mp3",
      waveformPeaks: [1, 2],
      durationSeconds: 90,
      uploadedBy: { id: "u-outro", username: "outra-pessoa" },
      isApproved: false,
    };
    const data: HymnDetailData = {
      hymn: { ...HYMN_OK.hymn!, audios: [pendente] },
      error: null,
      isEditor: true,
    };
    render(Page, {
      props: pageProps(data, { id: "u-9", username: "editora", email: "e@x.dev" }),
    });
    expect(screen.getAllByTestId("audio-item")).toHaveLength(1);
    expect(screen.getByTestId("badge-pending")).toBeInTheDocument();
  });

  it("esconde pendentes de terceiros quando isEditor=false (4E.6)", () => {
    const pendente = {
      id: "a-pend",
      url: "https://media.example.com/pend.mp3",
      waveformPeaks: [1, 2],
      durationSeconds: 90,
      uploadedBy: { id: "u-outro", username: "outra-pessoa" },
      isApproved: false,
    };
    const data: HymnDetailData = {
      hymn: { ...HYMN_OK.hymn!, audios: [pendente] },
      error: null,
      isEditor: false,
    };
    render(Page, { props: pageProps(data) });
    expect(screen.queryByTestId("badge-pending")).toBeNull();
  });
});

/**
 * Sub-marco 5.E — Ciclo 5E.6.
 *
 * Editor ganha o envio de gravação sem sair do detalhe do hino. O drawer é o
 * `AudioUploadDrawer` do 5.D — mesmo componente do workspace, nada recriado.
 */
describe("+page.svelte — envio de gravação pelo editor (5E.6)", () => {
  const EDITOR = { id: "u-9", username: "editora", email: "e@x.dev" };

  function editorProps(overrides: Partial<HymnDetailData> = {}) {
    return pageProps({ ...HYMN_OK, isEditor: true, ...overrides }, EDITOR);
  }

  it("mostra o botão de enviar gravação quando o usuário é editor", () => {
    render(Page, { props: editorProps() });
    expect(screen.getByTestId("upload-audio-btn")).toBeInTheDocument();
  });

  it("esconde o botão de quem não é editor", () => {
    render(Page, { props: pageProps(HYMN_OK) });
    expect(screen.queryByTestId("upload-audio-btn")).toBeNull();
  });

  it("esconde o botão quando o hino não carregou", () => {
    render(Page, { props: pageProps({ hymn: null, error: null, isEditor: true }, EDITOR) });
    expect(screen.queryByTestId("upload-audio-btn")).toBeNull();
  });

  it("o drawer só aparece depois do clique", async () => {
    render(Page, { props: editorProps() });
    expect(screen.queryByTestId("audio-upload-drawer")).toBeNull();
    await fireEvent.click(screen.getByTestId("upload-audio-btn"));
    expect(screen.getByTestId("audio-upload-drawer")).toBeInTheDocument();
  });

  it("o drawer recebe o hino da página como alvo do upload", async () => {
    render(Page, { props: editorProps() });
    await fireEvent.click(screen.getByTestId("upload-audio-btn"));
    const drawer = screen.getByTestId("audio-upload-drawer");
    expect(drawer).toHaveTextContent("Estrela do Norte");
    expect(drawer).toHaveTextContent("12");
  });

  it("cancelar fecha o drawer", async () => {
    render(Page, { props: editorProps() });
    await fireEvent.click(screen.getByTestId("upload-audio-btn"));
    await fireEvent.click(screen.getByTestId("cancel-upload"));
    expect(screen.queryByTestId("audio-upload-drawer")).toBeNull();
  });
});
