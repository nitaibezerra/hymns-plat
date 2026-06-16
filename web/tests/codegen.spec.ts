/**
 * Marco 3 — Ciclo 3.3.
 *
 * `pnpm codegen` lê o SDL exportado em `../schema.graphql` e produz tipos
 * TypeScript em `src/lib/graphql/generated.ts`. Garante que o cliente sempre
 * tenha tipos atualizados com o backend.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, beforeEach } from "vitest";

const WEB_DIR = join(import.meta.dirname, "..");
const GENERATED = join(WEB_DIR, "src/lib/graphql/generated.ts");

describe("graphql-codegen", () => {
  beforeEach(() => {
    if (existsSync(GENERATED)) rmSync(GENERATED);
  });

  it("generates a TypeScript types file from the schema", () => {
    execSync("pnpm codegen", { cwd: WEB_DIR, stdio: "pipe" });
    expect(existsSync(GENERATED)).toBe(true);

    const content = readFileSync(GENERATED, "utf-8");
    // Tipos do nosso domínio devem aparecer
    expect(content).toMatch(/HymnBookType/);
    expect(content).toMatch(/HymnType/);
    expect(content).toMatch(/GlobalStats/);
    expect(content).toMatch(/ReviewStatus/);
  }, 60000);
});
