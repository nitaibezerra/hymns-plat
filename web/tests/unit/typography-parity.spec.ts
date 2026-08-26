/**
 * Marco 4.I — Ciclo 4I.2 — paridade tipográfica SvelteKit ↔ Django.
 *
 * Espelho explícito de `tests/unit/test_typography_setup.py` no repo
 * Django. Os três papéis tipográficos do projeto:
 *
 *   font-display → Cormorant Garamond (títulos)
 *   font-serif   → Source Serif 4    (corpo de hino)
 *   font-sans    → Inter Tight       (UI/navegação)
 *
 * são checados aqui pela lente da config Tailwind 4 do shell SvelteKit
 * (`tailwind.config.ts`). O teste é redundante com
 * `tailwind-config.test.ts` (Marco 4.B), mas mantém a *intenção* explícita
 * de paridade com o Django num arquivo dedicado, o que ajuda quando alguém
 * for editar só um lado e quiser entender por que o outro lado tá pegando.
 *
 * Se os papéis tipográficos forem flexibilizados intencionalmente, mude
 * AMBOS os testes (Django + Svelte) no mesmo commit.
 */

import { describe, expect, it } from "vitest";

import tailwindConfig from "../../tailwind.config";

type FontMap = Record<string, string[]>;

function fontsOf(role: string): string[] {
  const theme = tailwindConfig.theme as Record<string, unknown> | undefined;
  const fonts = theme?.fontFamily as FontMap | undefined;
  return fonts?.[role] ?? [];
}

describe("typography-parity — espelha Django test_typography_setup.py", () => {
  describe("font-display (Cormorant Garamond — títulos)", () => {
    it("a primeira família é exatamente 'Cormorant Garamond'", () => {
      expect(fontsOf("display")[0]).toBe("Cormorant Garamond");
    });

    it("tem fallback serif pra ambientes sem a fonte carregada", () => {
      const stack = fontsOf("display");
      expect(stack[stack.length - 1]).toBe("serif");
    });
  });

  describe("font-serif (Source Serif 4 — corpo de hino)", () => {
    it("a primeira família é exatamente 'Source Serif 4'", () => {
      expect(fontsOf("serif")[0]).toBe("Source Serif 4");
    });

    it("NÃO é Cormorant (regressão clássica: trocar a body-face por display)", () => {
      const stack = fontsOf("serif");
      expect(stack).not.toContain("Cormorant Garamond");
    });

    it("tem fallback serif", () => {
      const stack = fontsOf("serif");
      expect(stack[stack.length - 1]).toBe("serif");
    });
  });

  describe("font-sans (Inter Tight — UI/navegação)", () => {
    it("a primeira família é exatamente 'Inter Tight'", () => {
      expect(fontsOf("sans")[0]).toBe("Inter Tight");
    });

    it("NÃO é a Inter pelada (Inter Tight tem métricas mais apertadas)", () => {
      expect(fontsOf("sans")[0]).not.toBe("Inter");
    });

    it("tem fallback sans-serif", () => {
      const stack = fontsOf("sans");
      expect(stack[stack.length - 1]).toBe("sans-serif");
    });
  });

  describe("paridade com test_typography_setup.py do Django", () => {
    it("os três papéis canônicos estão todos registrados", () => {
      expect(fontsOf("display").length).toBeGreaterThan(0);
      expect(fontsOf("serif").length).toBeGreaterThan(0);
      expect(fontsOf("sans").length).toBeGreaterThan(0);
    });

    it("nenhum papel reutiliza a primeira família de outro papel (3 distintos)", () => {
      const primaries = [
        fontsOf("display")[0],
        fontsOf("serif")[0],
        fontsOf("sans")[0],
      ];
      expect(new Set(primaries).size).toBe(3);
    });
  });
});
