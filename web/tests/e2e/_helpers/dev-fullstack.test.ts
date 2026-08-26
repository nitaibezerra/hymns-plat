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

/**
 * Frente C — Ciclo C5.
 *
 * "Subir o ambiente" e "ter dados previsíveis" viram um passo só. Sem isso,
 * quem sobe o stack e roda a suíte mede o banco que estiver por perto — que é
 * exatamente o motivo pelo qual duas tentativas de ligar Playwright no CI
 * foram recusadas.
 */
test.describe("seed determinístico na subida (C5)", () => {
  test("por default o script semeia antes de subir os servidores", () => {
    const config = resolveEnv();
    expect(config.SEED_E2E).toBe("1");
  });

  test("SEED_E2E=0 desliga o seed sem mexer no resto", () => {
    const config = resolveEnv({ SEED_E2E: "0" });
    expect(config.SEED_E2E).toBe("0");
    expect(config.DJANGO_PORT).toBe("9000");
  });

  test("o seed roda no repo Django, com o settings do servidor que sobe", () => {
    const config = resolveEnv({ DJANGO_REPO_ROOT: "/tmp/repo-fake" });
    expect(config.SEED_COMMAND).toContain("seed_e2e");
    expect(config.DJANGO_SETTINGS_MODULE).toBe("config.settings.local");
    expect(config.DJANGO_REPO_ROOT).toBe("/tmp/repo-fake");
  });

  test("expõe os usuários da fixture, que é o contrato com as specs", () => {
    const config = resolveEnv();
    expect(config.HINARIA_E2E_EDITOR_USERNAME).toBe("e2e-editor");
    expect(config.HINARIA_E2E_VIEWER_USERNAME).toBe("e2e-viewer");
  });

  test("usuários da fixture são sobrescrevíveis pelo ambiente", () => {
    const config = resolveEnv({ HINARIA_E2E_EDITOR_USERNAME: "outro-editor" });
    expect(config.HINARIA_E2E_EDITOR_USERNAME).toBe("outro-editor");
  });

  test("não imprime a senha da fixture — só de onde ela veio", () => {
    const config = resolveEnv({ HINARIA_E2E_PASSWORD: "segredo-que-nao-pode-vazar" });
    expect(Object.values(config)).not.toContain("segredo-que-nao-pode-vazar");
    expect(config.HINARIA_E2E_PASSWORD_ORIGEM).toBe("ambiente");
  });

  test("sem senha no ambiente, avisa que está usando o default de dev", () => {
    const config = resolveEnv({ HINARIA_E2E_PASSWORD: "" });
    expect(config.HINARIA_E2E_PASSWORD_ORIGEM).toBe("default-de-dev");
  });
});
