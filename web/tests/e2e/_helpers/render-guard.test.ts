/**
 * Testes da guarda de renderização.
 *
 * Motivo de existir: em 2026-08-26 TODAS as rotas do SvelteKit renderizaram
 * `Falha ao carregar: HTTP 403` (CSRF no `POST /graphql/` em SSR) e a suíte
 * antiga ainda "mediu" pixels — produzindo números que pareciam paridade de
 * design mas comparavam página de erro contra página real. A guarda faz a
 * suíte falhar dizendo *isso*, em vez de cuspir um percentual sem sentido.
 *
 * Rodam sem servidor nenhum.
 */

import { expect, test } from "@playwright/test";

import { countOccurrences, findEmptyState, findLoadFailure } from "./render-guard";

test.describe("guarda de renderização (render-guard)", () => {
  test("página com conteúdo real não acusa falha", () => {
    const html = `<html><body><h1>O Justiceiro</h1>
      <p>Hinário publicado com 32 hinos.</p></body></html>`;
    expect(findLoadFailure(html)).toBeNull();
  });

  test("acusa o bloco data-testid=error e devolve o texto dele", () => {
    const html = `<html><body><p data-testid="error">Falha ao carregar stats: HTTP 403</p></body></html>`;
    const failure = findLoadFailure(html);
    expect(failure).not.toBeNull();
    expect(failure).toContain("HTTP 403");
  });

  test("aceita aspas simples no atributo", () => {
    const html = `<p data-testid='error'>Falha ao carregar hinário: HTTP 500</p>`;
    expect(findLoadFailure(html)).toContain("HTTP 500");
  });

  test("acusa 'Falha ao carregar' mesmo sem o testid", () => {
    const html = `<html><body><div>Falha ao carregar hinários</div></body></html>`;
    expect(findLoadFailure(html)).toContain("Falha ao carregar");
  });

  test("não confunde conteúdo legítimo que fala de erro", () => {
    const html = `<html><body><h1>Erro e Perdão</h1>
      <p>Hino sobre o erro humano.</p></body></html>`;
    expect(findLoadFailure(html)).toBeNull();
  });
});

test.describe("guarda de estado vazio (findEmptyState)", () => {
  test("página com itens listados não acusa vazio", () => {
    const html = `<ul><li><a href="/hinos/abc/">01 Trazendo a Minha Luz</a></li>
      <li><a href="/hinos/def/">02 A Estrela Que Me Guia</a></li></ul>`;
    expect(findEmptyState(html)).toBeNull();
  });

  test("acusa o estado de 'nenhum resultado' do shell", () => {
    // O falso verde medido em 2026-08-26: 1,74% de diff (DENTRO do threshold
    // de 5%) com o Django listando 50 resultados e o shell dizendo isto.
    const html = `<div data-testid="search-empty">Nenhum resultado para "luz". Tente outros termos.</div>`;
    expect(findEmptyState(html)).not.toBeNull();
  });

  test("acusa qualquer marcador *-empty do shell", () => {
    expect(findEmptyState(`<p data-testid="followers-empty">sem seguidores</p>`)).not.toBeNull();
    expect(findEmptyState(`<p data-testid="notifications-empty">sem nada</p>`)).not.toBeNull();
    expect(findEmptyState(`<p data-testid="empty">sem nada</p>`)).not.toBeNull();
  });

  test("acusa o placeholder da busca sem query", () => {
    const html = `<div data-testid="search-placeholder">Comece pela busca.</div>`;
    expect(findEmptyState(html)).not.toBeNull();
  });

  test("acusa as frases de estado vazio do Django, que não tem testid", () => {
    expect(findEmptyState(`<p class="text-ink-soft">Nenhum hino cadastrado.</p>`)).toBe(
      "Nenhum hino cadastrado",
    );
    expect(findEmptyState(`<h3>Nenhum seguidor ainda</h3>`)).toBe("Nenhum seguidor ainda");
  });

  test("não acusa vazio em texto legítimo que só parece", () => {
    // "Nenhum" solto aparece em letra de hino; a lista de frases é explícita
    // justamente pra um falso positivo não apagar a medição.
    const html = `<p>Nenhum de nós caminha só nesta estrada</p>`;
    expect(findEmptyState(html)).toBeNull();
  });
});

test.describe("contagem de itens (countOccurrences)", () => {
  test("conta links de hino nos dois lados com o mesmo trecho", () => {
    const django = `<a href="/hinos/aaa/">01</a><a href="/hinos/bbb/">02</a>`;
    const svelte = `<a href="/hinos/aaa">01</a><a href="/hinos/bbb">02</a><a href="/hinos/ccc">03</a>`;
    expect(countOccurrences(django, `href="/hinos/`)).toBe(2);
    expect(countOccurrences(svelte, `href="/hinos/`)).toBe(3);
  });

  test("devolve 0 quando o trecho não aparece", () => {
    expect(countOccurrences("<p>nada aqui</p>", `href="/hinos/`)).toBe(0);
  });

  test("não entra em laço infinito com agulha vazia", () => {
    expect(countOccurrences("<p>x</p>", "")).toBe(0);
  });
});
