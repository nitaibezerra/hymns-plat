/**
 * Sub-marco 5.F — Ciclo 5F.16.
 *
 * Tela 4 do wizard, porta de `apps/users/views.py::upload_confirm_view` — o
 * ramo "adicionar como nova versão".
 *
 * O `request.session["version_info"]` do Django virou query string:
 * `?task=<uuid>&hinario=<slug>&versao=<nome>`. Faltando qualquer uma das duas
 * últimas, o passo não tem sentido e devolvemos pra desambiguação (era
 * `redirect("users:upload")`, mas com o estado na URL dá pra voltar um passo
 * em vez de recomeçar).
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Page from "./+page.svelte";
import { _loadConfirmar } from "./+page";

const gotoMock = vi.fn();
vi.mock("$app/navigation", () => ({
  goto: (...args: unknown[]) => gotoMock(...args),
}));

const TASK_ID = "6f1c0d3e-9a52-4c81-bf0e-9a1a1c1d2e3f";

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeUrl(search = `?task=${TASK_ID}&hinario=o-cruzeiro&versao=Edi%C3%A7%C3%A3o%202020`) {
  return new URL(`http://localhost/contribuir/confirmar/${search}`);
}

function taskPayload() {
  return {
    data: {
      ocrTask: {
        id: TASK_ID,
        status: "completed",
        currentPage: 10,
        totalPages: 10,
        progressPct: 100,
        errorMessage: "",
        pdfFilename: "cruzeiro-2020.pdf",
        resultData: {
          hymn_book: {
            name: "O Cruzeiro",
            owner: "Mestre Irineu",
            hymns: [
              { number: 1, title: "A", text: "t" },
              { number: 2, title: "B", text: "t" },
            ],
          },
        },
      },
    },
  };
}

function targetPayload() {
  return {
    data: {
      hymnbook: {
        id: "b1",
        name: "O Cruzeiro",
        slug: "o-cruzeiro",
        ownerName: "Mestre Irineu",
        stats: { hymnsTotal: 132 },
      },
    },
  };
}

function fetchSequence(...responses: Response[]) {
  const fn = vi.fn();
  responses.forEach((r) => fn.mockResolvedValueOnce(r));
  return fn;
}

describe("confirmar load function (5F.16)", () => {
  it("sem ?task= volta pra /contribuir/", async () => {
    const fetchFn = vi.fn();
    await expect(_loadConfirmar({ fetch: fetchFn, url: makeUrl("") })).rejects.toMatchObject({
      status: 302,
      location: "/contribuir/",
    });
  });

  it("sem hinário volta pra desambiguação", async () => {
    const fetchFn = vi.fn();
    await expect(
      _loadConfirmar({ fetch: fetchFn, url: makeUrl(`?task=${TASK_ID}&versao=Edicao`) }),
    ).rejects.toMatchObject({
      status: 302,
      location: `/contribuir/desambiguar/?task=${TASK_ID}`,
    });
  });

  it("sem nome de versão volta pra desambiguação", async () => {
    const fetchFn = vi.fn();
    await expect(
      _loadConfirmar({ fetch: fetchFn, url: makeUrl(`?task=${TASK_ID}&hinario=o-cruzeiro`) }),
    ).rejects.toMatchObject({
      status: 302,
      location: `/contribuir/desambiguar/?task=${TASK_ID}`,
    });
  });

  it("erro de auth redireciona pro login preservando o passo", async () => {
    const fetchFn = fetchSequence(
      jsonResponse({ data: { ocrTask: null }, errors: [{ message: "Permission denied" }] }),
    );
    await expect(_loadConfirmar({ fetch: fetchFn, url: makeUrl() })).rejects.toMatchObject({
      status: 302,
      location: "/login?next=/contribuir/confirmar/",
    });
  });

  it("task inexistente devolve 404", async () => {
    const fetchFn = fetchSequence(jsonResponse({ data: { ocrTask: null } }));
    await expect(_loadConfirmar({ fetch: fetchFn, url: makeUrl() })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("devolve o hinário de destino, o nome da versão e os dados do envio", async () => {
    const fetchFn = fetchSequence(jsonResponse(taskPayload()), jsonResponse(targetPayload()));
    const result = await _loadConfirmar({ fetch: fetchFn, url: makeUrl() });
    expect(result.taskId).toBe(TASK_ID);
    expect(result.versionName).toBe("Edição 2020");
    expect(result.target).toEqual({
      name: "O Cruzeiro",
      slug: "o-cruzeiro",
      ownerName: "Mestre Irineu",
      hymnsTotal: 132,
    });
    expect(result.pdfFilename).toBe("cruzeiro-2020.pdf");
    expect(result.totalHymns).toBe(2);
  });

  it("hinário de destino inexistente devolve 404", async () => {
    const fetchFn = fetchSequence(jsonResponse(taskPayload()), jsonResponse({ data: { hymnbook: null } }));
    await expect(_loadConfirmar({ fetch: fetchFn, url: makeUrl() })).rejects.toMatchObject({
      status: 404,
    });
  });
});

function pageData(overrides: Record<string, unknown> = {}) {
  return {
    currentUser: null,
    taskId: TASK_ID,
    versionName: "Edição 2020",
    target: {
      name: "O Cruzeiro",
      slug: "o-cruzeiro",
      ownerName: "Mestre Irineu",
      hymnsTotal: 132,
    },
    pdfFilename: "cruzeiro-2020.pdf",
    totalHymns: 24,
    error: null,
    ...overrides,
  };
}

describe("confirmar page (5F.16)", () => {
  it("mostra o passo 4 do stepper", () => {
    render(Page, { props: { data: pageData() } });
    const steps = screen.getAllByTestId("upload-step");
    expect(steps[3]).toHaveAttribute("data-state", "current");
    expect(steps[2]).toHaveAttribute("data-state", "done");
  });

  it("resume o hinário de destino", () => {
    render(Page, { props: { data: pageData() } });
    const target = screen.getByTestId("confirmar-target");
    expect(target).toHaveTextContent("O Cruzeiro");
    expect(target).toHaveTextContent("Mestre Irineu");
    expect(target).toHaveTextContent("132");
    expect(screen.getByRole("link", { name: /o cruzeiro/i })).toHaveAttribute(
      "href",
      "/hinarios/o-cruzeiro/",
    );
  });

  it("mostra o nome da nova versão e o arquivo enviado", () => {
    render(Page, { props: { data: pageData() } });
    const version = screen.getByTestId("confirmar-version");
    expect(version).toHaveTextContent("Edição 2020");
    expect(version).toHaveTextContent("cruzeiro-2020.pdf");
    expect(version).toHaveTextContent("24");
  });

  it("avisa que a versão não fica primária", () => {
    render(Page, { props: { data: pageData() } });
    expect(screen.getByTestId("confirmar-notice")).toHaveTextContent(/não será marcada como primária/i);
  });

  it("tem saída de cancelamento pro início do wizard", () => {
    render(Page, { props: { data: pageData() } });
    expect(screen.getByRole("link", { name: /cancelar/i })).toHaveAttribute("href", "/contribuir/");
  });
});

describe("confirmar submit (5F.16)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    gotoMock.mockClear();
    document.cookie = "csrftoken=TOKEN123";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("cria a versão com task, hinário e nome, e navega pro detalhe", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          createHymnBookVersionFromOcr: {
            __typename: "HymnBookType",
            id: "b1",
            name: "O Cruzeiro",
            slug: "o-cruzeiro",
          },
        },
      }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    render(Page, { props: { data: pageData() } });
    await fireEvent.click(screen.getByTestId("confirmar-submit"));

    await waitFor(() => expect(gotoMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(body.variables).toEqual({
      taskId: TASK_ID,
      hymnbookSlug: "o-cruzeiro",
      versionName: "Edição 2020",
    });
    expect(gotoMock).toHaveBeenCalledWith("/hinarios/o-cruzeiro/");
  });

  it("erro da mutation mostra mensagem e mantém a tela", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          createHymnBookVersionFromOcr: {
            __typename: "NotFoundError",
            message: "Hinário de destino não encontrado.",
          },
        },
      }),
    ) as unknown as typeof fetch;

    render(Page, { props: { data: pageData() } });
    await fireEvent.click(screen.getByTestId("confirmar-submit"));

    await waitFor(() => expect(screen.getByTestId("confirmar-submit-error")).toBeInTheDocument());
    expect(screen.getByTestId("confirmar-submit-error")).toHaveTextContent(
      "Hinário de destino não encontrado.",
    );
    expect(gotoMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("confirmar-target")).toBeInTheDocument();
  });
});
