/**
 * Sub-marco 5.F — Ciclo 5F.12.
 *
 * Tela 3a do wizard, porta de `apps/users/views.py::upload_disambiguate_view`.
 *
 * Contrato da load function:
 *   - sem `?task=` → volta pra `/contribuir/`;
 *   - erro de auth → login preservando o passo;
 *   - task inexistente → 404 em PT-BR;
 *   - **sem duplicatas** (ou desambiguação indisponível no backend) → não há
 *     nada pra desambiguar: segue pra conferência. O Django devolvia pra
 *     `users:upload` porque dependia da sessão; aqui o estado está na URL,
 *     então dá pra avançar em vez de recomeçar;
 *   - com duplicatas → devolve o nome/contagem do envio + match exato +
 *     similares.
 *
 * Contrato da tela: match exato em destaque, cada similar com os dois scores.
 */

import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import Page from "./+page.svelte";
import { _loadDesambiguar } from "./+page";

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

function makeUrl(search = `?task=${TASK_ID}`) {
  return new URL(`http://localhost/contribuir/desambiguar/${search}`);
}

function taskPayload(hymns = [{ number: 1, title: "Estrela" }, { number: 2, title: "Lua" }]) {
  return {
    data: {
      ocrTask: {
        id: TASK_ID,
        status: "completed",
        currentPage: 10,
        totalPages: 10,
        progressPct: 100,
        errorMessage: "",
        pdfFilename: "hinario.pdf",
        resultData: { hymn_book: { name: "O Justiceiro", owner: "Padrinho", hymns } },
      },
    },
  };
}

function book(name: string, slug: string, hymnsTotal = 20) {
  return { id: `id-${slug}`, name, slug, ownerName: "Padrinho", stats: { hymnsTotal } };
}

function duplicatesPayload(exactMatch: unknown = null, highConfidence: unknown[] = []) {
  return { data: { ocrDuplicates: { exactMatch, highConfidence } } };
}

function fetchSequence(...responses: Response[]) {
  const fn = vi.fn();
  responses.forEach((r) => fn.mockResolvedValueOnce(r));
  return fn;
}

describe("desambiguar load function (5F.12)", () => {
  it("sem ?task= volta pra /contribuir/", async () => {
    const fetchFn = vi.fn();
    await expect(_loadDesambiguar({ fetch: fetchFn, url: makeUrl("") })).rejects.toMatchObject({
      status: 302,
      location: "/contribuir/",
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("erro de auth redireciona pro login preservando o passo", async () => {
    const fetchFn = fetchSequence(
      jsonResponse({ data: { ocrTask: null }, errors: [{ message: "Permission denied" }] }),
    );
    await expect(_loadDesambiguar({ fetch: fetchFn, url: makeUrl() })).rejects.toMatchObject({
      status: 302,
      location: "/login?next=/contribuir/desambiguar/",
    });
  });

  it("task inexistente devolve 404", async () => {
    const fetchFn = fetchSequence(jsonResponse({ data: { ocrTask: null } }));
    await expect(_loadDesambiguar({ fetch: fetchFn, url: makeUrl() })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("sem duplicatas segue pra conferência", async () => {
    const fetchFn = fetchSequence(jsonResponse(taskPayload()), jsonResponse(duplicatesPayload()));
    await expect(_loadDesambiguar({ fetch: fetchFn, url: makeUrl() })).rejects.toMatchObject({
      status: 302,
      location: `/contribuir/conferir/?task=${TASK_ID}`,
    });
  });

  it("desambiguação indisponível no backend também segue pra conferência", async () => {
    const fetchFn = fetchSequence(
      jsonResponse(taskPayload()),
      jsonResponse({ data: null, errors: [{ message: "Cannot query field 'ocrDuplicates'" }] }),
    );
    await expect(_loadDesambiguar({ fetch: fetchFn, url: makeUrl() })).rejects.toMatchObject({
      status: 302,
      location: `/contribuir/conferir/?task=${TASK_ID}`,
    });
  });

  it("com duplicatas devolve nome do envio, contagem e similares", async () => {
    const fetchFn = fetchSequence(
      jsonResponse(taskPayload([{ number: 1, title: "A" }, { number: 2, title: "B" }, { number: 3, title: "C" }])),
      jsonResponse(
        duplicatesPayload(book("O Justiceiro", "o-justiceiro"), [
          { nameScore: 0.83, contentScore: 0.9, hymnbook: book("O Cruzeiro", "o-cruzeiro", 132) },
        ]),
      ),
    );
    const result = await _loadDesambiguar({ fetch: fetchFn, url: makeUrl() });
    expect(result.taskId).toBe(TASK_ID);
    expect(result.uploadName).toBe("O Justiceiro");
    expect(result.hymnsCount).toBe(3);
    expect(result.duplicates.exactMatch?.slug).toBe("o-justiceiro");
    expect(result.duplicates.similar).toHaveLength(1);
  });
});

function pageData(overrides: Record<string, unknown> = {}) {
  return {
    currentUser: null,
    taskId: TASK_ID,
    uploadName: "O Justiceiro",
    hymnsCount: 3,
    duplicates: {
      exactMatch: {
        id: "id-o-justiceiro",
        name: "O Justiceiro",
        slug: "o-justiceiro",
        ownerName: "Padrinho",
        hymnsTotal: 20,
      },
      similar: [
        {
          hymnbook: {
            id: "id-o-cruzeiro",
            name: "O Cruzeiro",
            slug: "o-cruzeiro",
            ownerName: "Mestre Irineu",
            hymnsTotal: 132,
          },
          nameScore: 0.83,
          contentScore: 0.9,
        },
      ],
      hasDuplicates: true,
      unavailable: false,
    },
    error: null,
    ...overrides,
  };
}

describe("desambiguar page (5F.12)", () => {
  it("mostra o passo 3 do stepper", () => {
    render(Page, { props: { data: pageData() } });
    const steps = screen.getAllByTestId("upload-step");
    expect(steps[2]).toHaveAttribute("data-state", "current");
  });

  it("mostra o hinário que está sendo enviado com a contagem de hinos", () => {
    render(Page, { props: { data: pageData() } });
    const summary = screen.getByTestId("upload-summary");
    expect(summary).toHaveTextContent("O Justiceiro");
    expect(summary).toHaveTextContent("3");
  });

  it("destaca o match exato", () => {
    render(Page, { props: { data: pageData() } });
    expect(screen.getByTestId("exact-match")).toHaveTextContent("O Justiceiro");
  });

  it("sem match exato não desenha o bloco de destaque", () => {
    const data = pageData();
    (data.duplicates as { exactMatch: unknown }).exactMatch = null;
    render(Page, { props: { data } });
    expect(screen.queryByTestId("exact-match")).toBeNull();
  });

  it("lista cada similar com os dois scores em %", () => {
    render(Page, { props: { data: pageData() } });
    expect(screen.getAllByTestId("similar-book-card")).toHaveLength(1);
    expect(screen.getByTestId("similar-name-score")).toHaveTextContent("83%");
    expect(screen.getByTestId("similar-content-score")).toHaveTextContent("90%");
  });
});

describe("desambiguar escolhas (5F.13)", () => {
  it("criar novo hinário navega pra conferência", async () => {
    gotoMock.mockClear();
    render(Page, { props: { data: pageData() } });
    await fireEvent.submit(screen.getByTestId("disambiguation-choice"));
    expect(gotoMock).toHaveBeenCalledWith(`/contribuir/conferir/?task=${TASK_ID}`);
  });

  it("adicionar como versão leva pra confirmação com hinário e nome na URL", async () => {
    gotoMock.mockClear();
    render(Page, { props: { data: pageData() } });

    await fireEvent.click(screen.getByTestId("choice-add-version"));
    await fireEvent.change(screen.getByTestId("choice-hymnbook"), {
      target: { value: "o-cruzeiro" },
    });
    await fireEvent.input(screen.getByTestId("choice-version-name"), {
      target: { value: "Edição 2020" },
    });
    await fireEvent.submit(screen.getByTestId("disambiguation-choice"));

    const target = gotoMock.mock.calls[0][0] as string;
    const url = new URL(target, "http://localhost");
    expect(url.pathname).toBe("/contribuir/confirmar/");
    expect(url.searchParams.get("task")).toBe(TASK_ID);
    expect(url.searchParams.get("hinario")).toBe("o-cruzeiro");
    expect(url.searchParams.get("versao")).toBe("Edição 2020");
  });

  it("cancelar volta pra /contribuir/ sem levar estado do wizard", async () => {
    gotoMock.mockClear();
    render(Page, { props: { data: pageData() } });
    await fireEvent.click(screen.getByTestId("choice-cancel"));
    await fireEvent.submit(screen.getByTestId("disambiguation-choice"));
    expect(gotoMock).toHaveBeenCalledWith("/contribuir/");
  });
});
