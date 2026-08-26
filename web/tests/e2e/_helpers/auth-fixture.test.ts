/**
 * Testes da fixture de sessão autenticada.
 *
 * A rota `/notificacoes/` exige login e ficou fora da tabela de paridade no
 * Sub-marco 4.I por falta de fixture. Aqui a gente cobre as partes que dão pra
 * provar sem servidor: extração do token CSRF do form do allauth, detecção do
 * cookie de sessão no storageState e a recusa explícita (com motivo) quando a
 * credencial não foi fornecida.
 *
 * O login em si roda contra o Django de dev — ver `_plan/marco4-diff-notes.md`.
 */

import { expect, test } from "@playwright/test";

import {
  type StorageState,
  authenticatedContextState,
  describeAuthFixture,
  extractCsrfToken,
  hasSessionCookie,
} from "./auth-fixture";

const state = (names: string[]): StorageState => ({
  cookies: names.map((name) => ({
    name,
    value: "x",
    domain: "localhost",
    path: "/",
    expires: -1,
    httpOnly: true,
    secure: false,
    sameSite: "Lax" as const,
  })),
  origins: [],
});

test.describe("fixture de auth (auth-fixture)", () => {
  test("extrai o csrfmiddlewaretoken do form do allauth", () => {
    const html = `<form method="post" action="/accounts/login/">
      <input type="hidden" name="csrfmiddlewaretoken" value="AbC123xyz">
      <input name="login"><input name="password"></form>`;
    expect(extractCsrfToken(html)).toBe("AbC123xyz");
  });

  test("aceita ordem invertida de atributos e aspas simples", () => {
    const html = `<input value='TokenDaOutraOrdem' name='csrfmiddlewaretoken' type='hidden'>`;
    expect(extractCsrfToken(html)).toBe("TokenDaOutraOrdem");
  });

  test("devolve null quando o form não tem token", () => {
    expect(extractCsrfToken("<form><input name='login'></form>")).toBeNull();
  });

  test("detecta o cookie de sessão do Django no storageState", () => {
    expect(hasSessionCookie(state(["sessionid", "csrftoken"]))).toBe(true);
    expect(hasSessionCookie(state(["csrftoken"]))).toBe(false);
    expect(hasSessionCookie(state([]))).toBe(false);
  });

  test("sem credencial, recusa com motivo explícito em vez de silenciar", async () => {
    const senhaOriginal = process.env.HINARIA_E2E_PASSWORD;
    delete process.env.HINARIA_E2E_PASSWORD;
    try {
      expect(await authenticatedContextState()).toBeNull();
      expect(describeAuthFixture()).toContain("HINARIA_E2E_PASSWORD");
    } finally {
      if (senhaOriginal !== undefined) process.env.HINARIA_E2E_PASSWORD = senhaOriginal;
    }
  });
});
