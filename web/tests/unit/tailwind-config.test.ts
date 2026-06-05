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

describe("tailwind.config.ts", () => {
  it("defines fontFamily.display starting with Cormorant Garamond", () => {
    const display = config.theme?.fontFamily?.display as string[] | undefined;
    expect(display).toBeDefined();
    expect(display?.[0]).toBe("Cormorant Garamond");
  });

  it("defines fontFamily.serif starting with Source Serif 4", () => {
    const serif = config.theme?.fontFamily?.serif as string[] | undefined;
    expect(serif).toBeDefined();
    expect(serif?.[0]).toBe("Source Serif 4");
  });

  it("defines fontFamily.sans starting with Inter Tight", () => {
    const sans = config.theme?.fontFamily?.sans as string[] | undefined;
    expect(sans).toBeDefined();
    expect(sans?.[0]).toBe("Inter Tight");
  });

  it("includes web/src in the content glob so Tailwind scans Svelte/TS files", () => {
    const content = config.content as string[] | { files: string[] };
    const files = Array.isArray(content) ? content : content.files;
    expect(files.some((entry) => entry.includes("src"))).toBe(true);
  });
});
