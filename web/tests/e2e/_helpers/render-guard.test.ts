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

import { findLoadFailure } from "./render-guard";

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
