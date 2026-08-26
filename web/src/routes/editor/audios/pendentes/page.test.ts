/**
 * Sub-marco 5.D — Ciclos 5D.14, 5D.15 e 5D.16.
 *
 * `/editor/audios/pendentes/` — fila de aprovação de gravações.
 *
 * Esta tela só ficou possível com o 5.A½: antes dele `HymnAudioType` não
 * expunha `hymn`, `credits`, `format` nem `fileSize`, então não havia como
 * dizer a que hino/hinário cada áudio pertencia.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

// ---------------------------------------------------------------------------
// 5D.15 — "Aprovar" com UI otimista
//
// O projeto não usa o cache do urql (as load functions têm o `gqlFetch`
// próprio), então não existe `optimisticResponse` pra chamar: o otimismo é
// estado local do componente + rollback no erro.
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

/** fetch que só resolve quando o teste manda — pra observar o estado otimista. */
function deferredFetch() {
  let release!: (payload: unknown) => void;
  const fn = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        release = (payload: unknown) => resolve(jsonResponse(payload));
      }),
  );
  globalThis.fetch = fn as unknown as typeof fetch;
  return { fn, release: (payload: unknown) => release(payload) };
}

const APPROVED_PAYLOAD = {
  data: { approveAudio: { __typename: "HymnAudioType", id: "a1", isApproved: true } },
};

describe("/editor/audios/pendentes — aprovar (5D.15)", () => {
  it("chama approveAudio com o pk do áudio", async () => {
    const fetchFn = stubFetch(APPROVED_PAYLOAD);
    render(Page, { props: { data: buildData({ audios: [AUDIO] }) } });
    await fireEvent.click(screen.getByTestId("approve-a1"));

    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.query).toContain("approveAudio");
    expect(body.variables).toEqual({ pk: "a1" });
  });

  it("remove o item da fila NA HORA, antes da resposta do servidor", async () => {
    const { release } = deferredFetch();
    render(Page, { props: { data: buildData() } });
    expect(screen.getAllByTestId("pending-audio-item")).toHaveLength(2);

    await fireEvent.click(screen.getByTestId("approve-a1"));
    expect(screen.getAllByTestId("pending-audio-item")).toHaveLength(1);
    expect(screen.getByTestId("pending-count")).toHaveTextContent("1");

    release(APPROVED_PAYLOAD);
  });

  it("mantém o item fora da fila quando o servidor confirma", async () => {
    stubFetch(APPROVED_PAYLOAD);
    render(Page, { props: { data: buildData() } });
    await fireEvent.click(screen.getByTestId("approve-a1"));

    await waitFor(() => expect(screen.getAllByTestId("pending-audio-item")).toHaveLength(1));
    expect(screen.queryByTestId("approve-a1")).not.toBeInTheDocument();
  });

  it("faz rollback (item volta) e mostra o erro quando o servidor nega", async () => {
    stubFetch({
      data: { approveAudio: { __typename: "PermissionDeniedError", message: "Sem permissão" } },
    });
    render(Page, { props: { data: buildData() } });
    await fireEvent.click(screen.getByTestId("approve-a1"));

    await waitFor(() =>
      expect(screen.getByTestId("queue-error")).toHaveTextContent(/sem permissão/i),
    );
    expect(screen.getAllByTestId("pending-audio-item")).toHaveLength(2);
    expect(screen.getByTestId("approve-a1")).toBeInTheDocument();
  });

  it("aprovar um áudio não mexe nos outros itens da fila", async () => {
    stubFetch(APPROVED_PAYLOAD);
    render(Page, { props: { data: buildData() } });
    await fireEvent.click(screen.getByTestId("approve-a1"));

    await waitFor(() => expect(screen.queryByTestId("approve-a1")).not.toBeInTheDocument());
    expect(screen.getByTestId("approve-a2")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 5D.16 — "Rejeitar" com confirmação
//
// A confirmação é inline (dois passos no próprio item) e não `window.confirm`
// como no template Django: `confirm()` não existe no jsdom e bloqueia a thread
// no browser.
// ---------------------------------------------------------------------------

const REJECTED_PAYLOAD = {
  data: { rejectAudio: { __typename: "DeleteResult", ok: true, deletedId: "a1" } },
};

describe("/editor/audios/pendentes — rejeitar (5D.16)", () => {
  it("o primeiro clique em Rejeitar NÃO chama a mutation, só pede confirmação", async () => {
    const fetchFn = stubFetch(REJECTED_PAYLOAD);
    render(Page, { props: { data: buildData({ audios: [AUDIO] }) } });
    await fireEvent.click(screen.getByTestId("reject-a1"));

    expect(fetchFn).not.toHaveBeenCalled();
    expect(screen.getByTestId("reject-confirm-a1")).toHaveTextContent(/irreversível/i);
    expect(screen.getAllByTestId("pending-audio-item")).toHaveLength(1);
  });

  it("confirmar chama rejectAudio com o pk e remove o item", async () => {
    const fetchFn = stubFetch(REJECTED_PAYLOAD);
    render(Page, { props: { data: buildData() } });
    await fireEvent.click(screen.getByTestId("reject-a1"));
    await fireEvent.click(screen.getByTestId("reject-confirm-yes-a1"));

    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.query).toContain("rejectAudio");
    expect(body.variables).toEqual({ pk: "a1" });
    await waitFor(() => expect(screen.getAllByTestId("pending-audio-item")).toHaveLength(1));
  });

  it("desistir da confirmação não chama nada e mantém o item", async () => {
    const fetchFn = stubFetch(REJECTED_PAYLOAD);
    render(Page, { props: { data: buildData({ audios: [AUDIO] }) } });
    await fireEvent.click(screen.getByTestId("reject-a1"));
    await fireEvent.click(screen.getByTestId("reject-confirm-no-a1"));

    expect(fetchFn).not.toHaveBeenCalled();
    expect(screen.queryByTestId("reject-confirm-a1")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("pending-audio-item")).toHaveLength(1);
  });

  it("a confirmação aparece só no item clicado", async () => {
    stubFetch(REJECTED_PAYLOAD);
    render(Page, { props: { data: buildData() } });
    await fireEvent.click(screen.getByTestId("reject-a1"));

    expect(screen.getByTestId("reject-confirm-a1")).toBeInTheDocument();
    expect(screen.queryByTestId("reject-confirm-a2")).not.toBeInTheDocument();
  });

  it("faz rollback e mostra o erro quando a rejeição é negada", async () => {
    stubFetch({
      data: { rejectAudio: { __typename: "PermissionDeniedError", message: "Sem permissão" } },
    });
    render(Page, { props: { data: buildData() } });
    await fireEvent.click(screen.getByTestId("reject-a1"));
    await fireEvent.click(screen.getByTestId("reject-confirm-yes-a1"));

    await waitFor(() =>
      expect(screen.getByTestId("queue-error")).toHaveTextContent(/sem permissão/i),
    );
    expect(screen.getAllByTestId("pending-audio-item")).toHaveLength(2);
  });
});
