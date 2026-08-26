/**
 * Sub-marco 5.D — Ciclo 5D.6.
 *
 * `PublishHymnBookModal` — checklist de publicação vindo de
 * `Query.publishReadiness(slug)`. O botão "Publicar" só habilita quando
 * `canPublish` é true; nenhuma regra é reimplementada no cliente (o
 * `publish_readiness` do Django é a autoridade).
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PublishHymnBookModal from "./PublishHymnBookModal.svelte";

const originalFetch = globalThis.fetch;

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetch(...payloads: unknown[]) {
  const fn = vi.fn();
  payloads.forEach((p) => fn.mockResolvedValueOnce(jsonResponse(p)));
  // Qualquer chamada extra devolve o último payload.
  fn.mockResolvedValue(jsonResponse(payloads[payloads.length - 1]));
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

function readinessPayload(canPublish: boolean) {
  return {
    data: {
      publishReadiness: {
        canPublish,
        checks: [
          { key: "has_hymns", label: "Tem pelo menos um hino", ok: true },
          { key: "all_reviewed", label: "Todos os hinos revisados", ok: canPublish },
          { key: "has_owner", label: "Dono/autor preenchido", ok: true },
        ],
      },
    },
  };
}

let onclose: ReturnType<typeof vi.fn>;
let onchanged: ReturnType<typeof vi.fn>;

beforeEach(() => {
  onclose = vi.fn();
  onchanged = vi.fn();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function renderModal(overrides: Record<string, unknown> = {}) {
  return render(PublishHymnBookModal, {
    props: {
      open: true,
      hymnbook: { name: "O Cruzeiro", slug: "cruzeiro", isPublished: false },
      onclose,
      onchanged,
      ...overrides,
    },
  });
}

describe("PublishHymnBookModal — checklist (5D.6)", () => {
  it("não renderiza nem consulta o backend quando open=false", () => {
    const fetchFn = stubFetch(readinessPayload(true));
    renderModal({ open: false });
    expect(screen.queryByTestId("publish-hymnbook-modal")).not.toBeInTheDocument();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("consulta publishReadiness com o slug ao abrir", async () => {
    const fetchFn = stubFetch(readinessPayload(true));
    renderModal();
    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.query).toContain("publishReadiness");
    expect(body.variables).toEqual({ slug: "cruzeiro" });
  });

  it("renderiza um item por check com o label do backend", async () => {
    stubFetch(readinessPayload(false));
    renderModal();
    await waitFor(() => expect(screen.getAllByTestId("readiness-check")).toHaveLength(3));
    expect(screen.getByText("Todos os hinos revisados")).toBeInTheDocument();
  });

  it("marca visualmente os checks que falharam", async () => {
    stubFetch(readinessPayload(false));
    renderModal();
    await waitFor(() => expect(screen.getAllByTestId("readiness-check")).toHaveLength(3));
    const failed = screen.getAllByTestId("readiness-check").filter(
      (el) => el.getAttribute("data-ok") === "false",
    );
    expect(failed).toHaveLength(1);
    expect(failed[0]).toHaveTextContent("Todos os hinos revisados");
  });

  it("desabilita 'Publicar' quando canPublish=false", async () => {
    stubFetch(readinessPayload(false));
    renderModal();
    await waitFor(() => expect(screen.getByTestId("confirm-publish")).toBeDisabled());
  });

  it("habilita 'Publicar' quando canPublish=true", async () => {
    stubFetch(readinessPayload(true));
    renderModal();
    await waitFor(() => expect(screen.getByTestId("confirm-publish")).toBeEnabled());
  });

  it("mantém 'Publicar' desabilitado enquanto o checklist carrega", () => {
    stubFetch(readinessPayload(true));
    renderModal();
    expect(screen.getByTestId("confirm-publish")).toBeDisabled();
  });

  it("mostra erro quando publishReadiness devolve null (hinário inexistente)", async () => {
    stubFetch({ data: { publishReadiness: null } });
    renderModal();
    await waitFor(() =>
      expect(screen.getByTestId("readiness-error")).toHaveTextContent(/não foi possível/i),
    );
    expect(screen.getByTestId("confirm-publish")).toBeDisabled();
  });

  it("Cancelar fecha o modal", async () => {
    stubFetch(readinessPayload(true));
    renderModal();
    await fireEvent.click(screen.getByTestId("cancel-publish"));
    expect(onclose).toHaveBeenCalledTimes(1);
  });

  it("no modo despublicar não consulta o checklist", async () => {
    const fetchFn = stubFetch(readinessPayload(true));
    renderModal({ hymnbook: { name: "O Cruzeiro", slug: "cruzeiro", isPublished: true } });
    expect(screen.getByTestId("publish-hymnbook-modal")).toHaveTextContent(/despublicar/i);
    await waitFor(() => expect(screen.getByTestId("confirm-publish")).toBeEnabled());
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 5D.7 — submit chama `publishHymnBook` / `unpublishHymnBook`
// ---------------------------------------------------------------------------

describe("PublishHymnBookModal — submit (5D.7)", () => {
  it("chama publishHymnBook com o slug quando o hinário está em rascunho", async () => {
    const fetchFn = stubFetch(readinessPayload(true), {
      data: { publishHymnBook: { __typename: "PublishResult", ok: true, failedChecks: [] } },
    });
    renderModal();
    await waitFor(() => expect(screen.getByTestId("confirm-publish")).toBeEnabled());
    await fireEvent.click(screen.getByTestId("confirm-publish"));

    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(2));
    const body = JSON.parse(fetchFn.mock.calls[1][1].body as string);
    expect(body.query).toContain("publishHymnBook");
    expect(body.variables).toEqual({ slug: "cruzeiro" });
  });

  it("avisa onchanged quando a publicação dá certo", async () => {
    stubFetch(readinessPayload(true), {
      data: { publishHymnBook: { __typename: "PublishResult", ok: true, failedChecks: [] } },
    });
    renderModal();
    await waitFor(() => expect(screen.getByTestId("confirm-publish")).toBeEnabled());
    await fireEvent.click(screen.getByTestId("confirm-publish"));

    await waitFor(() => expect(onchanged).toHaveBeenCalledTimes(1));
  });

  it("mostra as pendências quando PublishResult vem ok=false", async () => {
    stubFetch(readinessPayload(true), {
      data: {
        publishHymnBook: {
          __typename: "PublishResult",
          ok: false,
          failedChecks: ["Todos os hinos revisados"],
        },
      },
    });
    renderModal();
    await waitFor(() => expect(screen.getByTestId("confirm-publish")).toBeEnabled());
    await fireEvent.click(screen.getByTestId("confirm-publish"));

    await waitFor(() =>
      expect(screen.getByTestId("publish-error")).toHaveTextContent(/todos os hinos revisados/i),
    );
    expect(onchanged).not.toHaveBeenCalled();
  });

  it("mostra PermissionDeniedError e não avisa onchanged", async () => {
    stubFetch(readinessPayload(true), {
      data: { publishHymnBook: { __typename: "PermissionDeniedError", message: "Sem permissão" } },
    });
    renderModal();
    await waitFor(() => expect(screen.getByTestId("confirm-publish")).toBeEnabled());
    await fireEvent.click(screen.getByTestId("confirm-publish"));

    await waitFor(() =>
      expect(screen.getByTestId("publish-error")).toHaveTextContent(/sem permissão/i),
    );
    expect(onchanged).not.toHaveBeenCalled();
  });

  it("chama unpublishHymnBook quando o hinário está publicado", async () => {
    const fetchFn = stubFetch({
      data: { unpublishHymnBook: { __typename: "HymnBookType", id: "hb1", slug: "cruzeiro", name: "O Cruzeiro" } },
    });
    renderModal({ hymnbook: { name: "O Cruzeiro", slug: "cruzeiro", isPublished: true } });
    await fireEvent.click(screen.getByTestId("confirm-publish"));

    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.query).toContain("unpublishHymnBook");
    expect(body.variables).toEqual({ slug: "cruzeiro" });
    await waitFor(() => expect(onchanged).toHaveBeenCalledTimes(1));
  });
});
