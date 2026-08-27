/**
 * Frente B, B2 — o default de `VITE_GRAPHQL_URL` não pode ser silencioso.
 *
 * Sintoma que motivou isto: sem a variável, o SSR falava com o que estivesse
 * na :8000 e o erro que aparecia era **CORS** — depura-se o sintoma errado.
 * A regra agora é: em dev o fallback continua existindo (é o Django local, o
 * setup mais comum), mas AVISA alto dizendo qual URL está em uso e como
 * trocar; em produção não existe fallback, porque um bundle apontando pra
 * localhost é bug grave — melhor morrer no boot com a causa na tela.
 */

import { describe, expect, it, vi } from "vitest";

import { _resolveGraphqlUrl, FALLBACK_GRAPHQL_URL, GRAPHQL_URL } from "./config";

describe("resolução da URL do GraphQL (B2)", () => {
  it("usa a variável quando ela está definida", () => {
    const warn = vi.fn();
    const url = _resolveGraphqlUrl(
      { VITE_GRAPHQL_URL: "https://api.hinaria.com.br/graphql/", DEV: true, MODE: "development" },
      warn,
    );
    expect(url).toBe("https://api.hinaria.com.br/graphql/");
    expect(warn).not.toHaveBeenCalled();
  });

  it("apara espaços em volta do valor (`.env` copiado com sobra)", () => {
    const url = _resolveGraphqlUrl(
      { VITE_GRAPHQL_URL: "  http://localhost:9000/graphql/  ", DEV: true, MODE: "development" },
      vi.fn(),
    );
    expect(url).toBe("http://localhost:9000/graphql/");
  });

  it("em dev sem a variável, avisa alto: nomeia a URL em uso, a variável e o sintoma", () => {
    const warn = vi.fn();
    const url = _resolveGraphqlUrl({ DEV: true, MODE: "development" }, warn);

    expect(url).toBe(FALLBACK_GRAPHQL_URL);
    expect(warn).toHaveBeenCalledTimes(1);
    const aviso = warn.mock.calls[0][0] as string;
    expect(aviso).toContain("VITE_GRAPHQL_URL");
    expect(aviso).toContain(FALLBACK_GRAPHQL_URL);
    expect(aviso).toMatch(/CORS/);
  });

  it("valor vazio ou só espaços conta como ausente", () => {
    const warn = vi.fn();
    expect(_resolveGraphqlUrl({ VITE_GRAPHQL_URL: "   ", DEV: true, MODE: "development" }, warn)).toBe(
      FALLBACK_GRAPHQL_URL,
    );
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("no modo test não avisa — o fallback ali é deliberado e a saída fica limpa", () => {
    const warn = vi.fn();
    expect(_resolveGraphqlUrl({ DEV: true, MODE: "test" }, warn)).toBe(FALLBACK_GRAPHQL_URL);
    expect(warn).not.toHaveBeenCalled();
  });

  it("em produção servindo, sem a variável, falha rápido em vez de embutir localhost", () => {
    const warn = vi.fn();
    expect(() => _resolveGraphqlUrl({ PROD: true, MODE: "production" }, warn)).toThrowError(
      /VITE_GRAPHQL_URL/,
    );
    // Nada de fallback disfarçado de aviso: servindo em prod é erro.
    expect(warn).not.toHaveBeenCalled();
  });

  it("durante o build de produção avisa em vez de derrubar o `vite build`", () => {
    // A etapa `analyse` do SvelteKit importa todo módulo de rota pra ler
    // `prerender`/`ssr`; um throw aqui mataria o smoke build do CI, que roda
    // de propósito sem a variável.
    const warn = vi.fn();
    const url = _resolveGraphqlUrl({ PROD: true, MODE: "production", BUILDING: true }, warn);

    expect(url).toBe(FALLBACK_GRAPHQL_URL);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("VITE_GRAPHQL_URL");
  });

  it("a mensagem de produção diz o que fazer, em PT-BR", () => {
    let mensagem = "";
    try {
      _resolveGraphqlUrl({ PROD: true, MODE: "production" }, vi.fn());
    } catch (error) {
      mensagem = (error as Error).message;
    }
    expect(mensagem).toMatch(/produção/);
    expect(mensagem).toMatch(/Defina/);
    expect(mensagem).not.toBe("");
  });

  it("o módulo resolve a URL no import e exporta uma string usável", () => {
    expect(typeof GRAPHQL_URL).toBe("string");
    expect(GRAPHQL_URL).toMatch(/\/graphql\/$/);
  });
});
