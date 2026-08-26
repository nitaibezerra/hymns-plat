/**
 * Marco 5.B — Ciclo 5B.1; consolidação da query do usuário (Frente B, B1).
 *
 * Guard do workspace editorial. Regra do contrato 5.A½: quem decide é
 * `UserType.isEditor`, NUNCA `currentUser !== null` — usuário logado comum
 * não é editor e tem que ser barrado igual anônimo.
 *
 * O guard mora no layout (e não em cada `+page.ts`) porque as frentes 5.C e
 * 5.D penduram rotas dentro de `/editor/` contando com ele.
 *
 * Desde a consolidação (B1) ele NÃO faz query própria: consome o
 * `currentUser` que o layout raiz já carregou, via `event.parent()`. Por isso
 * os cenários abaixo montam o `parent` chamando o loader real do shell
 * (`_loadLayout`) sobre um fetch falso — assim o teste cobre a cadeia inteira
 * (resposta do backend → shell → guard) em vez de fingir o meio dela.
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import { CURRENT_USER_QUERY } from "$lib/graphql/operations";

import Layout from "./+layout.svelte";
import { _loadEditorLayout } from "./+layout";
import { _loadLayout } from "../+layout";

function fakeFetch<T>(payload: T, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

/** `parent()` real do shell: mesma `_loadLayout` de `src/routes/+layout.ts`. */
function parentOf(fetchFn: typeof globalThis.fetch) {
  return () => _loadLayout({ fetch: fetchFn });
}

function editorUrl(pathname = "/editor/") {
  return new URL(`http://localhost${pathname}`);
}

describe("guard do /editor/ (5B.1)", () => {
  it("a query compartilhada do shell pede isEditor — o guard não precisa de outra", () => {
    expect(CURRENT_USER_QUERY).toMatch(/isEditor/);
  });

  it("consome o currentUser do layout raiz sem disparar request própria", async () => {
    const fetchFn = fakeFetch({
      data: { currentUser: { id: "u1", username: "ana", isEditor: true } },
    });
    await _loadEditorLayout({ parent: parentOf(fetchFn), url: editorUrl() });

    // Uma única ida ao backend, a do shell. Antes eram duas por navegação.
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    expect(body.query).toMatch(/currentUser/);
    expect(body.query).toMatch(/isEditor/);
  });

  it("libera passagem e devolve o editor quando isEditor=true", async () => {
    const fetchFn = fakeFetch({
      data: { currentUser: { id: "u1", username: "ana", isEditor: true } },
    });
    const result = await _loadEditorLayout({ parent: parentOf(fetchFn), url: editorUrl() });
    expect(result.editor).toEqual({ id: "u1", username: "ana", isEditor: true });
  });

  it("anônimo (currentUser null) redireciona pra /login?next=/editor/", async () => {
    const fetchFn = fakeFetch({ data: { currentUser: null } });
    await expect(
      _loadEditorLayout({ parent: parentOf(fetchFn), url: editorUrl() }),
    ).rejects.toMatchObject({
      status: 302,
      location: "/login?next=/editor/",
    });
  });

  it("logado mas NÃO editor também é redirecionado (isEditor=false, não currentUser!==null)", async () => {
    const fetchFn = fakeFetch({
      data: { currentUser: { id: "u2", username: "joao", isEditor: false } },
    });
    await expect(
      _loadEditorLayout({ parent: parentOf(fetchFn), url: editorUrl() }),
    ).rejects.toMatchObject({
      status: 302,
      location: "/login?next=/editor/",
    });
  });

  it("usuário sem o campo isEditor na resposta é barrado (falha fecha a porta)", async () => {
    const fetchFn = fakeFetch({ data: { currentUser: { id: "u3", username: "maria" } } });
    await expect(
      _loadEditorLayout({ parent: parentOf(fetchFn), url: editorUrl() }),
    ).rejects.toMatchObject({ status: 302 });
  });

  it("preserva o destino real no `next` (rotas filhas de 5.C/5.D)", async () => {
    const fetchFn = fakeFetch({ data: { currentUser: null } });
    await expect(
      _loadEditorLayout({
        parent: parentOf(fetchFn),
        url: editorUrl("/editor/hinarios/o-cruzeiro/"),
      }),
    ).rejects.toMatchObject({
      status: 302,
      location: "/login?next=/editor/hinarios/o-cruzeiro/",
    });
  });

  it("erro de permissão do backend (PT-BR) redireciona em vez de vazar tela vazia", async () => {
    const fetchFn = fakeFetch({
      data: { currentUser: null },
      errors: [{ message: "Você não tem permissão para realizar essa ação." }],
    });
    await expect(
      _loadEditorLayout({ parent: parentOf(fetchFn), url: editorUrl() }),
    ).rejects.toMatchObject({
      status: 302,
      location: "/login?next=/editor/",
    });
  });

  it("backend fora do ar (HTTP 500) redireciona — sem editor confirmado, sem workspace", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    await expect(
      _loadEditorLayout({ parent: parentOf(fetchFn), url: editorUrl() }),
    ).rejects.toMatchObject({
      status: 302,
    });
  });

  it("exceção de rede não escapa como stack trace — vira redirect", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(
      _loadEditorLayout({ parent: parentOf(fetchFn), url: editorUrl() }),
    ).rejects.toMatchObject({
      status: 302,
      location: "/login?next=/editor/",
    });
  });

  it("parent() que rejeita também vira redirect, não 500 na cara do editor", async () => {
    const parent = () => Promise.reject(new Error("load do shell explodiu"));
    await expect(_loadEditorLayout({ parent, url: editorUrl() })).rejects.toMatchObject({
      status: 302,
      location: "/login?next=/editor/",
    });
  });
});

describe("shell do /editor/ (5B.1)", () => {
  it("renderiza o wrapper do workspace com o username do editor", () => {
    render(Layout, {
      props: { data: { editor: { id: "u1", username: "ana", isEditor: true } } },
    });
    const shell = screen.getByTestId("editor-shell");
    expect(shell).toBeInTheDocument();
    expect(shell).toHaveTextContent(/workspace editorial/i);
    expect(shell).toHaveTextContent("ana");
  });
});
