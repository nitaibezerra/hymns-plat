/**
 * Sub-marco 5.D — Ciclo 5D.5.
 *
 * `DeleteHymnBookModal` — confirmação destrutiva do hinário. Diferente do
 * template Django (`hymnbook_confirm_delete.html`, que só pede um clique),
 * aqui exigimos que o editor DIGITE o nome do hinário: a deleção leva os
 * hinos junto (cascade) e o modal fica a um clique de distância na tela do
 * detalhe editorial.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DeleteHymnBookModal from "./DeleteHymnBookModal.svelte";

const HYMNBOOK = { name: "O Cruzeiro", slug: "cruzeiro", hymnsTotal: 132 };

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
  return render(DeleteHymnBookModal, {
    props: { open, hymnbook: HYMNBOOK, ondeleted, onclose },
  });
}

async function typeName(value: string) {
  await fireEvent.input(screen.getByLabelText(/digite o nome do hinário/i), {
    target: { value },
  });
}

describe("DeleteHymnBookModal (5D.5)", () => {
  it("não renderiza nada quando open=false", () => {
    renderModal(false);
    expect(screen.queryByTestId("delete-hymnbook-modal")).not.toBeInTheDocument();
  });

  it("mostra o nome do hinário e o aviso de irreversibilidade com a contagem de hinos", () => {
    renderModal();
    const modal = screen.getByTestId("delete-hymnbook-modal");
    expect(modal).toHaveTextContent("O Cruzeiro");
    expect(modal).toHaveTextContent(/irreversível/i);
    expect(modal).toHaveTextContent(/132 hino/i);
  });

  it("botão de deletar começa desabilitado", () => {
    renderModal();
    expect(screen.getByTestId("confirm-delete")).toBeDisabled();
  });

  it("continua desabilitado quando o nome digitado não bate", async () => {
    renderModal();
    await typeName("O Cruzeirinho");
    expect(screen.getByTestId("confirm-delete")).toBeDisabled();
  });

  it("habilita o botão quando o nome digitado bate (ignorando espaços nas pontas)", async () => {
    renderModal();
    await typeName("  O Cruzeiro  ");
    expect(screen.getByTestId("confirm-delete")).toBeEnabled();
  });

  it("chama deleteHymnBook com o slug ao confirmar", async () => {
    const fetchFn = stubFetch({
      data: { deleteHymnBook: { __typename: "DeleteResult", ok: true, deletedId: "hb1" } },
    });
    renderModal();
    await typeName("O Cruzeiro");
    await fireEvent.click(screen.getByTestId("confirm-delete"));

    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.query).toContain("deleteHymnBook");
    expect(body.variables).toEqual({ slug: "cruzeiro" });
  });

  it("avisa quem chamou (ondeleted) quando a deleção dá certo", async () => {
    stubFetch({
      data: { deleteHymnBook: { __typename: "DeleteResult", ok: true, deletedId: "hb1" } },
    });
    renderModal();
    await typeName("O Cruzeiro");
    await fireEvent.click(screen.getByTestId("confirm-delete"));

    await waitFor(() => expect(ondeleted).toHaveBeenCalledTimes(1));
  });

  it("mostra o erro e NÃO chama ondeleted quando o backend nega", async () => {
    stubFetch({
      data: { deleteHymnBook: { __typename: "PermissionDeniedError", message: "Sem permissão" } },
    });
    renderModal();
    await typeName("O Cruzeiro");
    await fireEvent.click(screen.getByTestId("confirm-delete"));

    await waitFor(() =>
      expect(screen.getByTestId("delete-error")).toHaveTextContent(/sem permissão/i),
    );
    expect(ondeleted).not.toHaveBeenCalled();
  });

  it("Cancelar fecha o modal sem chamar a mutation", async () => {
    const fetchFn = stubFetch({ data: {} });
    renderModal();
    await fireEvent.click(screen.getByTestId("cancel-delete"));
    expect(onclose).toHaveBeenCalledTimes(1);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
