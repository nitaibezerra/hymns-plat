/**
 * Sub-marco 5.F — Ciclo 5F.5.
 *
 * `/contribuir/` porta uma view `@login_required`. O contrato:
 *
 *   - anônimo (`currentUser: null`) → redirect 302 pra `/login?next=/contribuir/`;
 *   - erro de auth vindo do GraphQL → mesmo redirect;
 *   - autenticado → devolve o usuário pra página;
 *   - erro HTTP não é confundido com auth (não redireciona; vira `data.error`).
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Page from "./+page.svelte";
import { _loadContribuir } from "./+page";

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

describe("contribuir guard de autenticação (5F.5)", () => {
  it("anônimo é redirecionado pra /login?next=/contribuir/", async () => {
    const fetchFn = fakeFetch({ data: { currentUser: null } });
    await expect(_loadContribuir({ fetch: fetchFn })).rejects.toMatchObject({
      status: 302,
      location: "/login?next=/contribuir/",
    });
  });

  it("erro de auth do GraphQL também redireciona", async () => {
    const fetchFn = fakeFetch({
      data: { currentUser: null },
      errors: [{ message: "User must be authenticated" }],
    });
    await expect(_loadContribuir({ fetch: fetchFn })).rejects.toMatchObject({
      status: 302,
      location: "/login?next=/contribuir/",
    });
  });

  it("autenticado recebe o currentUser", async () => {
    const fetchFn = fakeFetch({ data: { currentUser: { id: "1", username: "maria" } } });
    const result = await _loadContribuir({ fetch: fetchFn });
    expect(result.currentUser).toEqual({ id: "1", username: "maria" });
    expect(result.error).toBeNull();
  });

  it("erro HTTP não vira redirect — vira data.error", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    const result = await _loadContribuir({ fetch: fetchFn });
    expect(result.error).toMatch(/HTTP 500/);
  });
});

describe("contribuir page (5F.5)", () => {
  it("renderiza o cabeçalho do wizard", () => {
    render(Page, { props: { data: { currentUser: { id: "1", username: "maria" }, error: null } } });
    expect(screen.getByTestId("contribuir-page")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/PDF/i);
  });

  it("mostra o passo 1 do stepper", () => {
    render(Page, { props: { data: { currentUser: { id: "1", username: "maria" }, error: null } } });
    const steps = screen.getAllByTestId("upload-step");
    expect(steps[0]).toHaveAttribute("data-state", "current");
  });
});

const TASK_ID = "6f1c0d3e-9a52-4c81-bf0e-9a1a1c1d2e3f";

function pageData() {
  return { currentUser: { id: "1", username: "maria" }, error: null };
}

async function fillAndSubmit() {
  const pdf = new File(["x"], "hinario.pdf", { type: "application/pdf" });
  await fireEvent.input(screen.getByTestId("name-input"), { target: { value: "O Justiceiro" } });
  await fireEvent.input(screen.getByTestId("owner-input"), { target: { value: "Padrinho" } });
  const pdfInput = screen.getByTestId("pdf-input");
  Object.defineProperty(pdfInput, "files", { value: [pdf], configurable: true });
  await fireEvent.change(pdfInput);
  await fireEvent.submit(screen.getByTestId("contribuir-form"));
}

describe("contribuir submit do upload (5F.8)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    gotoMock.mockClear();
    document.cookie = "csrftoken=TOKEN123";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sobe o PDF e navega pra /contribuir/processando/?task=<id>", async () => {
    const response = new Response("<html>ok</html>", { status: 200 });
    Object.defineProperty(response, "url", {
      value: `http://localhost:8000/contribuir/processando/?task=${TASK_ID}`,
    });
    globalThis.fetch = vi.fn().mockResolvedValue(response) as unknown as typeof fetch;

    render(Page, { props: { data: pageData() } });
    await fillAndSubmit();

    await waitFor(() => expect(gotoMock).toHaveBeenCalledTimes(1));
    expect(gotoMock).toHaveBeenCalledWith(`/contribuir/processando/?task=${TASK_ID}`);
  });

  it("falha no upload mostra mensagem em PT-BR e não navega", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("", { status: 500 })) as unknown as typeof fetch;

    render(Page, { props: { data: pageData() } });
    await fillAndSubmit();

    await waitFor(() => expect(screen.getByTestId("submit-error")).toBeInTheDocument());
    expect(gotoMock).not.toHaveBeenCalled();
  });

  it("formulário inválido não chama o backend", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    render(Page, { props: { data: pageData() } });
    await fireEvent.submit(screen.getByTestId("contribuir-form"));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(gotoMock).not.toHaveBeenCalled();
  });
});
