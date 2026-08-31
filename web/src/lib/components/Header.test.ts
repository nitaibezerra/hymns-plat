/**
 * Marco 4.B — Ciclo 4B.4.
 * Fase 2 da paridade visual (2026-08-31).
 *
 * Estes testes travam a PARIDADE com `templates/_partials/_header.html`, não o
 * header que a SPA tinha. Quatro asserções mudaram de lado no processo — antes
 * exigiam "hinária" em minúsculas e o username ao lado do avatar, que era
 * exatamente a divergência a corrigir. Um teste que fixa a divergência é pior
 * que teste nenhum: ele defende o bug.
 *
 * Ao mexer no header de um dos dois frontends, mexa nos dois no mesmo commit.
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import Header from "./Header.svelte";

const ANA = { id: "u1", username: "ana", email: "ana@example.com" };

/**
 * A gaveta mobile repete a marca, a busca e a CTA editorial — fielmente ao
 * monolito, que também tem os dois conjuntos. Então os testes desambiguam
 * pelos MESMOS atributos que o Django usa pra distinguir: `data-global-search`
 * e `data-editor-cta` só existem na versão desktop.
 */
function buscaGlobal(): HTMLInputElement {
  const campo = document.querySelector<HTMLInputElement>("[data-global-search]");
  if (!campo) throw new Error("campo de busca global não encontrado no header");
  return campo;
}

describe("Header", () => {
  it("renderiza a marca 'Hinaria' com o timão em ouro", () => {
    render(Header, { props: { currentUser: null } });
    // "Hinaria", como no monolito — não "hinária".
    expect(screen.getByTestId("brand")).toHaveTextContent("Hinaria");
    expect(screen.getByTestId("logo-mark")).toBeInTheDocument();
  });

  it("renderiza os três links de navegação, incluindo 'Início'", () => {
    render(Header, { props: { currentUser: null } });
    // "Início" faltava por completo na versão anterior.
    expect(screen.getByRole("link", { name: "Início" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Hinários" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Buscar" })).toBeInTheDocument();
  });

  it("aponta 'Buscar' pra /busca, a rota que existe de fato", () => {
    render(Header, { props: { currentUser: null } });
    expect(screen.getByRole("link", { name: "Buscar" }).getAttribute("href")).toBe("/busca");
  });

  it("aponta 'Hinários' pra /hinarios", () => {
    render(Header, { props: { currentUser: null } });
    expect(screen.getByRole("link", { name: "Hinários" }).getAttribute("href")).toBe("/hinarios");
  });

  it("renderiza o botão de alternância de tema", () => {
    render(Header, { props: { currentUser: null } });
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
  });

  it('mostra link "Entrar" quando não há usuário autenticado', () => {
    render(Header, { props: { currentUser: null } });
    expect(screen.getByRole("link", { name: /entrar/i })).toBeInTheDocument();
    expect(screen.queryByTestId("user-avatar")).toBeNull();
  });

  it("mostra avatar com DUAS iniciais quando há usuário autenticado", () => {
    render(Header, { props: { currentUser: ANA } });
    // `username|slice:":2"|upper` no monolito — "AN", não "A" nem "ana".
    expect(screen.getByTestId("user-avatar")).toHaveTextContent("AN");
    expect(screen.queryByRole("link", { name: /entrar/i })).toBeNull();
  });

  it("aponta o avatar pra /perfil/<username>, nao pra /perfil pelado", () => {
    render(Header, { props: { currentUser: ANA } });
    expect(screen.getByTestId("user-avatar").getAttribute("href")).toBe("/perfil/ana");
  });

  it("mostra o sino de notificações só para quem está autenticado", () => {
    render(Header, { props: { currentUser: null } });
    expect(screen.queryByTestId("notifications-link")).toBeNull();
  });

  it("liga o sino de notificações a /notificacoes quando autenticado", () => {
    render(Header, { props: { currentUser: ANA } });
    expect(screen.getByTestId("notifications-link").getAttribute("href")).toBe("/notificacoes");
  });

  describe("busca embutida com atalho ⌘K", () => {
    it("é um form GET pra /busca com campo `q`", () => {
      render(Header, { props: { currentUser: null } });
      const campo = buscaGlobal();
      expect(campo.getAttribute("name")).toBe("q");
      expect(campo.closest("form")?.getAttribute("action")).toBe("/busca");
      expect(campo.closest("form")?.getAttribute("method")).toBe("get");
    });

    it("mostra a dica do atalho", () => {
      render(Header, { props: { currentUser: null } });
      expect(screen.getByText("⌘K")).toBeInTheDocument();
    });

    it("⌘K foca o campo — a dica não é decoração", async () => {
      // Dica de atalho que não faz nada é pior que dica nenhuma. Paridade de
      // comportamento com `static/js/keyboard-shortcuts.js`.
      render(Header, { props: { currentUser: null } });
      const campo = buscaGlobal();
      expect(document.activeElement).not.toBe(campo);

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
      expect(document.activeElement).toBe(campo);
    });

    it("Ctrl+K também foca, pra quem não está no macOS", () => {
      render(Header, { props: { currentUser: null } });
      const campo = buscaGlobal();
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "K", ctrlKey: true }));
      expect(document.activeElement).toBe(campo);
    });

    it("`k` sozinho NÃO rouba o foco", () => {
      render(Header, { props: { currentUser: null } });
      const campo = buscaGlobal();
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k" }));
      expect(document.activeElement).not.toBe(campo);
    });
  });

  describe("item ativo", () => {
    it("marca 'Início' como página atual em /", () => {
      render(Header, { props: { currentUser: null, pathname: "/" } });
      expect(screen.getByRole("link", { name: "Início" })).toHaveAttribute("aria-current", "page");
      expect(screen.getByRole("link", { name: "Hinários" })).not.toHaveAttribute("aria-current");
    });

    it("marca 'Hinários' também nas rotas filhas — /hinarios/<slug>", () => {
      // O monolito usa `{% if books_url in request.path %}`, prefixo e não
      // igualdade: o detalhe de um hinário acende "Hinários".
      render(Header, { props: { currentUser: null, pathname: "/hinarios/lua-branca" } });
      expect(screen.getByRole("link", { name: "Hinários" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(screen.getByRole("link", { name: "Início" })).not.toHaveAttribute("aria-current");
    });

    it("marca 'Buscar' em /busca", () => {
      render(Header, { props: { currentUser: null, pathname: "/busca" } });
      expect(screen.getByRole("link", { name: "Buscar" })).toHaveAttribute("aria-current", "page");
    });
  });

  describe("CTA editorial", () => {
    it("não aparece pra quem não tem acesso editorial", () => {
      render(Header, { props: { currentUser: ANA, isEditor: false, editorPendingCount: 7 } });
      expect(document.querySelector("[data-editor-cta]")).toBeNull();
      expect(screen.queryByText("Fila de revisão")).toBeNull();
    });

    it("aparece pra editor, apontando pro workspace", () => {
      render(Header, { props: { currentUser: ANA, isEditor: true, editorPendingCount: 0 } });
      const cta = document.querySelector("[data-editor-cta]");
      expect(cta?.getAttribute("href")).toBe("/editor");
      expect(cta).toHaveTextContent("Fila de revisão");
    });

    it("mostra o badge de contagem quando há hinários pendentes", () => {
      render(Header, { props: { currentUser: ANA, isEditor: true, editorPendingCount: 7 } });
      expect(screen.getByTestId("editor-cta-count")).toHaveTextContent("7");
    });

    it("esconde o badge quando a contagem é zero — nada pendente, nada a mostrar", () => {
      render(Header, { props: { currentUser: ANA, isEditor: true, editorPendingCount: 0 } });
      expect(screen.queryByTestId("editor-cta-count")).toBeNull();
    });
  });

  describe("acessibilidade", () => {
    it("tem o link 'Pular para conteúdo' apontando pro #main", () => {
      render(Header, { props: { currentUser: null } });
      const skip = screen.getByRole("link", { name: /pular para conteúdo/i });
      expect(skip.getAttribute("href")).toBe("#main");
    });

    it("o botão do menu mobile declara o que controla", () => {
      render(Header, { props: { currentUser: null } });
      const botao = screen.getByRole("button", { name: /abrir menu/i });
      expect(botao.getAttribute("aria-controls")).toBe("mobile-menu");
      expect(botao.getAttribute("aria-expanded")).toBe("false");
    });
  });
});
