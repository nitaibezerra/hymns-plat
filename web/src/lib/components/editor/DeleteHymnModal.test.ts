/**
 * Sub-marco 5.D — Ciclo 5D.11.
 *
 * `DeleteHymnModal` — confirmação da deleção de um hino. Diferente do
 * hinário (5D.5), aqui não pedimos que o nome seja digitado: o estrago é de
 * um registro só e o editor precisa de agilidade. Ainda assim é um passo
 * explícito de confirmação, com o número e o título à vista.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DeleteHymnModal from "./DeleteHymnModal.svelte";

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

let ondeleted: ReturnType<typeof vi.fn>;
let onclose: ReturnType<typeof vi.fn>;

beforeEach(() => {
  ondeleted = vi.fn();
  onclose = vi.fn();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function renderModal(open = true) {
  return render(DeleteHymnModal, { props: { open, hymn: HYMN, ondeleted, onclose } });
}

describe("DeleteHymnModal (5D.11)", () => {
  it("não renderiza nada quando open=false", () => {
    renderModal(false);
    expect(screen.queryByTestId("delete-hymn-modal")).not.toBeInTheDocument();
  });

  it("mostra número, título e o aviso de irreversibilidade", () => {
    renderModal();
    const modal = screen.getByTestId("delete-hymn-modal");
    expect(modal).toHaveTextContent("12");
    expect(modal).toHaveTextContent("Sol, Lua, Estrela");
    expect(modal).toHaveTextContent(/irreversível/i);
  });

  it("chama deleteHymn com o pk ao confirmar", async () => {
    const fetchFn = stubFetch({
      data: { deleteHymn: { __typename: "DeleteResult", ok: true, deletedId: "h1" } },
    });
    renderModal();
    await fireEvent.click(screen.getByTestId("confirm-delete-hymn"));

    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.query).toContain("deleteHymn");
    expect(body.variables).toEqual({ pk: "h1" });
  });

  it("avisa ondeleted quando a deleção dá certo", async () => {
    stubFetch({ data: { deleteHymn: { __typename: "DeleteResult", ok: true, deletedId: "h1" } } });
    renderModal();
    await fireEvent.click(screen.getByTestId("confirm-delete-hymn"));

    await waitFor(() => expect(ondeleted).toHaveBeenCalledTimes(1));
  });

  it("mostra o erro e NÃO chama ondeleted quando o backend nega", async () => {
    stubFetch({
      data: { deleteHymn: { __typename: "PermissionDeniedError", message: "Sem permissão" } },
    });
    renderModal();
    await fireEvent.click(screen.getByTestId("confirm-delete-hymn"));

    await waitFor(() =>
      expect(screen.getByTestId("delete-hymn-error")).toHaveTextContent(/sem permissão/i),
    );
    expect(ondeleted).not.toHaveBeenCalled();
  });

  it("não dispara duas mutations em cliques repetidos", async () => {
    const fetchFn = stubFetch({
      data: { deleteHymn: { __typename: "DeleteResult", ok: true, deletedId: "h1" } },
    });
    renderModal();
    const button = screen.getByTestId("confirm-delete-hymn");
    await fireEvent.click(button);
    await fireEvent.click(button);

    await waitFor(() => expect(ondeleted).toHaveBeenCalledTimes(1));
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("Cancelar fecha o modal sem chamar a mutation", async () => {
    const fetchFn = stubFetch({ data: {} });
    renderModal();
    await fireEvent.click(screen.getByTestId("cancel-delete-hymn"));
    expect(onclose).toHaveBeenCalledTimes(1);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
