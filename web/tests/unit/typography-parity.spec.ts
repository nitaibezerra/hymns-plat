/**
 * Marco 4.I — Ciclo 4I.2 — paridade tipográfica SvelteKit ↔ Django.
 *
 * Espelho explícito de `tests/unit/test_typography_setup.py` no repo Django.
 * Os papéis tipográficos do projeto:
 *
 *   font-display → Cormorant Garamond (títulos)
 *   font-serif   → Source Serif 4    (corpo de hino)
 *   font-sans    → Inter Tight       (UI/navegação)
 *
 * Se os papéis forem flexibilizados intencionalmente, mude AMBOS os testes
 * (Django + Svelte) no mesmo commit.
 *
 * Fase 1 da paridade visual (2026-08-31) — a FONTE deste teste mudou. Antes
 * ele lia `tailwind.config.ts`; agora lê o CSS que o compilador do Tailwind
 * realmente emite. O motivo é que a versão anterior passava verde enquanto a
 * tipografia NÃO chegava na página: no Tailwind 4 a config JS só é carregada
 * via `@config`, que nunca existiu aqui, então `.font-display` não era gerada
 * e todo título renderizava no Inter Tight herdado do `body`. O teste
 * afirmava a intenção; o usuário via o resultado. Agora ele afirma o
 * resultado. Ver `tests/unit/_helpers/tailwind.ts`.
 */

import { describe, expect, it } from "vitest";

import { cssCompilado, regraDe, tokenDe } from "./_helpers/tailwind";

/** A pilha de famílias que a utility `font-<papel>` de fato aplica. */
async function fontsOf(role: string): Promise<string[]> {
  const css = await cssCompilado();
  // A utility tem que existir; senão a "paridade" é só uma variável parada.
  if (regraDe(css, `font-${role}`) === null) return [];
  return (tokenDe(css, `font-${role}`) ?? "")
    .split(",")
    .map((familia) => familia.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

describe("typography-parity — espelha Django test_typography_setup.py", () => {
  describe("font-display (Cormorant Garamond — títulos)", () => {
    it("a primeira família é exatamente 'Cormorant Garamond'", async () => {
      expect((await fontsOf("display"))[0]).toBe("Cormorant Garamond");
    });

    it("tem fallback serif pra ambientes sem a fonte carregada", async () => {
      const stack = await fontsOf("display");
      expect(stack[stack.length - 1]).toBe("serif");
    });

    it("a utility é emitida no CSS — não só declarada no tema", async () => {
      expect(regraDe(await cssCompilado(), "font-display")).not.toBeNull();
    });
  });

  describe("font-serif (Source Serif 4 — corpo de hino)", () => {
    it("a primeira família é exatamente 'Source Serif 4'", async () => {
      expect((await fontsOf("serif"))[0]).toBe("Source Serif 4");
    });

    it("NÃO é Cormorant (regressão clássica: trocar a body-face por display)", async () => {
      expect(await fontsOf("serif")).not.toContain("Cormorant Garamond");
    });

    it("tem fallback serif", async () => {
      const stack = await fontsOf("serif");
      expect(stack[stack.length - 1]).toBe("serif");
    });
  });

  describe("font-sans (Inter Tight — UI/navegação)", () => {
    it("a primeira família é exatamente 'Inter Tight'", async () => {
      expect((await fontsOf("sans"))[0]).toBe("Inter Tight");
    });

    it("NÃO é a Inter pelada (Inter Tight tem métricas mais apertadas)", async () => {
      expect((await fontsOf("sans"))[0]).not.toBe("Inter");
    });

    it("tem fallback sans-serif", async () => {
      const stack = await fontsOf("sans");
      expect(stack[stack.length - 1]).toBe("sans-serif");
    });
  });

  describe("paridade com test_typography_setup.py do Django", () => {
    it("os três papéis canônicos estão todos registrados", async () => {
      expect((await fontsOf("display")).length).toBeGreaterThan(0);
      expect((await fontsOf("serif")).length).toBeGreaterThan(0);
      expect((await fontsOf("sans")).length).toBeGreaterThan(0);
    });

    it("nenhum papel reutiliza a primeira família de outro papel (3 distintos)", async () => {
      const primaries = [
        (await fontsOf("display"))[0],
        (await fontsOf("serif"))[0],
        (await fontsOf("sans"))[0],
      ];
      expect(new Set(primaries).size).toBe(3);
    });

    it("o monolito carrega 4 famílias, e a mono não pode ficar de fora", async () => {
      // JetBrains Mono estava declarada em `--font-mono` e NUNCA baixada: o
      // `@fontsource/jetbrains-mono` não era dependência. Todo eyebrow, badge
      // e `.label-mono` do app caía no monospace do sistema.
      expect((await fontsOf("mono"))[0]).toBe("JetBrains Mono");
    });
  });
});
