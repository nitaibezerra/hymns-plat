/**
 * Sub-marco 5.D — Ciclos 5D.14, 5D.15 e 5D.16.
 *
 * `/editor/audios/pendentes/` — fila de aprovação de gravações.
 *
 * Esta tela só ficou possível com o 5.A½: antes dele `HymnAudioType` não
 * expunha `hymn`, `credits`, `format` nem `fileSize`, então não havia como
 * dizer a que hino/hinário cada áudio pertencia.
 */

import { render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { _loadPendingAudios } from "./+page";
import Page from "./+page.svelte";

vi.mock("$app/navigation", () => ({
  goto: vi.fn(),
  invalidateAll: vi.fn(),
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

const AUDIO = {
  id: "a1",
  title: "Ao vivo",
  credits: "Coral do centro",
  source: "Arquivo pessoal",
  format: "mp3",
  fileSize: 3 * 1024 * 1024,
  url: "/media/audios/a1.mp3",
  durationSeconds: 185,
  createdAt: "2026-08-20T10:00:00Z",
  isApproved: false,
  uploadedBy: { id: "u2", username: "joao" },
  hymn: {
    id: "h1",
    number: 12,
    title: "Sol, Lua, Estrela",
    hymnBook: { id: "hb1", name: "O Cruzeiro", slug: "cruzeiro" },
  },
};

const SECOND_AUDIO = { ...AUDIO, id: "a2", title: "Ensaio", uploadedBy: null };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/editor/audios/pendentes — load (5D.14)", () => {
  it("busca pendingAudios depois do guard", async () => {
    const fetchFn = sequenceFetch(guardPayload(), { data: { pendingAudios: [AUDIO] } });
    const result = await _loadPendingAudios({ fetch: fetchFn });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const body = JSON.parse(fetchFn.mock.calls[1][1].body as string);
    expect(body.query).toContain("pendingAudios");
    expect(result.audios).toHaveLength(1);
  });

  it("pede os metadados que o 5.A½ adicionou (hymn, credits, format, fileSize)", async () => {
    const fetchFn = sequenceFetch(guardPayload(), { data: { pendingAudios: [] } });
    await _loadPendingAudios({ fetch: fetchFn });
    const body = JSON.parse(fetchFn.mock.calls[1][1].body as string);
    expect(body.query).toContain("hymn");
    expect(body.query).toContain("credits");
    expect(body.query).toContain("format");
    expect(body.query).toContain("fileSize");
  });

  it("marca forbidden e não busca a fila quando não é editor", async () => {
    const fetchFn = sequenceFetch(guardPayload(false));
    const result = await _loadPendingAudios({ fetch: fetchFn });
    expect(result.forbidden).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("redireciona anônimo pra /login preservando o destino", async () => {
    const fetchFn = sequenceFetch({ data: { currentUser: null } });
    await expect(_loadPendingAudios({ fetch: fetchFn })).rejects.toMatchObject({
      status: 302,
      location: "/login?next=/editor/audios/pendentes/",
    });
  });

  it("trata o erro de permissão que o resolver do 5.A½ levanta (vira forbidden)", async () => {
    const fetchFn = sequenceFetch(guardPayload(), {
      data: { pendingAudios: null },
      errors: [{ message: "Permission denied" }],
    });
    const result = await _loadPendingAudios({ fetch: fetchFn });
    expect(result.forbidden).toBe(true);
    expect(result.audios).toEqual([]);
  });

  it("erro que não é de permissão vira mensagem, não forbidden", async () => {
    const fetchFn = sequenceFetch(guardPayload(), {
      data: { pendingAudios: null },
      errors: [{ message: "Unexpected database error" }],
    });
    const result = await _loadPendingAudios({ fetch: fetchFn });
    expect(result.forbidden).toBe(false);
    expect(result.error).toBe("Unexpected database error");
  });
});

function buildData(overrides: Record<string, unknown> = {}) {
  return { audios: [AUDIO, SECOND_AUDIO], forbidden: false, error: null, ...overrides };
}

describe("/editor/audios/pendentes — lista (5D.14)", () => {
  it("renderiza um item por áudio pendente", () => {
    render(Page, { props: { data: buildData() } });
    expect(screen.getAllByTestId("pending-audio-item")).toHaveLength(2);
  });

  it("mostra a que hino e hinário o áudio pertence", () => {
    render(Page, { props: { data: buildData({ audios: [AUDIO] }) } });
    const item = screen.getByTestId("pending-audio-item");
    expect(item).toHaveTextContent("12");
    expect(item).toHaveTextContent("Sol, Lua, Estrela");
    expect(item).toHaveTextContent(/o cruzeiro/i);
  });

  it("linka pro detalhe do hino", () => {
    render(Page, { props: { data: buildData({ audios: [AUDIO] }) } });
    expect(screen.getByRole("link", { name: /sol, lua, estrela/i })).toHaveAttribute(
      "href",
      "/hinos/h1",
    );
  });

  it("mostra quem enviou, formato e tamanho", () => {
    render(Page, { props: { data: buildData({ audios: [AUDIO] }) } });
    const item = screen.getByTestId("pending-audio-item");
    expect(item).toHaveTextContent("joao");
    expect(item).toHaveTextContent(/MP3/);
    expect(item).toHaveTextContent(/3(,|\.)0 MB/);
  });

  it("mostra os créditos quando existem", () => {
    render(Page, { props: { data: buildData({ audios: [AUDIO] }) } });
    expect(screen.getByTestId("pending-audio-item")).toHaveTextContent("Coral do centro");
  });

  it("cai pra 'Anônimo' quando não há uploadedBy", () => {
    render(Page, { props: { data: buildData({ audios: [SECOND_AUDIO] }) } });
    expect(screen.getByTestId("pending-audio-item")).toHaveTextContent(/anônimo/i);
  });

  it("tem player inline com controls apontando pra url do áudio", () => {
    render(Page, { props: { data: buildData({ audios: [AUDIO] }) } });
    const player = screen.getByTestId("pending-audio-player") as HTMLAudioElement;
    expect(player.tagName).toBe("AUDIO");
    expect(player.hasAttribute("controls")).toBe(true);
    expect(player.getAttribute("src")).toBe("/media/audios/a1.mp3");
  });

  it("mostra a contagem de pendentes", () => {
    render(Page, { props: { data: buildData() } });
    expect(screen.getByTestId("pending-count")).toHaveTextContent("2");
  });

  it("mostra estado vazio quando não há pendências", () => {
    render(Page, { props: { data: buildData({ audios: [] }) } });
    expect(screen.getByTestId("pending-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("pending-audio-item")).not.toBeInTheDocument();
  });

  it("mostra acesso negado quando forbidden", () => {
    render(Page, { props: { data: buildData({ audios: [], forbidden: true }) } });
    expect(screen.getByTestId("editor-forbidden")).toBeInTheDocument();
  });
});
