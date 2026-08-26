/**
 * Sub-marco 5.D — Ciclos 5D.12 e 5D.13.
 *
 * `AudioUploadDrawer` — envio de gravação para um hino via a mutation
 * `uploadAudio` (scalar `Upload`, multipart habilitado em
 * `apps/api/urls.py`).
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AudioUploadDrawer from "./AudioUploadDrawer.svelte";

const HYMN = { id: "h1", number: 12, title: "Sol, Lua, Estrela" };

const originalFetch = globalThis.fetch;

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetch(payload: unknown) {
  const fn = vi.fn().mockResolvedValue(jsonResponse(payload));
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

/** `File` com `size` forjado — não queremos alocar 26 MB no jsdom. */
function makeFile(name: string, sizeBytes: number, type = "audio/mpeg") {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: sizeBytes, configurable: true });
  return file;
}

const MB = 1024 * 1024;

let onuploaded: ReturnType<typeof vi.fn>;
let onclose: ReturnType<typeof vi.fn>;

beforeEach(() => {
  onuploaded = vi.fn();
  onclose = vi.fn();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function renderDrawer(open = true) {
  return render(AudioUploadDrawer, { props: { open, hymn: HYMN, onuploaded, onclose } });
}

async function selectFile(file: File) {
  const input = screen.getByLabelText(/arquivo de áudio/i) as HTMLInputElement;
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await fireEvent.change(input);
}

const OK_PAYLOAD = {
  data: { uploadAudio: { __typename: "HymnAudioType", id: "a1", title: "Gravação" } },
};

describe("AudioUploadDrawer — envio (5D.12)", () => {
  it("não renderiza nada quando open=false", () => {
    renderDrawer(false);
    expect(screen.queryByTestId("audio-upload-drawer")).not.toBeInTheDocument();
  });

  it("mostra a que hino a gravação vai", () => {
    renderDrawer();
    expect(screen.getByTestId("audio-upload-drawer")).toHaveTextContent("Sol, Lua, Estrela");
    expect(screen.getByTestId("audio-upload-drawer")).toHaveTextContent("12");
  });

  it("o input de arquivo aceita apenas mp3/ogg/flac", () => {
    renderDrawer();
    const input = screen.getByLabelText(/arquivo de áudio/i) as HTMLInputElement;
    expect(input.type).toBe("file");
    const accept = input.getAttribute("accept") ?? "";
    expect(accept).toContain(".mp3");
    expect(accept).toContain(".ogg");
    expect(accept).toContain(".flac");
  });

  it("renderiza os metadados opcionais do uploadAudio", () => {
    renderDrawer();
    expect(screen.getByLabelText(/^título/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/fonte/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/créditos/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/permitir download/i)).toBeInTheDocument();
  });

  it("sem arquivo, avisa e não chama a mutation", async () => {
    const fetchFn = stubFetch(OK_PAYLOAD);
    renderDrawer();
    await fireEvent.submit(screen.getByTestId("audio-upload-form"));

    expect(screen.getByTestId("upload-error")).toHaveTextContent(/selecione um arquivo/i);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("sobe o arquivo via multipart com hymnPk e metadados", async () => {
    const fetchFn = stubFetch(OK_PAYLOAD);
    renderDrawer();
    await selectFile(makeFile("gravacao.mp3", 3 * MB));
    await fireEvent.input(screen.getByLabelText(/^título/i), { target: { value: "Ao vivo" } });
    await fireEvent.input(screen.getByLabelText(/fonte/i), { target: { value: "Arquivo pessoal" } });
    await fireEvent.input(screen.getByLabelText(/créditos/i), { target: { value: "Coral do centro" } });
    await fireEvent.click(screen.getByLabelText(/permitir download/i));
    await fireEvent.submit(screen.getByTestId("audio-upload-form"));

    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    const body = fetchFn.mock.calls[0][1].body as FormData;
    expect(body).toBeInstanceOf(FormData);
    const operations = JSON.parse(body.get("operations") as string);
    expect(operations.query).toContain("uploadAudio");
    expect(operations.variables).toEqual({
      hymnPk: "h1",
      file: null,
      title: "Ao vivo",
      source: "Arquivo pessoal",
      credits: "Coral do centro",
      allowDownload: true,
    });
    expect(JSON.parse(body.get("map") as string)).toEqual({ "0": ["variables.file"] });
  });

  it("avisa onuploaded quando o upload dá certo", async () => {
    stubFetch(OK_PAYLOAD);
    renderDrawer();
    await selectFile(makeFile("gravacao.ogg", 1 * MB, "audio/ogg"));
    await fireEvent.submit(screen.getByTestId("audio-upload-form"));

    await waitFor(() => expect(onuploaded).toHaveBeenCalledTimes(1));
  });

  it("mostra ValidationError do backend e não avisa onuploaded", async () => {
    stubFetch({
      data: { uploadAudio: { __typename: "ValidationError", message: "Arquivo corrompido", field: "file" } },
    });
    renderDrawer();
    await selectFile(makeFile("gravacao.flac", 2 * MB, "audio/flac"));
    await fireEvent.submit(screen.getByTestId("audio-upload-form"));

    await waitFor(() =>
      expect(screen.getByTestId("upload-error")).toHaveTextContent(/arquivo corrompido/i),
    );
    expect(onuploaded).not.toHaveBeenCalled();
  });

  it("Cancelar fecha o drawer sem subir nada", async () => {
    const fetchFn = stubFetch(OK_PAYLOAD);
    renderDrawer();
    await fireEvent.click(screen.getByTestId("cancel-upload"));
    expect(onclose).toHaveBeenCalledTimes(1);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
