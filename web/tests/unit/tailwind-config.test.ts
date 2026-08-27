/**
 * Marco 4.B — Ciclo 4B.1.
 *
 * O Tailwind 4 do shell headless preserva os três papéis tipográficos do
 * monolito Django (definidos em `templates/base.html` e
 * `static/css/design-tokens.css`):
 *
 *   font-display → Cormorant Garamond (títulos)
 *   font-serif   → Source Serif 4    (corpo de hino)
 *   font-sans    → Inter Tight       (UI/navegação)
 *
 * Esses três papéis são checados a partir do `tailwind.config.ts` pra que
 * qualquer regressão (alguém trocar uma família por outra "achando que tava
 * errado") quebre aqui antes de chegar à produção.
 */

import { describe, expect, it } from "vitest";

import config from "../../tailwind.config";

// Os tipos do Tailwind tratam `theme.fontFamily.*` como recursive resolvers;
// no nosso config concreto sabemos que são `string[]`. Helper de leitura.
function readFontFamily(role: "display" | "serif" | "sans"): string[] {
  const themed = config.theme as Record<string, unknown> | undefined;
  const fonts = themed?.fontFamily as Record<string, string[]> | undefined;
  return fonts?.[role] ?? [];
}

describe("tailwind.config.ts", () => {
  it("defines fontFamily.display starting with Cormorant Garamond", () => {
    expect(readFontFamily("display")[0]).toBe("Cormorant Garamond");
  });

  it("defines fontFamily.serif starting with Source Serif 4", () => {
    expect(readFontFamily("serif")[0]).toBe("Source Serif 4");
  });

  it("defines fontFamily.sans starting with Inter Tight", () => {
    expect(readFontFamily("sans")[0]).toBe("Inter Tight");
  });

  it("includes web/src in the content glob so Tailwind scans Svelte/TS files", () => {
    const content = config.content as string[] | { files: string[] };
    const files = Array.isArray(content) ? content : content.files;
    expect(files.some((entry) => entry.includes("src"))).toBe(true);
  });
});
