/**
 * Testes da orquestração `scripts/dev-fullstack.sh`.
 *
 * O bug que motivou estes testes: o script sobe o Django numa porta
 * (`:9000` por default) mas não dizia nada ao dev server do SvelteKit sobre
 * isso. `src/lib/config.ts` cai em `http://localhost:8000/graphql/` quando
 * `VITE_GRAPHQL_URL` não está setado, então o shell conversava com QUALQUER
 * coisa que estivesse na `:8000` — na prática, o Django de outra frente — e o
 * SSR quebrava com erro de CORS. Medir paridade nesse estado é medir ruído.
 *
 * Também cobre a configurabilidade de porta: com seis frentes trabalhando em
 * paralelo, `:9000`/`:5173` vivem ocupadas, e o script antes reportava "OK"
 * ao encontrar o servidor de outra pessoa na porta.
 *
 * Rodam sem subir servidor: exercitam o subcomando `env`, que só resolve e
 * imprime a configuração.
 */

import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

const SCRIPT = join(process.cwd(), "scripts", "dev-fullstack.sh");

function resolveEnv(overrides: Record<string, string> = {}): Record<string, string> {
  const stdout = execFileSync(SCRIPT, ["env"], {
    encoding: "utf8",
    env: { ...process.env, ...overrides },
  });
  return Object.fromEntries(
    stdout
      .split("\n")
      .filter((line) => line.includes("="))
      .map((line) => {
        const at = line.indexOf("=");
        return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
      }),
  );
}

test.describe("orquestração full-stack (dev-fullstack.sh)", () => {
  test("aponta o VITE_GRAPHQL_URL pro Django que ele mesmo sobe", () => {
    const config = resolveEnv();
    expect(config.DJANGO_PORT).toBe("9000");
    expect(config.VITE_GRAPHQL_URL).toBe("http://localhost:9000/graphql/");
  });

  test("portas são configuráveis e o GraphQL acompanha a porta do Django", () => {
    const config = resolveEnv({ DJANGO_PORT: "9010", SVELTE_PORT: "5183" });
    expect(config.DJANGO_PORT).toBe("9010");
    expect(config.SVELTE_PORT).toBe("5183");
    expect(config.VITE_GRAPHQL_URL).toBe("http://localhost:9010/graphql/");
  });

  test("logs e pidfiles são por porta, pra não atropelar outro worktree", () => {
    const a = resolveEnv({ DJANGO_PORT: "9010", SVELTE_PORT: "5183" });
    const b = resolveEnv({ DJANGO_PORT: "9020", SVELTE_PORT: "5193" });
    expect(a.DJANGO_PID).not.toBe(b.DJANGO_PID);
    expect(a.SVELTE_PID).not.toBe(b.SVELTE_PID);
    expect(a.DJANGO_LOG).not.toBe(b.DJANGO_LOG);
    expect(a.SVELTE_LOG).not.toBe(b.SVELTE_LOG);
  });

  test("VITE_GRAPHQL_URL do ambiente tem precedência", () => {
    const config = resolveEnv({ VITE_GRAPHQL_URL: "http://127.0.0.1:8123/graphql/" });
    expect(config.VITE_GRAPHQL_URL).toBe("http://127.0.0.1:8123/graphql/");
  });
});
